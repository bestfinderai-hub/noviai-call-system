'use strict';

// Deepgram STT provider — nova-3 (~50ms, best accuracy for noisy calls)
// Requires: DEEPGRAM_API_KEY
// Pricing: ~$0.0043/min (Nova-3 streaming) — competitive with Groq
// Advantage over Groq: better noise handling, punctuation, disfluency removal

const API_KEY = () => process.env.DEEPGRAM_API_KEY;
const MODEL   = () => process.env.DEEPGRAM_STT_MODEL || 'nova-3';

async function transcribe(wavBuffer) {
  const key = API_KEY();
  if (!key) throw new Error('DEEPGRAM_API_KEY not set');

  const start = Date.now();
  const lang  = process.env.CALL_LANGUAGE || 'sv';

  const url = `https://api.deepgram.com/v1/listen?` + new URLSearchParams({
    model: MODEL(),
    language: lang,
    punctuate: 'true',
    smart_format: 'true',
    utterances: 'false',
    filler_words: 'false',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${key}`,
      'Content-Type': 'audio/wav',
    },
    body: wavBuffer,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Deepgram ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim();
  console.log(`[STT:deepgram] ${Date.now() - start}ms → "${text.slice(0, 80)}"`);
  return text;
}

module.exports = { transcribe };
