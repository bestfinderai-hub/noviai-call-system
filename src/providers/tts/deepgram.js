'use strict';

// Deepgram Flux TTS — context-aware, 7 svenska röster, native mulaw 8kHz
// Svenska röster: Axel, Charlotta, Frida, Ludvig, Oskar, Pontus, Wilma
// Pris: $0.045/1000 tecken (~$30/mån vid 675K tecken)
// Docs: https://developers.deepgram.com/docs/flux-tts/voices

const https     = require('https');
const WebSocket = require('ws');

const API_KEY  = () => process.env.DEEPGRAM_API_KEY || '';
const MODEL    = () => process.env.DEEPGRAM_TTS_MODEL || 'aura-2-en-us';
const TIMEOUT  = () => parseInt(process.env.DEEPGRAM_TTS_TIMEOUT_MS || '10000', 10);

async function warmup() {
  if (!API_KEY()) {
    console.warn('[TTS:deepgram] DEEPGRAM_API_KEY saknas');
    return;
  }
  console.log('[TTS:deepgram] Redo — model:', MODEL());
}

function streamToWebSocket(text, telnyxWs) {
  let cancelled = false;
  let resolvedByteLength = 0;
  const start = Date.now();

  const promise = (async () => {
    if (!API_KEY()) throw new Error('DEEPGRAM_API_KEY saknas');

    console.log(`[TTS:deepgram] Syntetiserar (${text.length} tecken): "${text.slice(0, 60)}"`);

    const mulaw = await _fetchMulaw(text);
    if (cancelled) return;

    console.log(`[TTS:deepgram] Mulaw mottagen ${Date.now()-start}ms ${mulaw.length}B`);

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

    console.log(`[TTS:deepgram] Klart ${Date.now()-start}ms`);
  })();

  return {
    promise,
    cancel() { cancelled = true; console.log('[TTS:deepgram] Avbruten'); },
    get byteLength() { return resolvedByteLength; },
  };
}

function _fetchMulaw(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text });
    // encoding=mulaw + sample_rate=8000 + container=none → råa mulaw-bytes
    const path = `/v1/speak?model=${MODEL()}&encoding=mulaw&sample_rate=8000&container=none`;

    const timer = setTimeout(() => reject(new Error('Deepgram TTS timeout')), TIMEOUT());

    const req = https.request({
      hostname: 'api.deepgram.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Token ${API_KEY()}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode !== 200) {
          const msg = Buffer.concat(chunks).toString('utf8');
          return reject(new Error(`Deepgram TTS ${res.statusCode}: ${msg.slice(0, 200)}`));
        }
        resolve(Buffer.concat(chunks));
      });
      res.on('error', e => { clearTimeout(timer); reject(e); });
    });

    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.write(body);
    req.end();
  });
}

module.exports = { streamToWebSocket, warmup };
