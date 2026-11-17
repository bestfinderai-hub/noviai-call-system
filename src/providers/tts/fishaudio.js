'use strict';

// Fish Audio TTS — S2.1-Pro, ~100 languages incl. Swedish, voice cloning
// POST https://api.fish.audio/v1/tts → MP3 → mulaw 8kHz via ffmpeg

const { spawn }  = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const WebSocket  = require('ws');

const API_KEY    = () => process.env.FISH_AUDIO_API_KEY;
const MODEL      = () => process.env.FISH_AUDIO_MODEL      || 's2.1-pro-free';
const VOICE_ID   = () => process.env.FISH_AUDIO_VOICE_ID   || null;  // null = model default
const TIMEOUT_MS = () => parseInt(process.env.FISH_AUDIO_TIMEOUT_MS || '15000', 10);

async function _fetchMp3(text) {
  const body = { text, format: 'mp3', latency: 'normal' };
  if (VOICE_ID()) body.reference_id = VOICE_ID();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS());

  let res;
  try {
    res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY()}`,
        'Content-Type': 'application/json',
        'model': MODEL(),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => res.status);
    throw new Error(`Fish Audio ${res.status}: ${msg}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function warmup() {
  if (!API_KEY()) {
    console.warn('[TTS:fishaudio] FISH_AUDIO_API_KEY saknas — provider inaktiv');
    return;
  }
  console.log('[TTS:fishaudio] Redo — model:', MODEL(), '| voice_id:', VOICE_ID() || '(default)');
}

function streamToWebSocket(text, telnyxWs) {
  let cancelled = false;
  let resolvedByteLength = 0;
  const start = Date.now();

  const promise = (async () => {
    if (!API_KEY()) throw new Error('FISH_AUDIO_API_KEY saknas');

    console.log(`[TTS:fishaudio] Syntetiserar (${text.length} tecken): "${text.slice(0, 60)}"`);

    let mp3;
    try {
      mp3 = await _fetchMp3(text);
    } catch (err) {
      console.error('[TTS:fishaudio] API-fel:', err.message);
      throw err;
    }

    if (cancelled) return;
    console.log(`[TTS:fishaudio] MP3 mottagen (${mp3.length} B, ${Date.now() - start}ms) — konverterar`);

    // MP3 → mulaw 8kHz mono via ffmpeg
    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error',
        '-i', 'pipe:0',
        '-f', 'mulaw', '-ar', '8000', '-ac', '1',
        'pipe:1',
      ]);

      ff.on('error', err => {
        console.error('[TTS:fishaudio] ffmpeg spawn error:', err.message);
        reject(err);
      });

      ff.stderr.on('data', d => {
        const s = d.toString().trim();
        if (s) console.warn('[TTS:fishaudio] ffmpeg:', s);
      });

      ff.stdout.on('data', chunk => {
        if (cancelled) return;
        resolvedByteLength += chunk.length;
        if (telnyxWs.readyState !== WebSocket.OPEN) return;

        for (let i = 0; i < chunk.length; i += 160) {
          if (cancelled || telnyxWs.readyState !== WebSocket.OPEN) break;
          const mediaMsg = {
            event: 'media',
            media: { payload: chunk.slice(i, Math.min(i + 160, chunk.length)).toString('base64') },
          };
          telnyxWs.send(JSON.stringify(mediaMsg));
        }
      });

      ff.on('close', code => {
        const ms = Date.now() - start;
        console.log(`[TTS:fishaudio] Klar — ffmpeg=${code} mulaw=${resolvedByteLength}B tid=${ms}ms`);
        if (!cancelled && telnyxWs.readyState === WebSocket.OPEN) {
          const markMsg = { event: 'mark', mark: { name: 'tts_end' } };
          telnyxWs.send(JSON.stringify(markMsg));
        }
        resolve();
      });

      ff.stdin.write(mp3);
      ff.stdin.end();
    });
  })();

  return {
    promise,
    cancel() { cancelled = true; console.log('[TTS:fishaudio] Avbruten'); },
    get byteLength() { return resolvedByteLength; },
  };
}

module.exports = { streamToWebSocket, warmup };
