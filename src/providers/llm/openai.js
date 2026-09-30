'use strict';

// OpenAI-compatible LLM provider — works with OpenAI, DeepSeek, Groq (OpenAI mode), Ollama, etc.
// Config:
//   OPENAI_API_KEY     — API key
//   OPENAI_BASE_URL    — defaults to https://api.openai.com/v1
//   OPENAI_LLM_MODEL   — defaults to gpt-4o-mini
//
// Examples:
//   DeepSeek: OPENAI_BASE_URL=https://api.deepseek.com/v1  OPENAI_LLM_MODEL=deepseek-chat
//   Ollama:   OPENAI_BASE_URL=http://localhost:11434/v1     OPENAI_API_KEY=ollama

const fs = require('fs');

const BASE_URL   = () => (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MODEL      = () => process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';
const MAX_TOKENS = () => parseInt(process.env.MAX_TOKENS_LLM || '150', 10);
const API_KEY    = () => process.env.OPENAI_API_KEY || '';

let _cachedPrompt = null;

function clearPromptCache() { _cachedPrompt = null; }

function loadSystemPrompt() {
  if (_cachedPrompt) return _cachedPrompt;
  const file = process.env.SYSTEM_PROMPT_FILE;
  if (file && fs.existsSync(file)) {
    _cachedPrompt = fs.readFileSync(file, 'utf-8').trim();
    return _cachedPrompt;
  }
  if (process.env.SYSTEM_PROMPT) {
    _cachedPrompt = process.env.SYSTEM_PROMPT.trim();
    return _cachedPrompt;
  }
  _cachedPrompt = require('./groq').loadSystemPrompt();
  return _cachedPrompt;
}

async function _post(messages, stream) {
  const apiKey = API_KEY();
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch(`${BASE_URL()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL(),
      messages,
      max_tokens: MAX_TOKENS(),
      temperature: 0.7,
      stream,
    }),
    signal: AbortSignal.timeout(stream ? 60000 : 15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API (${res.status}): ${text.slice(0, 200)}`);
  }
  return res;
}

async function chat(history, systemPromptOverride) {
  const start = Date.now();
  const messages = [{ role: 'system', content: systemPromptOverride || loadSystemPrompt() }, ...history];
  const res  = await _post(messages, false);
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || '').trim();
  console.log(`[LLM:openai] ${MODEL()} ${Date.now() - start}ms → "${text.slice(0, 80)}"`);
  return text;
}

async function* chatStream(history, systemPromptOverride) {
  const messages = [{ role: 'system', content: systemPromptOverride || loadSystemPrompt() }, ...history];
  const start = Date.now();
  const res   = await _post(messages, true);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') break;
        try {
          const token = JSON.parse(data).choices?.[0]?.delta?.content || '';
          if (!token) continue;
          buf += token;
          let match;
          while ((match = /^(.*?[.!?])\s+/.exec(buf)) !== null) {
            const sentence = match[1].trim();
            if (sentence) yield sentence;
            buf = buf.slice(match[0].length);
          }
        } catch { /* skip malformed SSE line */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const tail = buf.trim();
  if (tail) yield tail;
  console.log(`[LLM:openai] ${MODEL()} stream ${Date.now() - start}ms`);
}

module.exports = { chat, chatStream, clearPromptCache, loadSystemPrompt };
