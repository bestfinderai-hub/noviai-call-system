#!/usr/bin/env node
// Quick TTS test — generate and save audio without a full server.
// Usage: node scripts/test-tts.js "Hej, detta är ett test"
'use strict';

require('dotenv').config();

const fs = require('fs');
const { generateMulaw } = require('../src/services/tts');

const text = process.argv[2] || 'NovAI, det här är Sofia, hur kan jag hjälpa dig?';

console.log(`Generating TTS for: "${text}"`);
const start = Date.now();

generateMulaw(text).then(buf => {
  const out = 'test-output/tts-test.mulaw';
  if (!fs.existsSync('test-output')) fs.mkdirSync('test-output');
  fs.writeFileSync(out, buf);
  console.log(`✓ Done in ${Date.now() - start}ms — ${buf.length} bytes`);
  console.log(`\nPlay with: ffplay -f mulaw -ar 8000 -ac 1 ${out}`);
}).catch(err => {
  console.error('❌ TTS failed:', err.message);
  process.exit(1);
});
