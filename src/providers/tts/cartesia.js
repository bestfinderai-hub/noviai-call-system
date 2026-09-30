'use strict';

// Cartesia TTS provider — Sonic-3.5 (~60ms first chunk, stable)
// Requires: CARTESIA_API_KEY
// Docs: https://docs.cartesia.ai/api-reference/tts/tts
//
// Pipeline: Cartesia MP3 chunks (HTTP streaming) → ffmpeg stdin → mulaw 8kHz → Telnyx WS

const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const WebSocket = require('ws');

const API_KEY  = () => process.env.CARTESIA_API_KEY;
const MODEL    = () => process.env.CARTESIA_MODEL || 'sonic-3-5';
const VOICE_ID = () => process.env.CARTESIA_VOICE_ID || 'a0e99841-438c-4a64-b679-ae501e7d6091'; // Barbra (multilingual)

// Cartesia uses WebSocket streaming for lowest latency
const WS_URL = 'wss://api.cartesia.ai/tts/websocket';

let _ws = null;
let _wsReady = false;
let _synthQueue = Promise.resolve();
let _active = null;

function _setupListeners(ws) {
  ws.on('message', (data, isBinary) => {
    if (!_active) return;

    if (isBinary) {
      if (data.length > 0) _active.onAudioChunk(data);
    } else {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      if (msg.type === 'chunk' && msg.data) {
        const buf = Buffer.from(msg.data, 'base64');
        if (buf.length > 0) _active.onAudioChunk(buf);
      }

      if (msg.type === 'done') {
        const cb = _active;
        _active = null;
        cb.onAudioDone();
      }

      if (msg.type === 'error') {
        console.error('[TTS:cartesia] API error:', msg.error || data.toString());
        if (_active) {
          const cb = _active;
          _active = null;
          cb.onError(new Error(msg.error || 'Cartesia error'));
        }
      }
    }
  });

  ws.on('error', err => {
    console.error('[TTS:cartesia] WS error:', err.message);
    _ws = null; _wsReady = false;
    if (_active) { const cb = _active; _active = null; cb.onError(err); }
  });

  ws.on('close', (code) => {
    if (_ws === ws) { _ws = null; _wsReady = false; }
    if (_active) {
      const cb = _active;
      _active = null;
      cb.onError(new Error(`Cartesia WS closed (${code})`));
    }
    console.log(`[TTS:cartesia] WS closed (${code})`);
  });
}

async function _connect() {
  const key = API_KEY();
  if (!key) throw new Error('CARTESIA_API_KEY not set');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, {
      headers: {
        'X-API-Key': key,
        'Cartesia-Version': '2024-06-10',
      },
    });

    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('Cartesia WS connect timeout'));
    }, 8000);

    ws.once('open', () => {
      clearTimeout(timer);
      _ws = ws;
      _wsReady = true;
      _setupListeners(ws);
      console.log('[TTS:cartesia] Connected');
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
    console.log('[TTS:cartesia] No API key — skipping warmup');
    return;
  }
  try {
    await _getWs();
    console.log('[TTS:cartesia] Pre-warmed');
  } catch (err) {
    console.warn('[TTS:cartesia] Pre-warm failed:', err.message);
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
      console.error('[TTS:cartesia] Connection failed:', err.message);
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
        console.log(`[TTS:cartesia] First chunk ${Date.now() - start}ms`);
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
        onAudioChunk(buf) { if (!cancelled) { try { ff.stdin.write(buf); } catch {} } },
        onAudioDone() { try { ff.stdin.end(); } catch {} },
        onError(err) {
          console.error('[TTS:cartesia] Synthesis error:', err.message);
          try { ff.kill(); } catch {}
          _ws = null; _wsReady = false;
          reject(err);
        },
      };

      ff.on('close', () => {
        if (!cancelled && telnyxWs.readyState === WebSocket.OPEN) {
          telnyxWs.send(JSON.stringify({ event: 'mark', mark: { name: 'tts_end' } }));
        }
        console.log(`[TTS:cartesia] Done ${Date.now() - start}ms — ${resolvedByteLength}B`);
        resolve();
      });

      ff.on('error', err => { console.error('[TTS:cartesia] ffmpeg error:', err.message); reject(err); });

      // Cartesia WebSocket request format
      ws.send(JSON.stringify({
        model_id: MODEL(),
        transcript: text,
        voice: {
          mode: 'id',
          id: VOICE_ID(),
        },
        output_format: {
          container: 'mp3',
          encoding: 'mp3',
          sample_rate: 44100,
        },
        language: process.env.CALL_LANGUAGE || 'sv',
        context_id: `ctx_${Date.now()}`,
        continue: false,
      }));
    });
  })();

  _synthQueue = promise.catch(() => {});

  return {
    promise,
    cancel() { cancelled = true; console.log('[TTS:cartesia] Cancelled'); },
    get byteLength() { return resolvedByteLength; },
  };
}

module.exports = { streamToWebSocket, warmup };
