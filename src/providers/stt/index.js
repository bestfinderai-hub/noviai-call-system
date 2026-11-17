'use strict';

// STT provider factory — selects implementation based on STT_PROVIDER env var.
// Providers: groq (default/free), deepgram (nova-3, paid, better noise handling)
//
// Interface every provider must export:
//   transcribe(wavBuffer) → Promise<string>

const PROVIDERS = {
  groq:     () => require('./groq'),
  deepgram: () => require('./deepgram'),
};

function getProvider(name) {
  const key = (name || process.env.STT_PROVIDER || 'groq').toLowerCase();
  const factory = PROVIDERS[key];
  if (!factory) {
    console.warn(`[STT] Unknown provider "${key}" — falling back to groq`);
    return require('./groq');
  }
  return factory();
}

const _cache = {};

function provider(name) {
  const key = (name || process.env.STT_PROVIDER || 'groq').toLowerCase();
  if (!_cache[key]) _cache[key] = getProvider(key);
  return _cache[key];
}

module.exports = {
  transcribe: (wavBuffer, providerName) => provider(providerName).transcribe(wavBuffer),
  getProvider,
};
