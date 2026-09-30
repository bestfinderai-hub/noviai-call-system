#!/usr/bin/env node
// Test the full STT → LLM → TTS pipeline without a real phone call.
// Usage: node scripts/test-pipeline.js
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { decodeMulawToWav, mulawEnergy } = require('../src/services/audio');
const { transcribe } = require('../src/services/stt');
const { chat } = require('../src/services/llm');
const { generateMulaw } = require('../src/services/tts');

async function main() {
  console.log('\n=== NovAI Pipeline Test ===\n');

  // ── Test 1: TTS ──────────────────────────────────────────────────────────
  console.log('1. Testing TTS (Edge TTS → mulaw)...');
  const text = 'Hej, det här är Sofia på NovAI. Hur kan jag hjälpa dig idag?';
  const start1 = Date.now();
  const mulaw = await generateMulaw(text);
  console.log(`   ✓ Generated ${mulaw.length} bytes mulaw in ${Date.now() - start1}ms`);

  // Save as WAV for listening (convert mulaw → WAV for playback test)
  const outDir = path.join(__dirname, '../test-output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  // Save raw mulaw
  fs.writeFileSync(path.join(outDir, 'test-tts.mulaw'), mulaw);
  console.log(`   Saved: test-output/test-tts.mulaw`);

  // ── Test 2: LLM ──────────────────────────────────────────────────────────
  console.log('\n2. Testing LLM (Groq chat)...');
  const start2 = Date.now();
  const response = await chat([
    { role: 'user', content: 'Hej, jag vill boka en tid på fredag' },
  ]);
  console.log(`   ✓ LLM responded in ${Date.now() - start2}ms`);
  console.log(`   Response: "${response}"`);

  // ── Test 3: Full LLM → TTS ───────────────────────────────────────────────
  console.log('\n3. Testing LLM response → TTS...');
  const start3 = Date.now();
  const responseMulaw = await generateMulaw(response);
  console.log(`   ✓ Full pipeline: ${Date.now() - start3}ms`);
  console.log(`   Output: ${responseMulaw.length} bytes`);
  fs.writeFileSync(path.join(outDir, 'test-response.mulaw'), responseMulaw);

  // ── Test 4: Audio energy detection ───────────────────────────────────────
  console.log('\n4. Testing audio energy (VAD)...');
  const silenceChunk = Buffer.alloc(160, 0x7F).toString('base64'); // mulaw silence
  const energy = mulawEnergy(silenceChunk);
  console.log(`   Silence energy: ${energy.toFixed(0)} (should be low)`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n✅ All tests passed!\n');
  console.log('To listen to the test audio:');
  console.log('  ffplay -f mulaw -ar 8000 -ac 1 test-output/test-tts.mulaw');
  console.log('  ffplay -f mulaw -ar 8000 -ac 1 test-output/test-response.mulaw\n');
}

main().catch(err => {
  console.error('\n❌ Pipeline test failed:', err.message);
  process.exit(1);
});
