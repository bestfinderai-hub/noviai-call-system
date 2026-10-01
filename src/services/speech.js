'use strict';

// Text preprocessing pipeline — runs LLM output through cleanup + SSML enhancement before TTS.
// Applied automatically in each TTS provider so callers don't need to think about it.

// ── Strip markdown ────────────────────────────────────────────────────────────

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')            // **bold**
    .replace(/\*(.*?)\*/g, '$1')                // *italic*
    .replace(/^#{1,6}\s+/gm, '')               // # Headers
    .replace(/^[-*+]\s+/gm, '')                // - bullet lists
    .replace(/^\d+\.\s+/gm, '')                // 1. numbered lists
    .replace(/`([^`]+)`/g, '$1')               // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [link](url) → text
    .replace(/https?:\/\/\S+/g, 'länk')        // URLs → "länk"
    .replace(/\n{2,}/g, ' ')                   // multiple newlines → space
    .replace(/\n/g, ' ')                        // newlines → space
    .replace(/\s{2,}/g, ' ')                   // multiple spaces → single
    .trim();
}

// ── SSML pause injection ──────────────────────────────────────────────────────
// msedge-tts wraps text in <speak><voice>…</voice></speak>, so SSML tags
// embedded in the text string are interpreted by Microsoft's TTS engine.

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function addNaturalPauses(text) {
  // Escape XML special chars in raw text first, THEN insert SSML tags
  let t = escapeXml(text);

  // Ellipsis → long thinking pause
  t = t.replace(/\.\.\./g, '<break time="600ms"/>');

  // Em-dash pause
  t = t.replace(/\s*—\s*/g, '<break time="250ms"/> ');

  // Sentence-ending pauses (period, ! or ? followed by a space/EOL)
  t = t.replace(/([.!?])\s+/g, '$1<break time="350ms"/> ');

  // Comma pauses
  t = t.replace(/,\s+/g, ',<break time="150ms"/> ');

  // Semicolon pauses
  t = t.replace(/;\s+/g, ';<break time="200ms"/> ');

  // Colon pause
  t = t.replace(/:\s+/g, ':<break time="200ms"/> ');

  return `<speak>${t}</speak>`;
}

// ── Combined pipeline ─────────────────────────────────────────────────────────

/**
 * Full preprocessing: strip markdown → optional SSML pauses.
 * @param {string} text   Raw LLM output
 * @param {object} opts
 * @param {boolean} opts.ssml  Wrap in SSML with natural pauses (default: true)
 */
function prepareForTts(text, { ssml = true } = {}) {
  if (!text) return text;
  const clean = stripMarkdown(text);
  if (!ssml || !clean) return clean;
  return addNaturalPauses(clean);
}

module.exports = { prepareForTts, stripMarkdown, addNaturalPauses };
