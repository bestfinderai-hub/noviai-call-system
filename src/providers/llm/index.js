'use strict';

// LLM provider factory — selects implementation based on LLM_PROVIDER env var.
// Providers: groq (default)
// Extend: add anthropic.js, openai.js, deepseek.js as needed.
//
// Interface every provider must export:
//   chat(history, systemPromptOverride?) → Promise<string>
//   chatStream(history, systemPromptOverride?) → AsyncGenerator<string>
//   classifyIntent(transcript) → Promise<string>

const PROVIDERS = {
  groq: () => require('./groq'),
};

function getProvider(name) {
  const key = (name || process.env.LLM_PROVIDER || 'groq').toLowerCase();
  const factory = PROVIDERS[key];
  if (!factory) {
    console.warn(`[LLM] Unknown provider "${key}" — falling back to groq`);
    return require('./groq');
  }
  return factory();
}

const _cache = {};

function provider(name) {
  const key = (name || process.env.LLM_PROVIDER || 'groq').toLowerCase();
  if (!_cache[key]) _cache[key] = getProvider(key);
  return _cache[key];
}

module.exports = {
  chat:             (history, sysp, name) => provider(name).chat(history, sysp),
  chatStream:       (history, sysp, name) => provider(name).chatStream(history, sysp),
  classifyIntent:   (t, name)             => provider(name).classifyIntent(t),
  clearPromptCache: (name)                => provider(name).clearPromptCache?.(),
  loadSystemPrompt: (name)                => provider(name).loadSystemPrompt?.() ?? '',
  getProvider,
};
