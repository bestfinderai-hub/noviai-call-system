'use strict';

// Google Cloud Text-to-Speech provider
// Returnerar MULAW 8kHz direkt — ingen ffmpeg-konvertering behövs
//
// Env-vars:
//   GOOGLE_TTS_API_KEY  = din API-nyckel (från Google Cloud Console)
//   GOOGLE_TTS_VOICE    = sv-SE-Neural2-A (default, gratis upp till 1M tecken/mån)
//   GOOGLE_TTS_LANGUAGE = sv-SE (default)
//
// Skapa API-nyckel:
//   1. console.cloud.google.com → APIs & Services → Credentials → Create API Key
//   2. Aktivera "Cloud Text-to-Speech API" i API Library
//   3. Sätt GOOGLE_TTS_API_KEY i .env

const https   = require('https');
const WebSocket = require('ws');

const API_KEY  = () => process.env.GOOGLE_TTS_API_KEY || '';
const VOICE    = () => process.env.GOOGLE_TTS_VOICE    || 'sv-SE-Neural2-A';
const LANGUAGE = () => process.env.GOOGLE_TTS_LANGUAGE || 'sv-SE';

async function warmup() {
  if (!API_KEY()) {
    console.warn('[TTS:google] GOOGLE_TTS_API_KEY saknas');
    return;
  }
  try {
    // Litet test-anrop för att verifiera nyckeln
    await _synthesize('Hej');
    console.log('[TTS:google] Redo — röst:', VOICE());
  } catch (err) {
    console.warn('[TTS:google] Warmup misslyckades:', err.message);
  }
}

function streamToWebSocket(text, telnyxWs) {
  let cancelled = false;
  let resolvedByteLength = 0;
  const start = Date.now();

  const promise = (async () => {
    if (!API_KEY()) {
      console.error('[TTS:google] GOOGLE_TTS_API_KEY saknas — sätt den i .env');
      return;
    }

    let mulaw;
    try {
      mulaw = await _synthesize(text);
    } catch (err) {
      console.error('[TTS:google] API-fel:', err.message);
      return;
    }

    if (cancelled) return;

    console.log(`[TTS:google] Ljud klart ${Date.now() - start}ms — ${mulaw.length}B`);

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

    console.log(`[TTS:google] Klart ${Date.now() - start}ms`);
  })();

  return {
    promise,
    cancel() { cancelled = true; },
    get byteLength() { return resolvedByteLength; },
  };
}

function _synthesize(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      input: { text },
      voice: { languageCode: LANGUAGE(), name: VOICE() },
      audioConfig: {
        audioEncoding: 'MULAW',
        sampleRateHertz: 8000,
      },
    });

    const options = {
      hostname: 'texttospeech.googleapis.com',
      path: `/v1/text:synthesize?key=${API_KEY()}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed;
        try { parsed = JSON.parse(raw); } catch (e) {
          return reject(new Error(`Ogiltigt JSON-svar: ${raw.slice(0, 200)}`));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Google TTS ${res.statusCode}: ${parsed?.error?.message || raw.slice(0, 200)}`));
        }
        if (!parsed.audioContent) {
          return reject(new Error('Google TTS: tomt audioContent'));
        }
        resolve(Buffer.from(parsed.audioContent, 'base64'));
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { streamToWebSocket, warmup };
