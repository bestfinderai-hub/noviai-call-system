'use strict';

const EventEmitter = require('events');
const WebSocket    = require('ws');

const { decodeMulawToWav, mulawEnergy } = require('./services/audio');
const { transcribe }      = require('./services/stt');
const { chatStream, chat } = require('./services/llm');
const { streamToWebSocket } = require('./services/tts');
const { saveCallReport }    = require('./features/call-report');
const { detectVoicemail }   = require('./features/voicemail');
const { classifySentiment } = require('./features/sentiment');
const { saveRecording }     = require('./features/recording');
const {
  getTools, buildToolsPrompt, parseToolCalls, stripToolCalls, executeTool,
} = require('./features/tools');
const { telnyxAction }      = require('./webhooks');

const MIN_AUDIO_CHUNKS       = 5;
const MAX_AUDIO_CHUNKS       = 1500;
const ENERGY_THRESHOLD       = 8000;
const MAX_HISTORY_PAIRS      = 20;
const MAX_RECORDING_BUFFER   = 5000; // ~10 min at 8 kHz mulaw (prevents memory leak)

// Barge-in requires this many consecutive high-energy chunks to prevent
// "mm" / "ja" backchannels from interrupting the AI mid-sentence.
const MIN_BARGEIN_CHUNKS     = 4;   // 4 × 20 ms = 80 ms of actual speech
// After AI finishes speaking, ignore user audio for this long (prevents echo/feedback).
const BARGEIN_BACKOFF_MS     = 350;

class CallSession extends EventEmitter {
  /**
   * @param {string} callControlId
   * @param {WebSocket} ws
   * @param {object} [meta]
   * @param {string}  [meta.phoneFrom]
   * @param {string}  [meta.phoneTo]
   * @param {Date}    [meta.startedAt]
   * @param {string}  [meta.firstMessage]   — outbound: custom opening line
   * @param {object}  [meta.variables]      — {{key}} substitutions in system prompt
   * @param {string}  [meta.direction]      — 'incoming' | 'outgoing'
   */
  constructor(callControlId, ws, meta = {}) {
    super();
    this.callControlId = callControlId;
    this.ws            = ws;
    this.phoneFrom     = meta.phoneFrom   || null;
    this.phoneTo       = meta.phoneTo     || null;
    this.startedAt     = meta.startedAt   || new Date();
    this.direction     = meta.direction   || 'incoming';
    this.variables     = meta.variables   || {};
    this._firstMessage = meta.firstMessage || null;

    this.audioChunks   = [];
    this.hasSpoken     = false;
    this.silenceTimer  = null;
    this.state         = 'idle';

    this.history       = [];
    this.turnCount     = 0;
    this.startTime     = Date.now();
    this._hangupCause  = 'normal_clearing';

    this._cancelTts       = null;
    this._speakResolve    = null;  // resolve fn for Telnyx-speak fallback
    this._ivrTurnsChecked = 0;   // check first 3 real turns for IVR/voicemail
    this._cleaned         = false; // guard against double cleanup

    // Barge-in quality gate — consecutive high-energy chunk counter
    this._bargeinCount    = 0;
    // Timestamp when AI last finished speaking — used for BARGEIN_BACKOFF_MS
    this._speakEndedAt    = 0;

    // Sentiment tracking
    this.sentimentHistory = [];
    this.lastSentiment    = null;

    // Recording — buffer ALL inbound audio chunks for post-call WAV file
    this.recordingBuffer  = [];

    // Idle timeout timers (fire when user doesn't respond after AI speaks)
    this._idleTimer1 = null;
    this._idleTimer2 = null;

    // Timing config
    this.silenceMs  = parseInt(process.env.VAD_SILENCE_MS    || '400', 10);
    this.maxCallMs  = parseInt(process.env.MAX_CALL_DURATION || '600', 10) * 1000;

    // Idle timeout config
    this._idleMs1 = parseInt(process.env.IDLE_TIMEOUT_1_MS  || '10000', 10);
    this._idleMs2 = parseInt(process.env.IDLE_TIMEOUT_2_MS  || '8000',  10);
    this._idleMsg1 = process.env.IDLE_MESSAGE_1 || 'Är du kvar?';
    this._idleMsg2 = process.env.IDLE_MESSAGE_2 || null; // null = hang up after timer 2

    // Build session-scoped system prompt (variables injected once at start)
    this._tools        = getTools();
    this._systemPrompt = this._buildSystemPrompt();

    // Max call duration guard
    this._maxTimer = setTimeout(() => this._endCall('max_duration'), this.maxCallMs);

    console.log(`[Session:${this._id()}] Started dir=${this.direction} from=${this.phoneFrom || '?'} tools=${this._tools.length}`);
  }

  _id() { return this.callControlId.slice(-8); }

  // ── System prompt ────────────────────────────────────────────────────────────

  _buildSystemPrompt() {
    // Load base prompt from env/file (via LLM provider)
    const { loadSystemPrompt } = require('./providers/llm');
    const base = loadSystemPrompt();

    // Inject {{variable}} templates — cap each value to prevent prompt bloat
    const withVars = base.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = this.variables[key];
      if (val == null) return '';
      return String(val).slice(0, 200); // max 200 chars per variable
    });

    // Append tool descriptions if tools are configured
    const toolsSection = buildToolsPrompt(this._tools);

    return withVars + toolsSection;
  }

  // ── Audio handling ───────────────────────────────────────────────────────────

  handleAudioChunk(base64Payload) {
    // Cancel idle timers the moment user makes any sound
    if (this.state === 'idle' || this.state === 'listening') {
      this._clearIdleTimers();
    }

    if (this.state === 'processing' || this.state === 'speaking') {
      if (this.state === 'speaking') {
        const energy = mulawEnergy(base64Payload);
        if (energy > ENERGY_THRESHOLD * 2) {
          this._bargeinCount++;
          if (this._bargeinCount >= MIN_BARGEIN_CHUNKS) {
            this._bargeinCount = 0;
            this._handleBargein(base64Payload);
          }
        } else {
          this._bargeinCount = 0; // reset on silence — must be consecutive
        }
      }
      return;
    }

    // Post-speech backoff: ignore audio briefly after AI finishes talking
    if (this._speakEndedAt && Date.now() - this._speakEndedAt < BARGEIN_BACKOFF_MS) {
      return;
    }

    const energy = mulawEnergy(base64Payload);
    this.audioChunks.push(base64Payload);
    if (process.env.RECORDING_ENABLED === 'true' && this.recordingBuffer.length < MAX_RECORDING_BUFFER) {
      this.recordingBuffer.push(base64Payload);
    }

    if (this.audioChunks.length >= MAX_AUDIO_CHUNKS) {
      console.warn(`[Session:${this._id()}] Buffer full — force processing`);
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
      this._processTurn();
      return;
    }

    if (energy > ENERGY_THRESHOLD) {
      this.hasSpoken = true;
      if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
      this.state = 'listening';
    } else if (this.hasSpoken && this.state === 'listening' && !this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null;
        if (this.audioChunks.length >= MIN_AUDIO_CHUNKS) {
          this._processTurn();
        } else {
          this.audioChunks = [];
          this.state = 'idle';
        }
      }, this.silenceMs);
    }
  }

  // DTMF digit pressed on keypad
  handleDtmf(digit) {
    // Sanitize digit — Telnyx sends single chars but be defensive
    const safe = String(digit).replace(/[^0-9*#]/g, '').slice(0, 1);
    if (!safe) return;

    console.log(`[Session:${this._id()}] DTMF: ${safe}`);
    this._clearIdleTimers();

    // Cancel speaking if AI is currently talking
    if (this.state === 'speaking' && this._cancelTts) this._cancelTts();

    // Guard: don't start a new turn if already processing
    if (this.state === 'processing') {
      console.log(`[Session:${this._id()}] DTMF ignored — turn in progress`);
      return;
    }

    const text = `[Kunden tryckte siffra: ${safe}]`;
    this._processTurnFromText(text).catch(err =>
      console.error(`[Session:${this._id()}] DTMF turn error:`, err.message)
    );
  }

  handleMark(name) {
    if (name === 'tts_end' && this.state === 'speaking') {
      this._speakEndedAt = Date.now(); // start backoff window
      this._bargeinCount = 0;
      this.state = 'idle';
      this.audioChunks = [];
      this._startIdleTimer();
      console.log(`[Session:${this._id()}] Speaking done → idle`);
    }
  }

  // ── Greeting ─────────────────────────────────────────────────────────────────

  async sendGreeting() {
    const mode = (process.env.FIRST_MESSAGE_MODE || 'assistant').toLowerCase();

    if (mode === 'user') {
      console.log(`[Session:${this._id()}] first_message_mode=user — waiting for caller`);
      return;
    }

    if (mode === 'model') {
      // LLM generates a contextualised greeting
      try {
        const generated = await chat(
          [{ role: 'user', content: '[Samtalet börjar. Hälsa kunden välkommen på svenska.]' }],
          this._systemPrompt,
        );
        await this._speak(generated);
      } catch (err) {
        console.error('[Session] Model greeting error:', err.message);
        await this._speak(process.env.TTS_GREETING || 'NovAI, det här är Sofia, hur kan jag hjälpa dig?');
      }
      return;
    }

    // Default: assistant-first with configured greeting or per-call firstMessage
    const greeting = this._firstMessage
      || process.env.TTS_GREETING
      || 'NovAI, det här är Sofia, hur kan jag hjälpa dig?';

    console.log(`[Session:${this._id()}] Greeting: "${greeting}"`);
    await this._speak(greeting);
  }

  // ── Turn processing ───────────────────────────────────────────────────────────

  async _processTurn() {
    if (this.state === 'processing') return;
    this.state = 'processing';

    const chunks = [...this.audioChunks];
    this.audioChunks = [];
    const t0 = Date.now();

    try {
      // 1. STT
      const wavBuffer = decodeMulawToWav(chunks);
      const transcript = await transcribe(wavBuffer);

      if (!transcript || transcript.length < 2) {
        console.log(`[Session:${this._id()}] Empty transcript — skip`);
        this.state = 'idle';
        return;
      }

      await this._processTurnFromText(transcript, t0);

    } catch (err) {
      console.error(`[Session:${this._id()}] Turn error:`, err.message);
      this.state = 'idle';
      this.audioChunks = [];
    }
  }

  async _processTurnFromText(userText, t0 = Date.now()) {
    // Ensure state = processing (DTMF path doesn't go through _processTurn)
    this.state = 'processing';

    // 2. IVR/voicemail detection — first 3 real turns (phone queues often reveal
    //    themselves on turn 2-3: "Alla operatörer är upptagna, väntetid 5 min")
    const IVR_CHECK_TURNS = 3;
    if (this._ivrTurnsChecked < IVR_CHECK_TURNS && userText[0] !== '[') {
      this._ivrTurnsChecked++;
      if (detectVoicemail(userText)) {
        // Before hanging up: try IVR auto-bypass if configured
        const bypassed = await this._tryIvrBypass(userText);
        if (!bypassed) {
          console.log(`[Session:${this._id()}] IVR/voicemail detected (turn ${this._ivrTurnsChecked}) — hanging up`);
          this._hangupCause = 'voicemail_detected';
          this._endCall('voicemail_detected');
          return;
        }
        // If bypassed (sent DTMF) we continue and let the conversation proceed
      }
    }

    // 3. Sentiment classification — async, non-blocking (no latency impact)
    if (userText[0] !== '[') {
      this._classifySentiment(userText, this.turnCount + 1);
    }

    this.turnCount++;
    console.log(`[Session:${this._id()}] Turn ${this.turnCount} (+${Date.now()-t0}ms) User: "${userText}"`);

    // 3. LLM — collect full response (tools may require a second pass)
    this.history.push({ role: 'user', content: userText });

    let rawOutput = '';
    try {
      for await (const sentence of chatStream(this.history, this._systemPrompt)) {
        rawOutput += (rawOutput ? ' ' : '') + sentence;
      }
    } catch (err) {
      console.error(`[Session:${this._id()}] LLM error:`, err.message);
      this.state = 'idle';
      return;
    }

    // 4. Tool call handling
    const toolCalls = parseToolCalls(rawOutput);
    let finalText  = stripToolCalls(rawOutput).trim();
    let pendingAction = null;

    if (toolCalls.length > 0) {
      const ctx = { callId: this.callControlId, phoneFrom: this.phoneFrom };
      // Run all tool HTTP calls in parallel — independent requests benefit most
      const toolResults = await Promise.all(
        toolCalls.map(call =>
          executeTool(call.name, call.arguments || {}, ctx)
            .then(r => ({ call, ...r }))
        )
      );

      for (const { call, result, action, actionPayload } of toolResults) {
        console.log(`[Session:${this._id()}] Tool "${call.name}" → action=${action || 'none'} result="${result.slice(0, 80)}"`);

        if (action) {
          pendingAction = { type: action, payload: actionPayload };
          // Farewell from endCall becomes the spoken text
          if (action === 'endCall' && result && !finalText) finalText = result;
        } else {
          // Inject tool result as user-context message (role:user avoids LLM compatibility issues)
          this.history.push({ role: 'user', content: `[Systeminfo – verktyg ${call.name} svarade]: ${result}` });

          let continuation = '';
          try {
            for await (const s of chatStream(this.history, this._systemPrompt)) {
              continuation += (continuation ? ' ' : '') + s;
            }
          } catch (err) {
            console.warn(`[Session:${this._id()}] Tool continuation LLM error:`, err.message);
          }

          // Strip any nested tool calls from continuation
          continuation = stripToolCalls(continuation).trim();
          if (continuation) finalText = (finalText ? finalText + ' ' : '') + continuation;

          // Remove the injected system message to keep history clean
          this.history.pop();
          // Instead record: tool result as assistant knowledge
          this.history.push({ role: 'assistant', content: `[${call.name}: ${result}]` });
        }
      }
    }

    if (!finalText) {
      console.warn(`[Session:${this._id()}] Empty response after tools — skip TTS`);
      this.state = 'idle';
      return;
    }

    // Record final assistant turn
    this.history.push({ role: 'assistant', content: finalText });
    console.log(`[Session:${this._id()}] Agent (+${Date.now()-t0}ms): "${finalText.slice(0, 100)}"`);

    // Trim history to prevent unbounded growth
    if (this.history.length > MAX_HISTORY_PAIRS * 2) {
      this.history = this.history.slice(-MAX_HISTORY_PAIRS * 2);
    }

    // Fire real-time conversation webhook (non-blocking)
    this._fireConversationWebhook();

    // 5. TTS
    await this._speak(finalText);

    // 6. Execute pending action AFTER speaking
    if (pendingAction) {
      if (pendingAction.type === 'endCall') {
        this._hangupCause = 'assistant_ended';
        this._endCall('assistant_ended');
        return;
      }
      if (pendingAction.type === 'transfer') {
        await telnyxAction(this.callControlId, 'transfer', {
          to: [{ phone_number: pendingAction.payload.to }],
        });
        this._hangupCause = 'transferred';
      }
    }
  }

  // ── TTS ───────────────────────────────────────────────────────────────────────

  async _speak(text) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this._clearIdleTimers();
    this.state = 'speaking';

    const { promise, cancel, byteLength } = streamToWebSocket(text, this.ws);
    this._cancelTts = cancel;

    // byteLength is a getter that accumulates during streaming, so it's 0 at this point.
    // Estimate from text length: ~65ms per char for Edge TTS at 8kHz mulaw.
    const playbackMs = Math.ceil(text.length * 65) + 5000;
    const fallbackTimer = setTimeout(() => {
      if (this.state === 'speaking') {
        console.warn(`[Session:${this._id()}] Mark echo timeout — forcing idle`);
        this.state = 'idle';
        this.audioChunks = [];
        this._startIdleTimer();
      }
    }, playbackMs);

    let streamFailed = false;
    try {
      await promise;
    } catch (err) {
      if (err.message !== 'cancelled') {
        console.error(`[Session:${this._id()}] TTS stream error:`, err.message);
        streamFailed = true;
      }
    } finally {
      clearTimeout(fallbackTimer);
      this._cancelTts = null;
    }

    // ── Telnyx-speak fallback — fires when Edge TTS produced 0 audio bytes ────
    if (byteLength === 0 && !streamFailed && this.state === 'speaking') {
      console.warn(`[Session:${this._id()}] Edge TTS produced 0 bytes — falling back to Telnyx speak`);
      await this._speakViaTelnyx(text);
      return;
    }

    // Note: _startIdleTimer is called from handleMark('tts_end').
    // The fallback timer above handles the case where the mark never arrives.
    if (this.state === 'speaking') this.state = 'idle';
    this.audioChunks = [];
  }

  // Telnyx-native TTS fallback (REST action — no Edge TTS / ffmpeg needed)
  async _speakViaTelnyx(text) {
    const lang = process.env.CALL_LANGUAGE === 'sv' ? 'sv-SE' : (process.env.TELNYX_TTS_LANGUAGE || 'sv-SE');
    const ok = await telnyxAction(this.callControlId, 'speak', {
      payload:      text,
      payload_type: 'text',
      voice:        'female',
      language:     lang,
    });

    if (!ok) {
      console.error(`[Session:${this._id()}] Telnyx speak action failed`);
      this.state = 'idle';
      this.audioChunks = [];
      this._startIdleTimer();
      return;
    }

    // Wait for call.speak.ended webhook → resolves _speakResolve
    await new Promise(resolve => {
      this._speakResolve = resolve;
      // Safety timeout: force idle if webhook never arrives
      setTimeout(() => {
        if (this._speakResolve === resolve) {
          this._speakResolve = null;
          console.warn(`[Session:${this._id()}] Telnyx speak ended timeout`);
          resolve();
        }
      }, 30_000);
    });

    this.state = 'idle';
    this.audioChunks = [];
    this._startIdleTimer();
  }

  // Called by webhook handler when call.speak.ended fires (non-voicemail)
  onSpeakEnded() {
    if (this._speakResolve) {
      const resolve = this._speakResolve;
      this._speakResolve = null;
      resolve();
    } else {
      // Speak ended but no pending promise — safe to ignore
      if (this.state === 'speaking') {
        this.state = 'idle';
        this.audioChunks = [];
        this._startIdleTimer();
      }
    }
  }

  // ── Barge-in ──────────────────────────────────────────────────────────────────

  _handleBargein(firstChunk) {
    console.log(`[Session:${this._id()}] Barge-in detected`);
    this._clearIdleTimers();
    if (this._cancelTts) this._cancelTts();
    this.state = 'listening';
    this.hasSpoken = true;
    this.audioChunks = [firstChunk];
  }

  // ── Idle timeout ──────────────────────────────────────────────────────────────

  _startIdleTimer() {
    this._clearIdleTimers();
    if (this._idleMs1 <= 0) return;

    this._idleTimer1 = setTimeout(async () => {
      if (this.state !== 'idle') return;
      console.log(`[Session:${this._id()}] Idle timeout 1 — sending "${this._idleMsg1}"`);
      await this._speak(this._idleMsg1);

      if (this.state !== 'idle') return;
      this._idleTimer2 = setTimeout(async () => {
        if (this.state !== 'idle') return;
        if (this._idleMsg2) {
          await this._speak(this._idleMsg2);
        }
        this._endCall('idle_timeout');
      }, this._idleMs2);
    }, this._idleMs1);
  }

  _clearIdleTimers() {
    clearTimeout(this._idleTimer1);
    clearTimeout(this._idleTimer2);
    this._idleTimer1 = null;
    this._idleTimer2 = null;
  }

  // ── IVR auto-bypass ───────────────────────────────────────────────────────────
  // When an IVR menu is detected, check if there's a configured DTMF digit to press.
  // Set IVR_BYPASS_DIGIT=1 in .env to auto-press "1" instead of hanging up.
  // Returns true if bypass was attempted (don't hang up), false if no bypass configured.

  async _tryIvrBypass(text) {
    const bypassDigit = process.env.IVR_BYPASS_DIGIT;
    if (!bypassDigit) return false;

    // Only bypass on DTMF menu prompts ("tryck 1", "press 1"), not generic voicemail
    const isMenu = /(?:tryck|press)\s*\d/i.test(text) ||
                   /(?:för|for)\s+(?:support|service|hjälp|help)/i.test(text);
    if (!isMenu) return false;

    const digit = String(bypassDigit).replace(/[^0-9*#]/g, '').slice(0, 1);
    if (!digit) return false;

    console.log(`[Session:${this._id()}] IVR bypass — auto-pressing ${digit}`);
    await telnyxAction(this.callControlId, 'send_dtmf', { dtmf_digits: digit })
      .catch(err => console.warn(`[Session:${this._id()}] DTMF send failed:`, err.message));

    return true;
  }

  // ── Sentiment classification (async, non-blocking) ────────────────────────────

  _classifySentiment(text, turn) {
    classifySentiment(text).then(sentiment => {
      this.sentimentHistory.push({ turn, sentiment });
      this.lastSentiment = sentiment;
      if (sentiment !== 'neutral') {
        console.log(`[Session:${this._id()}] Sentiment turn ${turn}: ${sentiment}`);
      }
    }).catch(() => { /* non-fatal */ });
  }

  // ── Cost calculation ──────────────────────────────────────────────────────────
  // Telnyx: ~$0.005/min inbound, ~$0.01/min outbound. STT/LLM/TTS: free tier.

  _calculateCost(durationSec) {
    const mins = durationSec / 60;
    const telnyxRate = this.direction === 'incoming' ? 0.005 : 0.01;
    return parseFloat((mins * telnyxRate).toFixed(4));
  }

  // ── Conversation webhook (real-time per-turn) ─────────────────────────────────

  _fireConversationWebhook() {
    const url = process.env.NOVA_CONVERSATION_WEBHOOK_URL;
    if (!url) return;

    const payload = {
      type: 'conversation-update',
      callId: this.callControlId,
      phoneFrom: this.phoneFrom,
      phoneTo: this.phoneTo,
      turn: this.turnCount,
      messages: this.history,
      sentiment: this.lastSentiment,
      sentimentHistory: this.sentimentHistory,
      timestamp: new Date().toISOString(),
    };

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }).catch(err => console.warn('[ConvWebhook] Failed:', err.message));
  }

  // ── Cleanup & end ─────────────────────────────────────────────────────────────

  cleanup() {
    if (this._cleaned) return; // guard against double cleanup
    this._cleaned = true;

    clearTimeout(this._maxTimer);
    clearTimeout(this.silenceTimer);
    this._clearIdleTimers();
    if (this._cancelTts) this._cancelTts();

    const durationSec = Math.round((Date.now() - this.startTime) / 1000);
    const costUsd     = this._calculateCost(durationSec);
    console.log(`[Session:${this._id()}] Ended — ${durationSec}s, ${this.turnCount} turns, $${costUsd}, cause=${this._hangupCause}`);

    // Save recording asynchronously (don't block cleanup)
    const recordingPromise = saveRecording(this.recordingBuffer, this.callControlId);

    recordingPromise.then(recordingUrl => {
      saveCallReport({
        callId:          this.callControlId,
        phoneFrom:       this.phoneFrom,
        phoneTo:         this.phoneTo,
        startedAt:       this.startedAt,
        durationSec,
        turnCount:       this.turnCount,
        hangupCause:     this._hangupCause,
        transcript:      this.history,
        direction:       this.direction,
        variables:       this.variables,
        sentimentTurns:  this.sentimentHistory,
        costUsd,
        recordingUrl:    recordingUrl || null,
      }).catch(err => console.error('[Session] Report save failed:', err.message));
    });

    this.emit('ended', {
      callControlId: this.callControlId,
      durationSec,
      turnCount: this.turnCount,
      history: this.history,
    });
  }

  _endCall(reason) {
    this._hangupCause = reason;
    console.log(`[Session:${this._id()}] Force-ending: ${reason}`);
    // Send hangup to Telnyx so the call actually ends on their side too
    telnyxAction(this.callControlId, 'hangup', {})
      .catch(err => console.warn(`[Session:${this._id()}] Hangup action failed:`, err.message));
    this.cleanup();
  }
}

module.exports = { CallSession };
