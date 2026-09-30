'use strict';

// Edge TTS provider — Microsoft Edge free neural TTS
// Warning: free tier throttles under heavy load (>3 req/s). Use as fallback or dev only.

const WebSocket = require('ws');
const { createHash, randomBytes } = require('crypto');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_BASE = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const GEC_VERSION = '1-143.0.3650.96';
const WS_HDRS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
};

const VOICE = () => process.env.TTS_VOICE || 'sv-SE-SofieNeural';

function generateSecMsGec() {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  return createHash('sha256')
    .update(`${rounded * 10000000}${TRUSTED_TOKEN}`)
    .digest('hex')
    .toUpperCase();
}

const randomHex = n => randomBytes(n).toString('hex').toUpperCase();

function buildWssUrl() {
  return `${WSS_BASE}?` + new URLSearchParams({
    TrustedClientToken: TRUSTED_TOKEN,
    'Sec-MS-GEC': generateSecMsGec(),
    'Sec-MS-GEC-Version': GEC_VERSION,
    ConnectionId: randomHex(16),
  });
}

const xmlEsc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function makeCfgMsg() {
  return (
    'Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' +
    JSON.stringify({
      context: { synthesis: { audio: {
        metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
        outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
      }}},
    })
  );
}

function makeSsmlMsg(text, voice) {
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="sv-SE">` +
    `<voice name="${voice}"><prosody pitch="+0Hz" rate="1" volume="100">` +
    `${xmlEsc(text)}</prosody></voice></speak>`;
  return `X-RequestId:${randomHex(16)}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
}

let _ws = null;
let _wsReady = false;
let _active = null;
let _synthQueue = Promise.resolve();

function _setupListeners(ws) {
  ws.on('message', (data, isBinary) => {
    if (!_active) return;
    if (isBinary) {
      const headerLen = data.readUInt16BE(0);
      const header = data.slice(2, 2 + headerLen).toString();
      if (header.includes('Path:audio')) {
        const mp3 = data.slice(2 + headerLen);
        if (mp3.length > 0) _active.onMp3Chunk(mp3);
      }
    } else {
      if (data.toString().includes('Path:turn.end')) {
        const cb = _active;
        _active = null;
        cb.onMp3Done();
      }
    }
  });

  ws.on('error', err => {
    console.error('[TTS:edge] WS error:', err.message);
    _ws = null; _wsReady = false;
    if (_active) { const cb = _active; _active = null; cb.onError(err); }
  });

  ws.on('close', () => {
    if (_ws === ws) { _ws = null; _wsReady = false; }
    if (_active) {
      const cb = _active;
      _active = null;
      cb.onError(new Error('Edge WS closed mid-synthesis'));
    }
    console.log('[TTS:edge] WS closed');
  });
}

async function _connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(buildWssUrl(), { headers: WS_HDRS });
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('Edge TTS connect timeout')); }, 7000);
    ws.once('open', () => {
      clearTimeout(timer);
      _ws = ws; _wsReady = true;
      _setupListeners(ws);
      ws.send(makeCfgMsg());
      console.log('[TTS:edge] Connected');
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
  try {
    const ws = await _getWs();
    await new Promise((resolve) => {
      _active = {
        onMp3Chunk() {},
        onMp3Done() { resolve(); },
        onError() { resolve(); },
      };
      ws.send(makeSsmlMsg('Hej', VOICE()));
    });
    console.log('[TTS:edge] Pre-warmed');
  } catch (err) {
    console.warn('[TTS:edge] Pre-warm failed:', err.message);
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
      console.error('[TTS:edge] Connection failed:', err.message);
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
      if (firstChunk) { firstChunk = false; console.log(`[TTS:edge] First chunk ${Date.now() - start}ms`); }
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
          console.error('[TTS:edge] Synthesis error:', err.message);
          try { ff.kill(); } catch {}
          _ws = null; _wsReady = false;
          reject(err);
        },
      };

      ff.on('close', () => {
        if (!cancelled && telnyxWs.readyState === WebSocket.OPEN) {
          telnyxWs.send(JSON.stringify({ event: 'mark', mark: { name: 'tts_end' } }));
        }
        console.log(`[TTS:edge] Done ${Date.now() - start}ms — ${resolvedByteLength}B`);
        resolve();
      });

      ff.on('error', err => { console.error('[TTS:edge] ffmpeg error:', err.message); reject(err); });
      ws.send(makeSsmlMsg(text, VOICE()));
    });
  })();

  _synthQueue = promise.catch(() => {});

  return {
    promise,
    cancel() { cancelled = true; console.log('[TTS:edge] Cancelled'); },
    get byteLength() { return resolvedByteLength; },
  };
}

module.exports = { streamToWebSocket, warmup };
