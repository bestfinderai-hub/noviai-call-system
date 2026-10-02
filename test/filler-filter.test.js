'use strict';

// Unit tests for the numWords/filler filter in src/call-session.js.
//
// The filter logic (call-session.js lines 27-31, 285-292) is mirrored here so
// the test has no dependency on CallSession construction (which requires audio
// hardware, WebSocket, env vars etc.). If the production constants change, update
// FILLER_WORDS and MIN_MEANINGFUL_WORDS below to match.

const { test } = require('node:test');
const assert   = require('node:assert/strict');

// ── Mirror of production constants (keep in sync with call-session.js) ─────────

const FILLER_WORDS = new Set([
  'eh','ehm','mm','mmm','hm','hmm','ja','jo','ok','okej','ah','oh','oj','öh','uh','um',
]);

function isFiller(transcript, minMeaningful = 2) {
  const words = transcript.toLowerCase().replace(/[^a-zåäö\s]/g, '').split(/\s+/).filter(Boolean);
  const meaningful = words.filter(w => !FILLER_WORDS.has(w));
  return meaningful.length < minMeaningful;
}

// ── Single filler words — should be filtered ───────────────────────────────────

test('filtrerar "mm"', () => {
  assert.equal(isFiller('mm'), true);
});

test('filtrerar "eh"', () => {
  assert.equal(isFiller('eh'), true);
});

test('filtrerar "hm"', () => {
  assert.equal(isFiller('hm'), true);
});

test('filtrerar "ja"', () => {
  assert.equal(isFiller('ja'), true);
});

test('filtrerar "jo"', () => {
  assert.equal(isFiller('jo'), true);
});

test('filtrerar "ok"', () => {
  assert.equal(isFiller('ok'), true);
});

test('filtrerar "okej"', () => {
  assert.equal(isFiller('okej'), true);
});

test('filtrerar "öh"', () => {
  assert.equal(isFiller('öh'), true);
});

test('filtrerar "ah"', () => {
  assert.equal(isFiller('ah'), true);
});

test('filtrerar "uh"', () => {
  assert.equal(isFiller('uh'), true);
});

test('filtrerar "um"', () => {
  assert.equal(isFiller('um'), true);
});

// ── Multiple filler words only — should be filtered ────────────────────────────

test('filtrerar "mm mm" (upprepat)', () => {
  assert.equal(isFiller('mm mm'), true);
});

test('filtrerar "eh okej"  (2 fillers, 0 meningsfulla)', () => {
  assert.equal(isFiller('eh okej'), true);
});

test('filtrerar "ja jo ok" (3 fillers)', () => {
  assert.equal(isFiller('ja jo ok'), true);
});

test('filtrerar "hm mm eh" (blandade fillers)', () => {
  assert.equal(isFiller('hm mm eh'), true);
});

// ── Filler + ett meningsfullt ord — fortfarande filtreras (< 2 meningsfulla) ───

test('filtrerar "ja men"  (1 meningsfullt ord)', () => {
  assert.equal(isFiller('ja men'), true);
});

test('filtrerar "okej bra" (1 meningsfullt ord)', () => {
  assert.equal(isFiller('okej bra'), true);
});

test('filtrerar "mm tack"  (1 meningsfullt ord)', () => {
  assert.equal(isFiller('mm tack'), true);
});

// ── Filler + minst 2 meningsfulla ord — ska passera ───────────────────────────

test('passerar "jo men vilken tid"  (3 meningsfulla)', () => {
  assert.equal(isFiller('jo men vilken tid'), false);
});

test('passerar "okej det stämmer"   (2 meningsfulla: det, stämmer)', () => {
  assert.equal(isFiller('okej det stämmer'), false);
});

test('passerar "hm intressant det"  (2 meningsfulla: intressant, det)', () => {
  assert.equal(isFiller('hm intressant det'), false);
});

// ── Rena meningsfulla transkript — ska alltid passera ─────────────────────────

test('passerar normalt samtalssvar', () => {
  assert.equal(isFiller('Jag är intresserad av det du sa'), false);
});

test('passerar kort fråga', () => {
  assert.equal(isFiller('Vad kostar det?'), false);
});

test('passerar telefonnummer (siffror tas bort men ord kvarstår)', () => {
  // "ring mig" → meningsfulla=["ring","mig"] → passes
  assert.equal(isFiller('ring mig'), false);
});

// ── Case-insensitivitet ────────────────────────────────────────────────────────

test('filtrerar "MM" (versaler)', () => {
  assert.equal(isFiller('MM'), true);
});

test('filtrerar "Ja" (inledande versal)', () => {
  assert.equal(isFiller('Ja'), true);
});

test('filtrerar "OKEJ" (helversaler)', () => {
  assert.equal(isFiller('OKEJ'), true);
});

// ── Specialtecken och skiljetecken stripas ────────────────────────────────────

test('filtrerar "mm..." (punkter stripas → mm → filler)', () => {
  assert.equal(isFiller('mm...'), true);
});

test('filtrerar "eh?" (frågetecken stripas)', () => {
  assert.equal(isFiller('eh?'), true);
});

test('filtrerar "mm," (komma stripas)', () => {
  assert.equal(isFiller('mm,'), true);
});

// ── Blanktecken-robusthet ─────────────────────────────────────────────────────

test('filtrerar "  mm  " (extra mellanslag)', () => {
  assert.equal(isFiller('  mm  '), true);
});

test('passerar " okej vad   menar du " (extra mellanslag)', () => {
  assert.equal(isFiller(' okej vad   menar du '), false);
});

// ── Konfigurerbar minimigräns ─────────────────────────────────────────────────

test('minMeaningful=1: "ja bra" passerar (1 meningsfullt)', () => {
  assert.equal(isFiller('ja bra', 1), false);
});

test('minMeaningful=3: "det stämmer" filtreras (2 meningsfulla < 3)', () => {
  assert.equal(isFiller('det stämmer', 3), true);
});

test('minMeaningful=3: "jo det stämmer ju" passerar (3 meningsfulla)', () => {
  assert.equal(isFiller('jo det stämmer ju', 3), false);
});

// ── Tom sträng ────────────────────────────────────────────────────────────────

test('filtrerar tom sträng', () => {
  // 0 meningsfulla ord < 2
  assert.equal(isFiller(''), true);
});

test('filtrerar sträng med bara siffror (stripas helt)', () => {
  // "123 456" → replace(/[^a-zåäö\s]/g,'') → "  " → split → [] → 0 meningsfulla
  assert.equal(isFiller('123 456'), true);
});
