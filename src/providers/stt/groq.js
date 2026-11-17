'use strict';

// Groq STT provider — Whisper large-v3-turbo (~50-80ms, 8x faster than v3)
// Requires: GROQ_API_KEY

const Groq = require('groq-sdk');
const { toFile } = require('groq-sdk');

let _groq;
function groq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

const MODEL = () => process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';

async function transcribe(wavBuffer) {
  const start = Date.now();
  const file = await toFile(wavBuffer, 'audio.wav', { type: 'audio/wav' });

  const result = await groq().audio.transcriptions.create({
    file,
    model: MODEL(),
    language: process.env.CALL_LANGUAGE || 'sv',
    response_format: 'json',
    temperature: 0,
  });

  const text = (result.text || '').trim();
  console.log(`[STT:groq] ${Date.now() - start}ms → "${text.slice(0, 80)}"`);
  return text;
}

module.exports = { transcribe };
