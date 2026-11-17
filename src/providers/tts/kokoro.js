'use strict';

// Kokoro TTS provider — EJ FÖR PRODUKTION med svenska
// Kokoro 82M saknar nativt svenska — kräver community-fork (joakimeriksson/kokoro-sv)
// För svenska: använd TTS_PROVIDER=google (Chirp3-HD, 9.5/10, 1M tecken/mån gratis)
// Kokoro kan användas för engelska eller flerspråkiga system utan svenska.
//
// Env-vars:
//   KOKORO_SERVER_URL  = http://localhost:8000 (default)
//   KOKORO_TIMEOUT_MS  = 10000
//   KOKORO_VOICE       = af_nova (default: varm kvinna)
//
// Starta servern:
//   cd src/providers/tts/kokoro-server
//   pip install -r requirements.txt
//   uvicorn server:app --host 0.0.0.0 --port 8000
//
// Kaggle (gratis GPU):
//   Kör kaggle_kokoro.ipynb — ger URL typ https://xxxx.lhr.life
//   Sätt KOKORO_SERVER_URL=https://xxxx.lhr.life

const http    = require('http');
const https   = require('https');
const WebSocket = require('ws');

const SERVER_URL = () => process.env.KOKORO_SERVER_URL || 'http://localhost:8000';
const TIMEOUT_MS = () => parseInt(process.env.KOKORO_TIMEOUT_MS || '10000', 10);
const VOICE      = () => process.env.KOKORO_VOICE || 'af_nova';

async function warmup() {
  try {
    const url = new URL('/health', SERVER_URL());
    await _get(url.toString());
    console.log('[TTS:kokoro] Server redo — röst:', VOICE());
  } catch (err) {
    console.warn('[TTS:kokoro] Server ej nåbar (startar vid första samtal):', err.message);
  }
}

function streamToWebSocket(text, telnyxWs) {
  let cancelled          = false;
  let resolvedByteLength = 0;
  const start            = Date.now();

  const promise = (async () => {
    const url     = new URL('/tts', SERVER_URL());
    const payload = JSON.stringify({ text, voice: VOICE() });

    let mulaw;
    try {
      mulaw = await _post(url.toString(), payload, TIMEOUT_MS());
    } catch (err) {
      console.error('[TTS:kokoro] Serverfel:', err.message);
      return;
    }

    if (cancelled) return;

    console.log(`[TTS:kokoro] Ljud klart ${Date.now() - start}ms — ${mulaw.length}B`);

    // Skicka mulaw i 160-byte chunks (20ms @ 8kHz) till Telnyx
    for (let i = 0; i < mulaw.length; i += 160) {
      if (cancelled || telnyxWs.readyState !== WebSocket.OPEN) break;
      const chunk = mulaw.slice(i, Math.min(i + 160, mulaw.length));
      resolvedByteLength += chunk.length;
      const mediaMsg = { event: 'media', media: { payload: chunk.toString('base64') } };
      telnyxWs.send(JSON.stringify(mediaMsg));
    }

    if (!cancelled && telnyxWs.readyState === WebSocket.OPEN) {
      const markMsg = { event: 'mark', mark: { name: 'tts_end' } };
      telnyxWs.send(JSON.stringify(markMsg));
    }

    console.log(`[TTS:kokoro] Klart ${Date.now() - start}ms`);
  })();

  return {
    promise,
    cancel() { cancelled = true; console.log('[TTS:kokoro] Avbruten'); },
    get byteLength() { return resolvedByteLength; },
  };
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function _get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 5000 }, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      res.resume();
      resolve();
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

function _post(url, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod     = url.startsWith('https') ? https : http;
    const bodyBuf = Buffer.from(body, 'utf8');

    const req = mod.request(url, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': bodyBuf.length,
      },
      timeout: timeoutMs,
    }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Kokoro HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Kokoro timeout')); });
    req.write(bodyBuf);
    req.end();
  });
}

module.exports = { streamToWebSocket, warmup };
