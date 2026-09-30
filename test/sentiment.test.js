'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

// Mock LLM to avoid real API calls
const llmModule = require('../src/services/llm');
let originalChat;
before(() => {
  originalChat = llmModule.chat;
});
after(() => {
  llmModule.chat = originalChat;
});

const { classifySentiment, SENTIMENT_LABELS } = require('../src/features/sentiment');

test('SENTIMENT_LABELS contains expected values', () => {
  assert.ok(SENTIMENT_LABELS.includes('positiv'));
  assert.ok(SENTIMENT_LABELS.includes('negativ'));
  assert.ok(SENTIMENT_LABELS.includes('neutral'));
  assert.ok(SENTIMENT_LABELS.includes('intresserad'));
  assert.ok(SENTIMENT_LABELS.includes('avvisande'));
});

test('returns neutral for empty text', async () => {
  const result = await classifySentiment('');
  assert.equal(result, 'neutral');
});

test('returns neutral for system messages (starting with [)', async () => {
  const result = await classifySentiment('[Kunden tryckte siffra: 1]');
  assert.equal(result, 'neutral');
});

test('returns neutral when SENTIMENT_ENABLED=false', async () => {
  process.env.SENTIMENT_ENABLED = 'false';
  const result = await classifySentiment('Jag är mycket intresserad!');
  assert.equal(result, 'neutral');
  delete process.env.SENTIMENT_ENABLED;
});

test('returns valid label from LLM response', async () => {
  llmModule.chat = async () => 'positiv';
  const result = await classifySentiment('Det låter jättebra!');
  assert.ok(SENTIMENT_LABELS.includes(result));
});

test('returns neutral when LLM returns unknown label', async () => {
  llmModule.chat = async () => 'glad';
  const result = await classifySentiment('Hej hej!');
  assert.equal(result, 'neutral');
});

test('returns neutral when LLM throws', async () => {
  llmModule.chat = async () => { throw new Error('LLM offline'); };
  const result = await classifySentiment('Test text');
  assert.equal(result, 'neutral');
});
