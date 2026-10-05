'use strict';

// Edge TTS via msedge-tts npm package — MP3 output, converted to mulaw via ffmpeg

const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { spawn }    = require('child_process');
const ffmpegPath   = require('ffmpeg-static');
const WebSocket    = require('ws');

const VOICE  = () => process.env.TTS_VOICE  || 'sv-SE-SofieNeural';
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;

let _tts = null;
let _activeVoice = null;

async function _ensureReady() {
  const voice = VOICE();
  // Re-init if voice changed at runtime (e.g. via admin API PATCH /admin/settings)
  if (_tts && _activeVoice === voice) return _tts;
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, FORMAT, {});
  _tts = tts;
  _activeVoice = voice;
  console.log('[TTS:edge] Ready — voice:', voice, '| ffmpeg:', ffmpegPath);
  return tts;
}

async function warmup() {
  try {
    await _ensureReady();
    console.log('[TTS:edge] Pre-warmed');
  } catch (err) {
    _tts = null;
    console.warn('[TTS:edge] Pre-warm failed:', err.message);
  }
}

let _synthQueue = Promise.resolve();

function streamToWebSocket(text, telnyxWs) {
  let cancelled = false;
  let resolvedByteLength = 0;
  const start = Date.now();

  const prev = _synthQueue;
  const promise = (async () => {
    await prev;
    if (cancelled) return;

    // Plain text — no SSML. Edge TTS's own prosody model handles pauses better than
    // injected <break> tags, which tend to make speech sound more robotic.
    const prepared = text;
    console.log(`[TTS:edge] Synthesizing (${prepared.length} chars): "${text.slice(0, 60)}"`);

    // ── 1. Ensure TTS is ready ─────────────────────────────────────────────────
    let tts;
    try {
      tts = await _ensureReady();
    } catch (err) {
      _tts = null;
      console.error('[TTS:edge] Init failed:', err.message);
      throw err;
    }
    if (cancelled) return;

    // ── 2. Spawn ffmpeg: MP3 → raw mulaw 8 kHz mono ───────────────────────────
    // AMBIENT_NOISE=true adds very faint pink noise (~-34 dB) to simulate an
    // office environment — makes the AI sound less "studio perfect" on cold calls.
    const ambientFilter = process.env.AMBIENT_NOISE === 'true'
      ? 'highpass=f=200,lowpass=f=3400,volume=1.3,aeval=\'val(0)+0.006*random(0)\':c=same'
      : 'highpass=f=200,lowpass=f=3400,volume=1.3';

    const ff = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-af', ambientFilter,
      '-f', 'mulaw', '-ar', '8000', '-ac', '1',
      'pipe:1',
    ]);

    ff.on('error', err => {
      console.error('[TTS:edge] ffmpeg spawn error:', err.message, '| binary:', ffmpegPath || '(null)');
    });

    ff.stderr.on('data', d => {
      const s = d.toString().trim();
      if (s) console.warn('[TTS:edge] ffmpeg stderr:', s);
    });

    ff.stdout.on('data', chunk => {
      if (cancelled) return;
      resolvedByteLength += chunk.length;
      if (telnyxWs.readyState !== WebSocket.OPEN) return;

      // Send 160-byte mulaw packets (20 ms @ 8 kHz)
      for (let i = 0; i < chunk.length; i += 160) {
        if (cancelled || telnyxWs.readyState !== WebSocket.OPEN) break;
        telnyxWs.send(JSON.stringify({
          event: 'media',
          media: { payload: chunk.slice(i, Math.min(i + 160, chunk.length)).toString('base64') },
        }));
      }
    });

    // ── 3. Request synthesis and pipe MP3 into ffmpeg ─────────────────────────
    await new Promise((resolve, reject) => {
      // Hard timeout: Edge TTS should never take >12 s for a short reply
      const synthTimeout = setTimeout(() => {
        try { ff.kill(); } catch {}
        reject(new Error('TTS synthesis timeout (12 s)'));
      }, 12_000);

      let audioStream;
      try {
        const result = tts.toStream(prepared);
        audioStream = result.audioStream;
      } catch (err) {
        _tts = null;
        clearTimeout(synthTimeout);
        try { ff.kill(); } catch {}
        return reject(err);
      }

      let mp3Bytes = 0;

      audioStream.on('data', mp3 => {
        if (cancelled) return;
        mp3Bytes += mp3.length;
        try { ff.stdin.write(mp3); } catch {}
      });

      audioStream.on('end', () => {
        console.log(`[TTS:edge] MP3 done (${mp3Bytes} B) — closing ffmpeg stdin`);
        clearTimeout(synthTimeout);
        try { ff.stdin.end(); } catch {}
      });

      audioStream.on('error', err => {
        _tts = null;
        clearTimeout(synthTimeout);
        console.error('[TTS:edge] Audio stream error:', err.message);
        try { ff.kill(); } catch {}
        reject(err);
      });

      ff.on('close', code => {
        const ms = Date.now() - start;
        console.log(`[TTS:edge] Done — ffmpeg=${code} mp3=${mp3Bytes}B mulaw=${resolvedByteLength}B time=${ms}ms`);

        if (!cancelled && telnyxWs.readyState === WebSocket.OPEN) {
          telnyxWs.send(JSON.stringify({ event: 'mark', mark: { name: 'tts_end' } }));
        }
        resolve();
      });
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
