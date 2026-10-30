'use strict';

// Chatterbox TTS provider — anropar self-hosted inference-server
// Zero-shot voice cloning: skicka valfritt referensklipp → pratar i den rösten
//
// Env-vars:
//   CHATTERBOX_SERVER_URL   = http://localhost:8000
//   CHATTERBOX_TIMEOUT_MS   = 30000
//   CHATTERBOX_EXAGGERATION = 0.5  (0.25=lugn, 0.75=uttrycksfull)
//   CHATTERBOX_CFG_WEIGHT   = 0.5
//   CHATTERBOX_API_KEY      = secret (om satt på servern)
//   CHATTERBOX_REF_AUDIO    = /path/to/reference.wav (valfri override)
//
// Starta servern: se src/providers/tts/chatterbox-server/

const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const WebSocket = require('ws');

const SERVER_URL   = () => process.env.CHATTERBOX_SERVER_URL || 'http://localhost:8000';
const TIMEOUT_MS   = () => parseInt(process.env.CHATTERBOX_TIMEOUT_MS  || '30000', 10);
const EXAGGERATION = () => parseFloat(process.env.CHATTERBOX_EXAGGERATION || '0.5');
const CFG_WEIGHT   = () => parseFloat(process.env.CHATTERBOX_CFG_WEIGHT   || '0.5');
const API_KEY      = () => process.env.CHATTERBOX_API_KEY || '';

// Referensljud cacheat vid modul-load (undviker disk-I/O per samtal)
let _refAudioB64 = null;
const refPath = process.env.CHATTERBOX_REF_AUDIO || null;
if (refPath) {
  try {
    _refAudioB64 = fs.readFileSync(refPath).toString('base64');
    console.log(`[TTS:chatterbox] Referensljud cachat från ${refPath}`);
  } catch (e) {
    console.warn('[TTS:chatterbox] Kunde ej läsa REF_AUDIO vid startup:', e.message);
  }
}

async function warmup() {
  try {
    const url = new URL('/health', SERVER_URL());
    await _get(url.toString());
    console.log('[TTS:chatterbox] Server redo');
  } catch (err) {
    console.warn('[TTS:chatterbox] Server ej nåbar:', err.message);
  }
}

function streamToWebSocket(text, telnyxWs) {
  let cancelled = false;
  let resolvedByteLength = 0;
  const start = Date.now();

  const promise = (async () => {
    const url = new URL('/tts', SERVER_URL());

    const payload = {
      text,
      exaggeration: EXAGGERATION(),
      cfg_weight:   CFG_WEIGHT(),
    };

    if (_refAudioB64) {
      payload.ref_audio_b64 = _refAudioB64;
    }

    let mulaw;
    try {
      mulaw = await _post(url.toString(), JSON.stringify(payload), TIMEOUT_MS());
    } catch (err) {
      console.error('[TTS:chatterbox] Serverfel:', err.message);
      return;
    }

    if (cancelled) return;

    console.log(`[TTS:chatterbox] Ljud klart ${Date.now() - start}ms — ${mulaw.length}B`);

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

    console.log(`[TTS:chatterbox] Klart ${Date.now() - start}ms`);
  })();

  return {
    promise,
    cancel() { cancelled = true; },
    get byteLength() { return resolvedByteLength; },
  };
}

function _get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 5000 }, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      res.resume(); resolve();
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

function _post(url, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const bodyBuf = Buffer.from(body, 'utf8');
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': bodyBuf.length,
    };
    const apiKey = API_KEY();
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const req = mod.request(url, { method: 'POST', headers, timeout: timeoutMs }, res => {
      if (res.statusCode !== 200) {
        res.resume(); return reject(new Error(`Chatterbox ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Chatterbox timeout')); });
    req.write(bodyBuf);
    req.end();
  });
}

module.exports = { streamToWebSocket, warmup };
