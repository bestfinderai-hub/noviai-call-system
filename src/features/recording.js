'use strict';

// Call recording — buffers inbound audio during a call, saves as WAV on cleanup.
//
// Storage options (set via env):
//   Local:  RECORDINGS_DIR=./recordings  (default, always works)
//   MEGA:   MEGA_EMAIL + MEGA_PASSWORD   (20 GB free, no credit card — mega.nz)
//
// Enable: RECORDING_ENABLED=true  (default: false — opt-in)
//
// Files are named: novai_YYYY-MM-DD_call_<id8>_<timestamp>.wav

const fs   = require('fs');
const path = require('path');
const { decodeMulawToWav } = require('../services/audio');

const RECORDINGS_DIR = () => process.env.RECORDINGS_DIR || path.join(process.cwd(), 'recordings');

// ── Local storage ─────────────────────────────────────────────────────────────

async function saveLocalRecording(wavBuffer, callId) {
  const dateDir  = new Date().toISOString().slice(0, 10);
  const dir      = path.join(RECORDINGS_DIR(), dateDir);
  const filename = `call_${callId.slice(-8)}_${Date.now()}.wav`;
  const filepath = path.join(dir, filename);

  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filepath, wavBuffer);
  return filepath;
}

// ── MEGA cloud storage (20 GB free, no credit card) ───────────────────────────

async function uploadToMega(wavBuffer, callId) {
  const email    = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;
  if (!email || !password) return null;

  const { Storage } = require('megajs');
  const storage = new Storage({ email, password });
  await storage.ready;

  const dateDir  = new Date().toISOString().slice(0, 10);
  const filename = `novai_${dateDir}_call_${callId.slice(-8)}_${Date.now()}.wav`;

  const file = await storage.upload({ name: filename }, wavBuffer).complete;
  const url  = await file.link();
  return url;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Convert audio chunks to WAV and save to local disk + optional MEGA cloud.
 * @param {string[]} audioChunks  — base64-encoded mulaw chunks
 * @param {string}   callId       — Telnyx call_control_id
 * @returns {Promise<string|null>} — URL or local path, or null if disabled/failed
 */
async function saveRecording(audioChunks, callId) {
  if (process.env.RECORDING_ENABLED !== 'true') return null;
  if (!audioChunks || audioChunks.length < 10) return null;

  try {
    const wavBuffer = decodeMulawToWav(audioChunks);

    if (process.env.MEGA_EMAIL && process.env.MEGA_PASSWORD) {
      try {
        const url = await uploadToMega(wavBuffer, callId);
        if (url) {
          console.log(`[Recording] Uploaded to MEGA: ${url}`);
          return url;
        }
      } catch (err) {
        console.warn('[Recording] MEGA upload failed, falling back to local:', err.message);
      }
    }

    const localPath = await saveLocalRecording(wavBuffer, callId);
    console.log(`[Recording] Saved locally: ${localPath} (${Math.round(wavBuffer.length / 1024)} KB)`);
    return localPath;

  } catch (err) {
    console.error('[Recording] Failed:', err.message);
    return null;
  }
}

module.exports = { saveRecording };
