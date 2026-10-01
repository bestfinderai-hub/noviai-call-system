'use strict';

// Post-call analysis — runs a second LLM pass after each call to produce:
//   summary          : 2-3 sentence plain text summary
//   structuredData   : JSON with outcome, sentiment, booked status, objections etc.
//   successEvaluation: "success" | "failure" | "unknown" (if NOVA_SUCCESS_RUBRIC set)
//
// Runs by default on every call. Override schema via NOVA_ANALYSIS_SCHEMA.

const { chat } = require('../providers/llm');

// ── Default schema — always runs ──────────────────────────────────────────────

const DEFAULT_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    outcome: {
      type: 'string',
      enum: ['booked', 'callback_requested', 'not_interested', 'info_given',
             'transferred', 'voicemail_detected', 'error', 'unknown'],
    },
    booked:          { type: 'boolean' },
    booking_date:    { type: 'string' },
    customer_name:   { type: 'string' },
    customer_phone:  { type: 'string' },
    main_objection: {
      type: 'string',
      enum: ['price', 'time', 'competitor', 'not_interested',
             'not_decision_maker', 'none', 'unknown'],
    },
    sentiment_score: { type: 'integer', minimum: 1, maximum: 10 },
    sentiment_label: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    key_info:        { type: 'string' },
  },
  required: ['outcome', 'booked', 'sentiment_score', 'sentiment_label'],
};

// ── Config loading ─────────────────────────────────────────────────────────────

function loadAnalysisConfig(override = {}) {
  let structuredSchema = DEFAULT_ANALYSIS_SCHEMA;
  let successRubric = null;

  if (process.env.NOVA_ANALYSIS_SCHEMA) {
    try {
      structuredSchema = JSON.parse(process.env.NOVA_ANALYSIS_SCHEMA);
    } catch {
      console.warn('[Analysis] Invalid NOVA_ANALYSIS_SCHEMA JSON — using default schema');
    }
  }

  if (process.env.NOVA_SUCCESS_RUBRIC) {
    successRubric = process.env.NOVA_SUCCESS_RUBRIC.trim();
  }

  return {
    summary:         override.summary         !== false,
    structuredSchema: override.structuredSchema ?? structuredSchema,
    successRubric:   override.successRubric   ?? successRubric,
  };
}

// ── Transcript formatting ──────────────────────────────────────────────────────

function formatTranscript(history) {
  return (history || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Kund' : 'Agent'}: ${m.content}`)
    .join('\n');
}

// ── Analysis runner ────────────────────────────────────────────────────────────

async function analyzeCall(history, configOverride = {}) {
  if (!history || history.length < 2) return null;

  const cfg = loadAnalysisConfig(configOverride);
  const transcript = formatTranscript(history);
  if (transcript.length < 30) return null;

  const tasks = [];

  if (cfg.summary) {
    tasks.push('SAMMANFATTNING: Skriv 2-3 meningar som beskriver vad samtalet handlade om och hur det gick. Neutral ton.');
  }

  if (cfg.structuredSchema) {
    const schemaStr = JSON.stringify(cfg.structuredSchema, null, 2);
    tasks.push(
      `STRUKTURERAD_DATA: Extrahera data enligt detta JSON-schema.\n` +
      `Returnera EXAKT giltig JSON. Sätt null för fält du inte kan avgöra.\n` +
      `Schema:\n${schemaStr}`,
    );
  }

  if (cfg.successRubric) {
    tasks.push(
      `BEDÖMNING: Utvärdera om samtalet lyckades.\nRubrik: "${cfg.successRubric}"\n` +
      `Svara med EXAKT ett av dessa ord: success | failure | unknown`,
    );
  }

  if (tasks.length === 0) return null;

  const userMessage =
    `TRANSKRIPT:\n${transcript}\n\n` +
    `UPPGIFTER:\n${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n\n')}`;

  try {
    const response = await chat(
      [{ role: 'user', content: userMessage }],
      'Du är ett precist analyssystem för telefonsamtal. Följ formaten exakt. Svara alltid på svenska.',
    );

    return parseAnalysisResponse(response, cfg);
  } catch (err) {
    console.error('[Analysis] LLM call failed:', err.message);
    return null;
  }
}

// ── Response parsing ───────────────────────────────────────────────────────────

function parseAnalysisResponse(text, cfg) {
  const result = {};

  if (cfg.summary) {
    const m = text.match(/SAMMANFATTNING:\s*([\s\S]+?)(?=\n\d+\.|$)/);
    result.summary = m ? m[1].trim() : text.split('\n')[0]?.trim() || null;
  }

  if (cfg.structuredSchema) {
    // Try labelled block first
    const m = text.match(/STRUKTURERAD_DATA:\s*(\{[\s\S]*?\})\s*(?=\n\d+\.|$)/);
    if (m) {
      try {
        result.structuredData = JSON.parse(m[1]);
      } catch {
        result.structuredData = _tryExtractJson(text);
      }
    } else {
      result.structuredData = _tryExtractJson(text);
    }
  }

  if (cfg.successRubric) {
    const m = text.match(/BEDÖMNING:\s*(success|failure|unknown)/i);
    result.successEvaluation = m ? m[1].toLowerCase() : 'unknown';
  }

  return Object.keys(result).length > 0 ? result : null;
}

function _tryExtractJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

module.exports = { analyzeCall };
