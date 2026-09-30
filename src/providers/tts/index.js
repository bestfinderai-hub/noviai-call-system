'use strict';

// TTS provider factory — selects implementation based on TTS_PROVIDER env var.
// Providers: edge (default/free), elevenlabs (~75ms, paid), cartesia (~60ms, paid)
//
// Per-account/project override: pass { ttsProvider } in providerConfig to CallSession (TODO v2).
// For now, env-var-based switching covers most use cases.
//
// Interface every provider must export:
//   streamToWebSocket(text, telnyxWs) → { promise, cancel(), byteLength }
//   warmup() → Promise<void>

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
  streamToWebSocket: (text, ws, providerName) => provider(providerName).streamToWebSocket(text, ws),
  warmup: (providerName) => provider(providerName).warmup(),
  getProvider,
};
