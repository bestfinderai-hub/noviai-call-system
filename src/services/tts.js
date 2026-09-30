'use strict';

// Thin wrapper — delegates to the active TTS provider.
// Set TTS_PROVIDER=edge|elevenlabs|cartesia in .env (default: edge).
module.exports = require('../providers/tts');
