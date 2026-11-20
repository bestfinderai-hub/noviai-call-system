'use strict';

// Pre-generates short Swedish backchannel phrases as mulaw 8 kHz audio so they
// can be injected instantly (< 5 ms) during LLM processing to mask latency.
//
// Phrases are neutral/time-buying — no semantic contradiction with LLM output.
// No mark event is sent; the audio plays transparently before the main response.

const { spawn }    = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const ffmpegPath   = require('ffmpeg-static');
const WebSocket    = require('ws');

// Neutral phrases: nothing that implies understanding/agreement with unknown LLM content
const PHRASES = ['mm.', 'jaa.', 'okej.', 'ett ögonblick.', 'låt mig tänka.'];

const CACHE = new Map(); // phrase → Buffer (raw mulaw bytes)
let _ready  = false;

function _voice() {
  return process.env.TTS_VOICE || 'sv-SE-SofieNeural';
}

async function _generateMulaw(phrase) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(_voice(), OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {});

  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-f', 'mulaw', '-ar', '8000', '-ac', '1',
      'pipe:1',
    ]);

    const chunks = [];
    ff.stdout.on('data', data => chunks.push(Buffer.from(data)));
    ff.stderr.on('data', () => {}); // suppress stderr noise

    ff.on('close', code => {
      const buf = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
      if (buf.length > 0) resolve(buf);
      else reject(new Error(`ffmpeg exited ${code} with 0 bytes`));
    });
    ff.on('error', reject);

    const { audioStream } = tts.toStream(phrase);
    audioStream.on('data', mp3 => { try { ff.stdin.write(mp3); } catch {} });
    audioStream.on('end',  ()  => { try { ff.stdin.end();  } catch {} });
    audioStream.on('error', err => {
      try { ff.kill(); } catch {}
      reject(err);
    });
  });
}

// Kick off pre-generation at module load — runs once, results cached for session lifetime
const _initPromise = (async () => {
  for (const phrase of PHRASES) {
    try {
      const mulaw = await _generateMulaw(phrase);
      CACHE.set(phrase, mulaw);
    } catch (err) {
      console.warn(`[Backchannel] Pre-gen failed for "${phrase}":`, err.message);
    }
  }
  _ready = CACHE.size > 0;
  if (_ready) {
    console.log(`[Backchannel] Ready — ${CACHE.size}/${PHRASES.length} phrases pre-generated`);
  } else {
    console.warn('[Backchannel] All pre-gen failed — backchannels disabled');
  }
})();

/**
 * Inject a random backchannel phrase into the Telnyx WebSocket.
 * Sends pre-generated mulaw directly in 160-byte packets (20 ms @ 8 kHz).
 * Does NOT send a mark event — no state machine interference.
 * Returns true on success, false if not ready or ws closed.
 */
function injectBackchannel(ws) {
  if (!_ready || ws.readyState !== WebSocket.OPEN) return false;

  const phrases = [...CACHE.keys()];
  const phrase  = phrases[Math.floor(Math.random() * phrases.length)];
  const mulaw   = CACHE.get(phrase);
  if (!mulaw) return false;

  for (let i = 0; i < mulaw.length; i += 160) {
    if (ws.readyState !== WebSocket.OPEN) break;
    ws.send(JSON.stringify({
      event: 'media',
      media: { payload: mulaw.slice(i, Math.min(i + 160, mulaw.length)).toString('base64') },
    }));
  }

  console.log(`[Backchannel] Injected "${phrase}" (${mulaw.length}B mulaw)`);
  return true;
}

/** Resolves when all pre-generation is done (success or graceful failure). */
async function waitReady() { return _initPromise; }

module.exports = { injectBackchannel, waitReady };
