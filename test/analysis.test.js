'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'test-key';

// Test parseAnalysisResponse directly (exported for testing)
// We test the parser without calling the LLM.

const { analyzeCall } = require('../src/features/analysis');

// Mock the chat function to avoid real API calls
const llm = require('../src/providers/llm');
const originalChat = llm.chat;

function mockChat(fn) {
  // Monkey-patch for test — restore after
  const orig = require('../src/providers/llm/groq').chat;
  // We need to patch the module cache
  const groq = require('../src/providers/llm/groq');
  groq._origChat = groq.chat;
  groq.chat = fn;
  return () => { groq.chat = groq._origChat; };
}

// ── analyzeCall ────────────────────────────────────────────────────────────────

test('analyzeCall returns null for empty history', async () => {
  const result = await analyzeCall([]);
  assert.equal(result, null);
});

test('analyzeCall returns null for very short history', async () => {
  const result = await analyzeCall([{ role: 'user', content: 'Hej' }]);
  assert.equal(result, null);
});

test('analyzeCall returns null when analysis is disabled', async () => {
  // No NOVA_ANALYSIS_SCHEMA, no NOVA_SUCCESS_RUBRIC, summary=false
  const history = [
    { role: 'user', content: 'Jag vill boka ett möte nästa vecka' },
    { role: 'assistant', content: 'Självklart, vilket datum passar dig?' },
    { role: 'user', content: 'Tisdag den 15:e' },
  ];
  // With summary=false and no schema/rubric, should return null
  const result = await analyzeCall(history, { summary: false, structuredSchema: null, successRubric: null });
  assert.equal(result, null);
});

test('analyzeCall returns summary when LLM responds correctly', async () => {
  // Temporarily patch GROQ_API_KEY to non-test value and mock the chat function
  const groqModule = require('../src/providers/llm/groq');
  const origChat = groqModule.chat;
  groqModule.chat = async () => 'SAMMANFATTNING: Kunden ville boka ett möte. Sofia hjälpte kunden att boka tisdag den 15:e.';

  const history = [
    { role: 'user', content: 'Jag vill boka ett möte nästa vecka, tisdag den 15:e om möjligt' },
    { role: 'assistant', content: 'Perfekt! Jag bokar dig på tisdag den 15:e. Vad passar bäst, förmiddag eller eftermiddag?' },
    { role: 'user', content: 'Förmiddag, gärna runt 10' },
    { role: 'assistant', content: 'Utmärkt, jag bokar kl 10.00 tisdag den 15:e. Du får en bekräftelse via mail.' },
  ];

  try {
    const result = await analyzeCall(history, { summary: true, structuredSchema: null, successRubric: null });
    assert.ok(result !== null);
    assert.ok(typeof result.summary === 'string');
    assert.ok(result.summary.length > 10);
  } finally {
    groqModule.chat = origChat;
  }
});

test('analyzeCall extracts structured data when schema provided', async () => {
  const groqModule = require('../src/providers/llm/groq');
  const origChat = groqModule.chat;
  groqModule.chat = async () =>
    'SAMMANFATTNING: Kunden bokade möte.\nSTRUKTURERAD_DATA: {"name":"Anders Svensson","intent":"boka_mote","date":"2026-10-15"}';

  const schema = {
    type: 'object',
    properties: {
      name:   { type: 'string' },
      intent: { type: 'string' },
      date:   { type: 'string' },
    },
  };

  const history = [
    { role: 'user', content: 'Hej, jag heter Anders Svensson och vill boka ett möte den 15 oktober' },
    { role: 'assistant', content: 'Hej Anders! Jag bokar dig den 15 oktober.' },
  ];

  try {
    const result = await analyzeCall(history, { summary: true, structuredSchema: schema });
    assert.ok(result !== null);
    assert.ok(result.structuredData !== null);
    assert.equal(result.structuredData.name, 'Anders Svensson');
    assert.equal(result.structuredData.intent, 'boka_mote');
  } finally {
    groqModule.chat = origChat;
  }
});

test('analyzeCall handles success evaluation', async () => {
  const groqModule = require('../src/providers/llm/groq');
  const origChat = groqModule.chat;
  groqModule.chat = async () =>
    'SAMMANFATTNING: Kunden fick hjälp.\nBEDÖMNING: success';

  const history = [
    { role: 'user', content: 'Kan ni hjälpa mig med mitt ärende?' },
    { role: 'assistant', content: 'Absolut! Ärendet är nu löst.' },
  ];

  try {
    const result = await analyzeCall(history, {
      summary: true,
      successRubric: 'Kunden fick svar på sin fråga',
    });
    assert.ok(result !== null);
    assert.equal(result.successEvaluation, 'success');
  } finally {
    groqModule.chat = origChat;
  }
});

test('analyzeCall returns unknown for unclear success evaluation', async () => {
  const groqModule = require('../src/providers/llm/groq');
  const origChat = groqModule.chat;
  groqModule.chat = async () => 'SAMMANFATTNING: Kort samtal.\nBEDÖMNING: unknown';

  const history = [
    { role: 'user', content: 'Hallå?' },
    { role: 'assistant', content: 'Hej, hur kan jag hjälpa dig?' },
  ];

  try {
    const result = await analyzeCall(history, {
      summary: true,
      successRubric: 'Kunden fick hjälp',
    });
    assert.ok(result !== null);
    assert.equal(result.successEvaluation, 'unknown');
  } finally {
    groqModule.chat = origChat;
  }
});
