'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { detectVoicemail } = require('../src/features/voicemail');

// ── Voicemail / IVR — should return true ─────────────────────────────────────

test('detects Swedish voicemail: lämna meddelande', () => {
  assert.equal(detectVoicemail('Lämna ett meddelande efter signalen'), true);
});

test('detects Swedish: inte tillgänglig', () => {
  assert.equal(detectVoicemail('Du har nått Eriksson AB, vi är inte tillgängliga just nu'), true);
});

test('detects Swedish: tryck 1', () => {
  assert.equal(detectVoicemail('Tack för att du ringer, tryck 1 för support'), true);
});

test('detects Swedish: välkommen till', () => {
  assert.equal(detectVoicemail('Välkommen till Telia kundservice'), true);
});

test('detects Swedish: röstbrevlåda', () => {
  assert.equal(detectVoicemail('Du har nått Jonas röstbrevlåda'), true);
});

test('detects Swedish: du har nått', () => {
  assert.equal(detectVoicemail('Du har nått Eriksson AB'), true);
});

test('detects Swedish: hälsar välkommen (IVR)', () => {
  assert.equal(detectVoicemail('Vi hälsar dig välkommen och ber dig lyssna på följande alternativ'), true);
});

test('detects English: leave a message', () => {
  assert.equal(detectVoicemail('Please leave a message after the beep'), true);
});

test('detects English: not available', () => {
  assert.equal(detectVoicemail('The person you are calling is not available'), true);
});

test('detects long IVR without question (>30 words)', () => {
  const ivr = 'För att komma till teknisk support tryck ett, för fakturafrågor tryck två, för allmänna frågor vänta kvar på linjen';
  assert.equal(detectVoicemail(ivr), true);
});

// ── Real humans — should return false ────────────────────────────────────────

test('human: kort hej', () => {
  assert.equal(detectVoicemail('Hej!'), false);
});

test('human: hallå', () => {
  assert.equal(detectVoicemail('Ja, hallå?'), false);
});

test('human: fråga', () => {
  assert.equal(detectVoicemail('Vad gäller ditt ärende?'), false);
});

test('human: bekräftelse', () => {
  assert.equal(detectVoicemail('Ja absolut, berätta mer'), false);
});

test('human: kort svar', () => {
  assert.equal(detectVoicemail('Det är Erik'), false);
});

// ── Edge cases ────────────────────────────────────────────────────────────────

test('empty string returns false', () => {
  assert.equal(detectVoicemail(''), false);
});

test('null/undefined returns false', () => {
  assert.equal(detectVoicemail(null), false);
  assert.equal(detectVoicemail(undefined), false);
});

test('very short text returns false', () => {
  assert.equal(detectVoicemail('Ja'), false);
});

// ── Phone queue — should return true ─────────────────────────────────────────

test('detects Swedish queue: beräknad väntetid', () => {
  assert.equal(detectVoicemail('Beräknad väntetid är 5 minuter'), true);
});

test('detects Swedish queue: du är nummer X i kön', () => {
  assert.equal(detectVoicemail('Du är nummer 3 i kön, väntetiden är ca 5 minuter'), true);
});

test('detects Swedish queue: alla operatörer upptagna', () => {
  assert.equal(detectVoicemail('Alla våra operatörer är just nu upptagna'), true);
});

test('detects Swedish queue: ange kundnummer', () => {
  assert.equal(detectVoicemail('Ange ditt kundnummer följt av fyrkant'), true);
});

test('detects Swedish queue: knappa in', () => {
  assert.equal(detectVoicemail('Knappa in ditt personnummer'), true);
});

test('detects Swedish queue: vill du bli uppringd', () => {
  assert.equal(detectVoicemail('Vill du bli uppringd när en operatör är ledig?'), true);
});

test('detects IVR greeting with hej (overrides human check)', () => {
  assert.equal(detectVoicemail('Hej och välkommen till vår kundservice, tryck 1 för support'), true);
});

test('detects English queue: all agents busy', () => {
  assert.equal(detectVoicemail('All agents are currently busy, please continue to hold'), true);
});

test('detects English queue: expected wait time', () => {
  assert.equal(detectVoicemail('Your expected wait time is approximately 10 minutes'), true);
});

test('detects English queue: please hold + important', () => {
  assert.equal(detectVoicemail('Please hold, your call is important to us'), true);
});

test('detects English queue: you are number X', () => {
  assert.equal(detectVoicemail('You are caller number 5 in the queue'), true);
});
