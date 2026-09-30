'use strict';

// ElevenLabs TTS provider — eleven_flash_v2_5 (~75ms first chunk, stable, no throttling)
// Requires: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
// Install: already included if you run npm install (uses built-in ws + ffmpeg-static)
//
// Latency breakdown: WS connect (one-time ~100ms) + text→audio ~75ms
// Pipeline: ElevenLabs MP3 chunks → ffmpeg stdin → mulaw 8kHz → Telnyx WS

const WebSocket = require('ws');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const API_KEY  = () => process.env.ELEVENLABS_API_KEY;
const VOICE_ID = () => process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam multilingual
const MODEL    = () => process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';

// Persistent WebSocket — reconnect on close
let _ws = null;
let _wsReady = false;
let _synthQueue = Promise.resolve();
let _active = null; // { onMp3Chunk, onMp3Done, onError }

function _buildUrl() {
  const voiceId = VOICE_ID();
  const model = MODEL();
  // output_format=mp3_44100_128 gives cleanest audio; ffmpeg handles conversion to mulaw 8kHz
  return `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input` +
    `?model_id=${model}&output_format=mp3_44100_128&optimize_streaming_latency=4`;
}

function _setupListeners(ws) {
  ws.on('message', (data, isBinary) => {
    if (!_active) return;

    if (isBinary) {
      // Binary frame = raw MP3 bytes
      if (data.length > 0) _active.onMp3Chunk(data);
    } else {
      // Text frame = JSON
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      if (msg.audio) {
        // base64-encoded MP3 chunk
        const buf = Buffer.from(msg.audio, 'base64');
        if (buf.length > 0) _active.onMp3Chunk(buf);
      }

      if (msg.isFinal === true || msg.is_final === true) {
        const cb = _active;
        _active = null;
        cb.onMp3Done();
      }

      if (msg.error) {
        console.error('[TTS:elevenlabs] API error:', msg.error, msg.message || '');
        if (_active) {
          const cb = _active;
          _active = null;
          cb.onError(new Error(msg.error));
        }
      }
    }
  });

  ws.on('error', err => {
    console.error('[TTS:elevenlabs] WS error:', err.message);
    _ws = null; _wsReady = false;
    if (_active) { const cb = _active; _active = null; cb.onError(err); }
  });

  ws.on('close', (code, reason) => {
    if (_ws === ws) { _ws = null; _wsReady = false; }
    if (_active) {
      const cb = _active;
      _active = null;
      cb.onError(new Error(`ElevenLabs WS closed (${code})`));
    }
    console.log(`[TTS:elevenlabs] WS closed (${code})`);
  });
}

async function _connect() {
  const key = API_KEY();
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(_buildUrl(), {
      headers: { 'xi-api-key': key },
    });

    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('ElevenLabs WS connect timeout'));
    }, 8000);

    ws.once('open', () => {
      clearTimeout(timer);
      _ws = ws;
      _wsReady = true;
      _setupListeners(ws);

      // ElevenLabs requires initial config message on connect
      ws.send(JSON.stringify({
        text: ' ',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          use_speaker_boost: true,
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290],
        },
        xi_api_key: key,
      }));

      console.log('[TTS:elevenlabs] Connected');
      resolve(ws);
    });

    ws.once('error', err => { clearTimeout(timer); reject(err); });
  });
}

async function _getWs() {
  if (_ws && _wsReady && _ws.readyState === WebSocket.OPEN) return _ws;
  _ws = null; _wsReady = false;
  return _connect();
}

async function warmup() {
  if (!API_KEY()) {
    console.log('[TTS:elevenlabs] No API key — skipping warmup');
    return;
  }
  try {
    await _getWs();
    console.log('[TTS:elevenlabs] Pre-warmed (WS connected)');
  } catch (err) {
    console.warn('[TTS:elevenlabs] Pre-warm failed:', err.message);
    _ws = null; _wsReady = false;
  }
}

function streamToWebSocket(text, telnyxWs) {
  let cancelled = false;
  let resolvedByteLength = 0;
  const start = Date.now();
  let firstChunk = true;

  const prev = _synthQueue;
  const promise = (async () => {
    await prev;
    if (cancelled) return;

    let ws;
    try {
      ws = await _getWs();
    } catch (err) {
      console.error('[TTS:elevenlabs] Connection failed:', err.message);
      return;
    }

    const ff = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-f', 'mulaw', '-ar', '8000', '-ac', '1',
      'pipe:1',
    ]);

    ff.stdout.on('data', chunk => {
      if (cancelled) return;
      resolvedByteLength += chunk.length;
      if (firstChunk) {
        firstChunk = false;
        console.log(`[TTS:elevenlabs] First chunk ${Date.now() - start}ms`);
      }
      if (telnyxWs.readyState !== WebSocket.OPEN) return;
      for (let i = 0; i < chunk.length; i += 160) {
        if (cancelled || telnyxWs.readyState !== WebSocket.OPEN) break;
        telnyxWs.send(JSON.stringify({
          event: 'media',
          media: { payload: chunk.slice(i, Math.min(i + 160, chunk.length)).toString('base64') },
        }));
      }
    });

    await new Promise((resolve, reject) => {
      _active = {
        onMp3Chunk(mp3) { if (!cancelled) { try { ff.stdin.write(mp3); } catch {} } },
        onMp3Done() { try { ff.stdin.end(); } catch {} },
        onError(err) {
          console.error('[TTS:elevenlabs] Synthesis error:', err.message);
          try { ff.kill(); } catch {}
          // Force reconnect on next call — connection may be in bad state
          _ws = null; _wsReady = false;
          reject(err);
        },
      };

      ff.on('close', () => {
        if (!cancelled && telnyxWs.readyState === WebSocket.OPEN) {
          telnyxWs.send(JSON.stringify({ event: 'mark', mark: { name: 'tts_end' } }));
        }
        console.log(`[TTS:elevenlabs] Done ${Date.now() - start}ms — ${resolvedByteLength}B`);
        resolve();
      });

      ff.on('error', err => { console.error('[TTS:elevenlabs] ffmpeg error:', err.message); reject(err); });

      // ElevenLabs: send text then flush signal
      ws.send(JSON.stringify({ text }));
      ws.send(JSON.stringify({ text: '' })); // empty string = end of input, flush audio
    });
  })();

  _synthQueue = promise.catch(() => {});

  return {
    promise,
    cancel() { cancelled = true; console.log('[TTS:elevenlabs] Cancelled'); },
    get byteLength() { return resolvedByteLength; },
  };
}

module.exports = { streamToWebSocket, warmup };
