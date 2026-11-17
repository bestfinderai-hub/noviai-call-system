'use strict';

// Thin wrapper — delegates to the active STT provider.
// Set STT_PROVIDER=groq|deepgram in .env (default: groq).
module.exports = require('../providers/stt');
