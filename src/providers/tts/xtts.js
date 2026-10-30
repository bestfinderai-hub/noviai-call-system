const http = require('http');
const https = require('https');
const { URL } = require('url');

const SERVER_URL  = process.env.XTTS_SERVER_URL || 'http://localhost:8000';
const TIMEOUT_MS  = parseInt(process.env.XTTS_TIMEOUT_MS || '30000');
const CHUNK_BYTES = 160; // 20ms @ 8kHz mulaw

function streamToWebSocket(text, telnyxWs) {
  let cancelled = false;
  let totalBytes = 0;

  const promise = new Promise((resolve, reject) => {
    const url = new URL('/tts', SERVER_URL);
    const body = JSON.stringify({ text });
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: TIMEOUT_MS,
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`XTTS HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        if (cancelled) return resolve({ byteLength: 0 });

        const audio = Buffer.concat(chunks);
        totalBytes = audio.length;

        // Strömma 160-byte chunks (20ms) till Telnyx
        for (let i = 0; i < audio.length; i += CHUNK_BYTES) {
          if (cancelled) break;
          const chunk = audio.slice(i, i + CHUNK_BYTES);
          telnyxWs.send(JSON.stringify({
            event: 'media',
            media: { payload: chunk.toString('base64') },
          }));
        }
        resolve({ byteLength: totalBytes });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('XTTS timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  return {
    promise,
    cancel: () => { cancelled = true; },
    get byteLength() { return totalBytes; },
  };
}

// Warmup: enkel hälsokontroll mot servern
async function warmup() {
  const url = new URL('/health', SERVER_URL);
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    const req = lib.get(url, { timeout: 5000 }, (res) => {
      res.resume();
      console.log(`[XTTS] warmup OK — server svarar (HTTP ${res.statusCode})`);
      resolve();
    });
    req.on('error', (e) => {
      console.warn(`[XTTS] warmup misslyckades (server ej igång?): ${e.message}`);
      resolve(); // Blockera inte start om server ej är uppe än
    });
    req.on('timeout', () => { req.destroy(); resolve(); });
  });
}

module.exports = { streamToWebSocket, warmup };
