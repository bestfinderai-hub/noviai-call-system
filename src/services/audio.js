'use strict';

const alawmulaw = require('alawmulaw');

// Decode base64 mulaw chunks (Telnyx inbound) → WAV Buffer at 16kHz for Groq Whisper
function decodeMulawToWav(base64Chunks) {
  const combined = Buffer.concat(base64Chunks.map(b => Buffer.from(b, 'base64')));

  // alawmulaw.mulaw.decode: Buffer/Uint8Array → Int16Array (PCM16 at 8kHz)
  const pcm8k = alawmulaw.mulaw.decode(combined);

  // Upsample 8kHz → 16kHz (linear interpolation, good enough for speech)
  const pcm16k = upsample8to16(pcm8k);

  return buildWav(pcm16k, 16000);
}

// Calculate RMS energy of a base64 mulaw chunk — used for voice activity detection
function mulawEnergy(base64Chunk) {
  const raw = Buffer.from(base64Chunk, 'base64');
  const pcm = alawmulaw.mulaw.decode(raw);
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return sum / (pcm.length || 1);
}

// Simple linear upsampling: Int16Array 8kHz → Int16Array 16kHz
function upsample8to16(pcm8k) {
  const out = new Int16Array(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length; i++) {
    out[i * 2] = pcm8k[i];
    const next = i + 1 < pcm8k.length ? pcm8k[i + 1] : pcm8k[i];
    out[i * 2 + 1] = Math.round((pcm8k[i] + next) / 2);
  }
  return out;
}

// Build a valid WAV file from raw PCM16 samples
function buildWav(pcm16, sampleRate) {
  const numSamples = pcm16.length;
  const byteRate = sampleRate * 2; // 16-bit mono → 2 bytes/sample
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);     // PCM chunk size
  buf.writeUInt16LE(1, 20);      // PCM format
  buf.writeUInt16LE(1, 22);      // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(2, 32);      // block align (1 ch × 2 bytes)
  buf.writeUInt16LE(16, 34);     // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    buf.writeInt16LE(pcm16[i], 44 + i * 2);
  }

  return buf;
}

module.exports = { decodeMulawToWav, mulawEnergy };
