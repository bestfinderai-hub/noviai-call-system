'use strict';

// Google Cloud Text-to-Speech provider
// Default: sv-SE-Wavenet-D — MULAW direkt, ingen ffmpeg, bevisad svensk kvalitet
// SSML: naturliga pauser injiceras automatiskt för mer naturligt tal
// Chirp3-HD: stöds om GOOGLE_TTS_VOICE=sv-SE-Chirp3-HD-Aoede (kräver ffmpeg)
//
// Env-vars:
//   GOOGLE_TTS_API_KEY  = API-nyckel från Google Cloud Console
//   GOOGLE_TTS_VOICE    = sv-SE-Wavenet-D (default)
//   GOOGLE_TTS_LANGUAGE = sv-SE (default)

const https      = require('https');
const { spawn }  = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const WebSocket  = require('ws');

const API_KEY  = () => process.env.GOOGLE_TTS_API_KEY  || '';
const VOICE    = () => process.env.GOOGLE_TTS_VOICE    || 'sv-SE-Wavenet-D';
const LANGUAGE = () => process.env.GOOGLE_TTS_LANGUAGE || 'sv-SE';
const isChirp3HD = () => VOICE().includes('Chirp3-HD');

// ── Text preprocessing ────────────────────────────────────────────────────────

function cleanText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'länk')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    // Brand name pronunciation: NovAI / NoviAi → Novi AI (two syllables + letters)
    .replace(/NoviAi|NovAI/g, 'Novi AI')
    .trim();
}

function escapeXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function addNaturalPauses(text) {
  let t = escapeXml(text);
  t = t.replace(/\.\.\./g,         '<break time="600ms"/>');
  t = t.replace(/\s*—\s*/g,        '<break time="250ms"/> ');
  t = t.replace(/([.!?])(\s+)(?=[A-ZÅÄÖ"]|$)/g, '$1<break time="350ms"/> ');
  t = t.replace(/,\s+/g,           ',<break time="150ms"/> ');
  t = t.replace(/;\s+/g,           ';<break time="200ms"/> ');
  t = t.replace(/:\s+/g,           ':<break time="200ms"/> ');
  return `<speak>${t}</speak>`;
}

// ── Warmup ────────────────────────────────────────────────────────────────────

async function warmup() {
  if (!API_KEY()) { console.warn('[TTS:google] GOOGLE_TTS_API_KEY saknas'); return; }
  try {
    await _synthesize('Hej', isChirp3HD() ? 'LINEAR16' : 'MULAW', false);
    console.log('[TTS:google] Redo — röst:', VOICE());
  } catch (err) {
    console.warn('[TTS:google] Warmup misslyckades:', err.message);
  }
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

function _mediaMsg(ws, payloadB64) {
  const msg = { event: 'media', media: { payload: payloadB64 } };
  return JSON.stringify(msg);
}

function _markMsg(ws, name) {
  const msg = { event: 'mark', mark: { name } };
  return JSON.stringify(msg);
}

function _streamMulawToWs(mulaw, ws, cancelRef, bytes) {
  for (let i = 0; i < mulaw.length; i += 160) {
    if (cancelRef() || ws.readyState !== WebSocket.OPEN) break;
    const chunk = mulaw.slice(i, Math.min(i + 160, mulaw.length));
    bytes.value += chunk.length;
    ws.send(_mediaMsg(ws, chunk.toString('base64')));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function streamToWebSocket(text, telnyxWs) {
  let cancelled = false;
  const bytes = { value: 0 };
  const start = Date.now();

  const promise = (async () => {
    if (!API_KEY()) { console.error('[TTS:google] GOOGLE_TTS_API_KEY saknas'); return; }

    const cleaned = cleanText(text);

    // Chirp3-HD: request LINEAR16 at native 24kHz, convert to MULAW via ffmpeg.
    // Google's internal MULAW/8kHz downsampler for Chirp3-HD is low quality ("tin can").
    // Wavenet/Standard: MULAW direct from Google is fine — no ffmpeg needed.
    if (isChirp3HD()) {
      let pcm;
      try { pcm = await _synthesize(cleaned, 'LINEAR16', false); }
      catch (err) { console.error('[TTS:google] Chirp3-HD API-fel:', err.message); return; }
      if (cancelled) return;
      console.log(`[TTS:google] Chirp3-HD LINEAR16 ${Date.now()-start}ms ${pcm.length}B → ffmpeg`);

      await new Promise((resolve, reject) => {
        const ff = spawn(ffmpegPath, [
          '-hide_banner', '-loglevel', 'error',
          '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0',
          '-af', 'highpass=f=200,lowpass=f=3400:poles=2',
          '-f', 'mulaw', '-ar', '8000', '-ac', '1',
          'pipe:1',
        ]);
        ff.on('error', reject);
        ff.stderr.on('data', d => { const s = d.toString().trim(); if (s) console.warn('[TTS:google] ffmpeg:', s); });
        ff.stdout.on('data', chunk => {
          if (cancelled) return;
          bytes.value += chunk.length;
          if (telnyxWs.readyState !== WebSocket.OPEN) return;
          for (let i = 0; i < chunk.length; i += 160) {
            if (cancelled || telnyxWs.readyState !== WebSocket.OPEN) break;
            telnyxWs.send(_mediaMsg(telnyxWs, chunk.slice(i, Math.min(i + 160, chunk.length)).toString('base64')));
          }
        });
        ff.on('close', () => {
          console.log(`[TTS:google] Chirp3-HD klart ${Date.now()-start}ms mulaw=${bytes.value}B`);
          if (!cancelled && telnyxWs.readyState === WebSocket.OPEN)
            telnyxWs.send(_markMsg(telnyxWs, 'tts_end'));
          resolve();
        });
        ff.stdin.write(pcm);
        ff.stdin.end();
      });

    } else {
      // Wavenet/Standard: MULAW direkt från Google API — ingen ffmpeg
      let mulaw;
      try { mulaw = await _synthesize(cleaned, 'MULAW', false); }
      catch (err) { console.error('[TTS:google] API-fel:', err.message); return; }
      if (cancelled) return;
      console.log(`[TTS:google] ${VOICE()} ${Date.now()-start}ms ${mulaw.length}B`);
      _streamMulawToWs(mulaw, telnyxWs, () => cancelled, bytes);
      if (!cancelled && telnyxWs.readyState === WebSocket.OPEN)
        telnyxWs.send(_markMsg(telnyxWs, 'tts_end'));
    }
  })();

  return {
    promise,
    cancel() { cancelled = true; },
    get byteLength() { return bytes.value; },
  };
}

// ── Synthesize ────────────────────────────────────────────────────────────────

function _synthesize(text, encoding, useSsml) {
  return new Promise((resolve, reject) => {
    const ssml = useSsml ? addNaturalPauses(text) : null;

    const audioConfig =
      encoding === 'MULAW'    ? { audioEncoding: 'MULAW',    sampleRateHertz: 8000  } :
      encoding === 'LINEAR16' ? { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 } :
                                { audioEncoding: 'MP3' };

    const body = JSON.stringify({
      input: ssml ? { ssml } : { text },
      voice: { languageCode: LANGUAGE(), name: VOICE() },
      audioConfig,
    });

    const options = {
      hostname: 'texttospeech.googleapis.com',
      path:     `/v1/text:synthesize?key=${API_KEY()}`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed;
        try { parsed = JSON.parse(raw); } catch {
          return reject(new Error(`Ogiltigt JSON: ${raw.slice(0, 200)}`));
        }
        if (res.statusCode !== 200)
          return reject(new Error(`Google TTS ${res.statusCode}: ${parsed?.error?.message || raw.slice(0, 200)}`));
        if (!parsed.audioContent)
          return reject(new Error('Google TTS: tomt audioContent'));
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
