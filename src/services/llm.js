'use strict';

// Thin wrapper — delegates to the active LLM provider.
// Set LLM_PROVIDER=groq in .env (default: groq).
module.exports = require('../providers/llm');
