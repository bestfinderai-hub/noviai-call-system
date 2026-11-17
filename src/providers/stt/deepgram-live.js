'use strict';

// Deepgram live WebSocket STT — streams mulaw 8kHz directly, receives real-time transcripts.
// Replaces batch Groq Whisper when STT_PROVIDER=deepgram.
// Advantage: ~200ms faster per turn (no batch encode/upload), better Swedish accuracy.
//
// Set in .env:
//   STT_PROVIDER=deepgram
//   DEEPGRAM_API_KEY=<key>
//   DEEPGRAM_STT_MODEL=nova-3  (optional, default nova-3)

const WebSocket = require('ws');

const DEEPGRAM_WS = 'wss://api.deepgram.com/v1/listen';

class DeepgramLiveSession {
  constructor() {
    this._apiKey  = process.env.DEEPGRAM_API_KEY;
    this._lang    = process.env.CALL_LANGUAGE || 'sv';
    this._model   = process.env.DEEPGRAM_STT_MODEL || 'nova-3';
    this._ws      = null;
    this._ready   = false;
    this._queue   = [];   // audio buffered until WS is open
    this._partial = '';   // last is_final text within current utterance

    // Callbacks set by CallSession
    this.onTranscript  = null; // (text: string) → void
    this.onSpeechStart = null; // () → void (optional, for barge-in pre-empt)
  }

  connect() {
    if (!this._apiKey) {
      console.warn('[Deepgram Live] DEEPGRAM_API_KEY not set — live STT disabled');
      return;
    }

    const params = new URLSearchParams({
      model:            this._model,
      language:         this._lang,
      encoding:         'mulaw',
      sample_rate:      '8000',
      channels:         '1',
      punctuate:        'true',
      smart_format:     'true',
      filler_words:     'false',
      interim_results:  'true',
      utterance_end_ms: '500',   // 500ms silence = utterance end (matches VAD_SILENCE_MS)
      vad_events:       'true',
    });

    this._ws = new WebSocket(`${DEEPGRAM_WS}?${params}`, {
      headers: { Authorization: `Token ${this._apiKey}` },
    });

    this._ws.on('open', () => {
      this._ready = true;
      for (const buf of this._queue) {
        if (this._ws.readyState === WebSocket.OPEN) this._ws.send(buf);
      }
      this._queue = [];
      console.log('[Deepgram Live] Connected');
    });

    this._ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      const { type } = msg;

      if (type === 'SpeechStarted') {
        if (this.onSpeechStart) this.onSpeechStart();
        return;
      }

      if (type === 'Results') {
        const alt         = msg.channel?.alternatives?.[0];
        const text        = (alt?.transcript || '').trim();
        const isFinal     = msg.is_final === true;
        const speechFinal = msg.speech_final === true;

        if (isFinal && text) this._partial = text;

        if (speechFinal && this._partial) {
          this._flush();
        }
        return;
      }

      if (type === 'UtteranceEnd') {
        if (this._partial) this._flush();
        return;
      }
    });

    this._ws.on('error', (err) => {
      console.error('[Deepgram Live] WebSocket error:', err.message);
    });

    this._ws.on('close', (code) => {
      this._ready = false;
      console.log(`[Deepgram Live] Closed (${code})`);
    });
  }

  _flush() {
    const text = this._partial;
    this._partial = '';
    if (text && this.onTranscript) this.onTranscript(text);
  }

  // Send a raw mulaw 8kHz chunk (base64-encoded, as received from Telnyx)
  sendAudio(base64Chunk) {
    const buf = Buffer.from(base64Chunk, 'base64');
    if (!this._ready || !this._ws || this._ws.readyState !== WebSocket.OPEN) {
      if (this._queue.length < 2000) this._queue.push(buf); // ~40s buffer cap
      return;
    }
    this._ws.send(buf);
  }

  // Send Deepgram KeepAlive every 8s to prevent idle timeout
  keepalive() {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: 'KeepAlive' }));
    }
  }

  close() {
    if (this._ws) {
      try {
        if (this._ws.readyState === WebSocket.OPEN) {
          this._ws.send(JSON.stringify({ type: 'CloseStream' }));
        }
        this._ws.close();
      } catch {}
      this._ws = null;
    }
    this._ready = false;
  }
}

module.exports = { DeepgramLiveSession };
