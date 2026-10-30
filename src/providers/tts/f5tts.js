'use strict';

// F5-TTS Swedish provider — anropar lokal/remote inference-server
// Server returnerar mulaw 8kHz direkt → inga konverteringar behövs
//
// Env-vars:
//   F5TTS_SERVER_URL  = http://localhost:8000 (default)
//   F5TTS_TIMEOUT_MS  = 8000
//
// Starta servern: se src/providers/tts/f5tts-server/

const http  = require('http');
const https = require('https');
const WebSocket = require('ws');

const SERVER_URL = () => process.env.F5TTS_SERVER_URL || 'http://localhost:8000';
const TIMEOUT_MS = () => parseInt(process.env.F5TTS_TIMEOUT_MS || '8000', 10);

async function warmup() {
  try {
    const url = new URL('/health', SERVER_URL());
    await _get(url.toString());
    console.log('[TTS:f5tts] Server redo');
  } catch (err) {
    console.warn('[TTS:f5tts] Server ej nåbar (startar vid första samtal):', err.message);
  }
}

function streamToWebSocket(text, telnyxWs) {
  let cancelled = false;
  let resolvedByteLength = 0;
  const start = Date.now();

  const promise = (async () => {
    const url = new URL('/tts', SERVER_URL());
    const body = JSON.stringify({ text });

    let mulaw;
    try {
      mulaw = await _post(url.toString(), body, TIMEOUT_MS());
    } catch (err) {
      console.error('[TTS:f5tts] Serverfel:', err.message);
      return;
    }

    if (cancelled) return;

    console.log(`[TTS:f5tts] Första ljud ${Date.now() - start}ms — ${mulaw.length}B`);

    // Skicka mulaw i 160-byte chunks (20ms @ 8kHz) till Telnyx
    for (let i = 0; i < mulaw.length; i += 160) {
      if (cancelled || telnyxWs.readyState !== WebSocket.OPEN) break;
      const chunk = mulaw.slice(i, Math.min(i + 160, mulaw.length));
      resolvedByteLength += chunk.length;
      telnyxWs.send(JSON.stringify({
        event: 'media',
        media: { payload: chunk.toString('base64') },
      }));
    }

    if (!cancelled && telnyxWs.readyState === WebSocket.OPEN) {
      telnyxWs.send(JSON.stringify({ event: 'mark', mark: { name: 'tts_end' } }));
    }

    console.log(`[TTS:f5tts] Klart ${Date.now() - start}ms`);
  })();

  return {
    promise,
    cancel() { cancelled = true; },
    get byteLength() { return resolvedByteLength; },
  };
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

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
    const mod = url.startsWith('https') ? https : http;
    const bodyBuf = Buffer.from(body, 'utf8');

    const req = mod.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
      },
      timeout: timeoutMs,
    }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`F5TTS ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('F5TTS timeout')); });
    req.write(bodyBuf);
    req.end();
  });
}

module.exports = { streamToWebSocket, warmup };
