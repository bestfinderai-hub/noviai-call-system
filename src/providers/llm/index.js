'use strict';

// LLM provider factory — selects implementation based on LLM_PROVIDER env var.
// Providers: groq (default), openai (OpenAI-compatible)
//
// Fallback: set LLM_FALLBACK_PROVIDER to automatically retry on primary failure.
// Example: LLM_PROVIDER=groq  LLM_FALLBACK_PROVIDER=openai
//
// Interface every provider must export:
//   chat(history, systemPromptOverride?) → Promise<string>
//   chatStream(history, systemPromptOverride?) → AsyncGenerator<string>

const PROVIDERS = {
  groq:   () => require('./groq'),
  openai: () => require('./openai'),
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

// ── Fallback wrappers ─────────────────────────────────────────────────────────

async function chatWithFallback(history, sysp) {
  try {
    return await provider().chat(history, sysp);
  } catch (err) {
    const fb = process.env.LLM_FALLBACK_PROVIDER;
    if (!fb) throw err;
    console.warn(`[LLM] Primary failed (${err.message.slice(0, 80)}) — retrying with ${fb}`);
    return getProvider(fb).chat(history, sysp);
  }
}

async function* chatStreamWithFallback(history, sysp) {
  let yielded = false;
  try {
    for await (const token of provider().chatStream(history, sysp)) {
      yielded = true;
      yield token;
    }
  } catch (err) {
    const fb = process.env.LLM_FALLBACK_PROVIDER;
    if (!fb || yielded) throw err; // can't retry mid-stream
    console.warn(`[LLM] Primary stream failed (${err.message.slice(0, 80)}) — retrying with ${fb}`);
    yield* getProvider(fb).chatStream(history, sysp);
  }
}

module.exports = {
  chat:             chatWithFallback,
  chatStream:       chatStreamWithFallback,
  clearPromptCache: (name) => provider(name).clearPromptCache?.(),
  loadSystemPrompt: (name) => provider(name).loadSystemPrompt?.() ?? '',
  getProvider,
  PROVIDERS: Object.keys(PROVIDERS),
};
