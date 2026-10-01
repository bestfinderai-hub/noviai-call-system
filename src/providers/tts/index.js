'use strict';

// TTS provider factory — selects implementation based on TTS_PROVIDER env var.
// Providers: edge (default/free), elevenlabs (~75ms, paid), cartesia (~60ms, paid)
//
// Interface every provider must export:
//   streamToWebSocket(text, telnyxWs) → { promise, cancel(), byteLength }
//   warmup() → Promise<void>

const { stripMarkdown } = require('../../services/speech');

const PROVIDERS = {
  edge:        () => require('./edge'),
  elevenlabs:  () => require('./elevenlabs'),
  cartesia:    () => require('./cartesia'),
};

function getProvider(name) {
  const key = (name || process.env.TTS_PROVIDER || 'edge').toLowerCase();
  const factory = PROVIDERS[key];
  if (!factory) {
    console.warn(`[TTS] Unknown provider "${key}" — falling back to edge`);
    return require('./edge');
  }
  return factory();
}

// Lazy-loaded singleton per provider name (avoids re-connecting on every call)
const _cache = {};

function provider(name) {
  const key = (name || process.env.TTS_PROVIDER || 'edge').toLowerCase();
  if (!_cache[key]) _cache[key] = getProvider(key);
  return _cache[key];
}

module.exports = {
  // Strip markdown universally before any provider sees the text.
  // SSML pause injection is provider-specific (edge.js adds <break> tags).
  streamToWebSocket: (text, ws, providerName) => {
    const clean = stripMarkdown(text);
    return provider(providerName).streamToWebSocket(clean, ws);
  },
  warmup: (providerName) => provider(providerName).warmup(),
  getProvider,
};
