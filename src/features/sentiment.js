'use strict';

// Mid-call sentiment classification — called after each STT turn (non-blocking).
// Uses Groq with a tiny 10-token completion for minimal latency overhead.
// Result is stored per-turn and included in end-of-call report + conversation webhook.
//
// Set SENTIMENT_ENABLED=false to disable (default: enabled).

const { chat } = require('../services/llm');

const SENTIMENT_LABELS = ['positiv', 'negativ', 'neutral', 'intresserad', 'avvisande'];

const SENTIMENT_SYSTEM_PROMPT =
  'Klassificera känsloläge. Svara BARA med ett ord: positiv | negativ | neutral | intresserad | avvisande';

/**
 * Classify user sentiment from a single utterance.
 * @returns {Promise<'positiv'|'negativ'|'neutral'|'intresserad'|'avvisande'>}
 */
async function classifySentiment(text) {
  if (!text || text.length < 3 || text[0] === '[') return 'neutral';
  if (process.env.SENTIMENT_ENABLED === 'false') return 'neutral';

  // Strip control characters that could confuse the LLM
  const cleaned = text.replace(/[\x00-\x1F\x7F]/g, ' ').trim();
  if (cleaned.length < 3) return 'neutral';

  try {
    const result = await chat(
      [{ role: 'user', content: cleaned.slice(0, 300) }],
      SENTIMENT_SYSTEM_PROMPT,
    );
    const label = result.trim().toLowerCase().split(/[\s,.:]/)[0];
    if (!SENTIMENT_LABELS.includes(label)) {
      console.debug(`[Sentiment] Unexpected label "${label}" — falling back to neutral`);
      return 'neutral';
    }
    return label;
  } catch (err) {
    console.warn('[Sentiment] Failed:', err.message);
    return 'neutral';
  }
}

module.exports = { classifySentiment, SENTIMENT_LABELS };
