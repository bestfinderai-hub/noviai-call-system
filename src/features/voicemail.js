'use strict';

// Voicemail / IVR / phone-queue detection
// Called after each STT transcription for the first N turns.
// Returns true → hang up immediately (saves cost, sounds professional).
//
// Three-tier detection:
//   1. High-confidence IVR/queue phrases  (override human check)
//   2. Human greeting patterns            (short responses only)
//   3. Standard voicemail/IVR patterns
//   4. Heuristic: long monologue without a question

// ── 1. High-confidence IVR / queue signals ────────────────────────────────────
// No real human ever says these — hang up regardless of other content
const HIGH_CONF_PATTERNS = [
  // Phone-queue position / wait time
  /väntetid/i,
  /beräknad väntetid/i,
  /uppskattad väntetid/i,
  /du är nummer \d+/i,
  /din plats i kön/i,
  /you are (?:caller )?(?:number ?)?\d+/i,
  /estimated wait/i,
  /expected wait (time)?/i,
  // All-agents-busy (queue holding)
  /alla (våra )?(medarbetare|operatörer|agenter|rådgivare|kollegor)/i,
  /all (our )?(agents?|representatives?|operators?|advisors?) are/i,
  /please hold/i,
  /your call is important/i,
  // DTMF PIN / account entry (always IVR)
  /ange (ditt |er )?(kundnummer|personnummer|ärendenummer|kontonummer|ordernummer|pinkod|pin)/i,
  /knappa in (ditt |er )?/i,
  /enter your (customer|account|order|pin|password) (number)?/i,
  // Callback offer
  /vill du bli uppringd/i,
  /erbjuder (dig )?återuppringning/i,
  /we('ll| will) call you back/i,
  /request a callback/i,
];

// ── 2. Human greeting patterns ────────────────────────────────────────────────
// Applied only when the response is short (≤ 6 words)
// Real human pick-ups are brief; long IVR openings are caught by other rules
const HUMAN_PATTERNS = [
  /^(hej|hallå|ja[,.]?\s|hej hej)/i,
  /vad (gäller|kan)|hur kan/i,
];

// ── 3. Standard voicemail / IVR patterns ─────────────────────────────────────
const VOICEMAIL_PATTERNS = [
  // Voicemail prompts
  /lämna (ett |ditt )?meddelande/i,
  /efter (tonen|pipet|signalen)/i,
  /inte (tillgänglig|anträffbar|nåbar)/i,
  /prata (in|efter)/i,
  /röstbrevlåda/i,
  /beep/i,
  /leave (a |your )?message/i,
  /not available/i,
  /voicemail/i,
  // DTMF menus
  /tryck \d/i,
  /press \d/i,
  /för att (nå|komma till|välja)/i,
  /for (support|sales|billing|service|help),? press/i,
  // IVR greetings
  /välkommen till/i,
  /du har (nått|ringt)/i,
  /du har ringt till/i,
  /hälsar (dig |er )?välkommen/i,
  /you('ve| have) reached/i,
  /you have reached/i,
  /thank you for (calling|holding|your patience)/i,
  // Hold / wait messages
  /ett ögonblick/i,
  /vänligen vänta/i,
  /we('ll| will) be with you (shortly|soon|as soon)/i,
  /vi svarar (inom|snart)/i,
  // Recording notice
  /this (call|number) (may|will) be recorded/i,
  /samtal(et)? (spelas |kan spelas )?in/i,
  // Office hours (IVR out-of-hours message)
  /öppettider/i,
  /our (business |office )?hours/i,
];

// ── Detection ─────────────────────────────────────────────────────────────────

function detectVoicemail(transcript) {
  if (!transcript || transcript.length < 3) return false;

  const t = transcript.trim();
  const wordCount = t.split(/\s+/).length;

  // 1. High-confidence IVR/queue — overrides human check
  if (HIGH_CONF_PATTERNS.some(p => p.test(t))) return true;

  // 2. Short human greeting → real person
  if (wordCount <= 6 && HUMAN_PATTERNS.some(p => p.test(t))) return false;

  // 3. Standard IVR/voicemail markers
  if (VOICEMAIL_PATTERNS.some(p => p.test(t))) return true;

  // 4. Heuristic: long unprompted monologue without a question = IVR menu
  //    Threshold at 30 words to avoid false positives on verbose humans
  if (wordCount > 30 && !t.includes('?')) return true;

  return false;
}

module.exports = { detectVoicemail };
