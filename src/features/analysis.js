'use strict';

// Post-call analysis — runs a second LLM pass after each call to produce:
//   summary          : 2-3 sentence plain text summary
//   structuredData   : JSON matching NOVA_ANALYSIS_SCHEMA (if configured)
//   successEvaluation: "success" | "failure" | "unknown" (if NOVA_SUCCESS_RUBRIC set)
//
// Non-blocking — called from call-report.js, failures are logged but not rethrown.

const { chat } = require('../providers/llm');

// ── Config loading ─────────────────────────────────────────────────────────────

function loadAnalysisConfig(override = {}) {
  let structuredSchema = null;
  let successRubric = null;

  if (process.env.NOVA_ANALYSIS_SCHEMA) {
    try {
      structuredSchema = JSON.parse(process.env.NOVA_ANALYSIS_SCHEMA);
    } catch {
      console.warn('[Analysis] Invalid NOVA_ANALYSIS_SCHEMA JSON — skipping extraction');
    }
  }

  if (process.env.NOVA_SUCCESS_RUBRIC) {
    successRubric = process.env.NOVA_SUCCESS_RUBRIC.trim();
  }

  return {
    summary: override.summary !== false,
    structuredSchema: override.structuredSchema ?? structuredSchema,
    successRubric: override.successRubric ?? successRubric,
  };
}

// ── Transcript formatting ──────────────────────────────────────────────────────

function formatTranscript(history) {
  return (history || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Kund' : 'Sofia'}: ${m.content}`)
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
      `Returnera EXAKT giltig JSON och inget annat. Sätt null för fält som saknas.\n` +
      `Schema:\n${schemaStr}`,
    );
  }

  if (cfg.successRubric) {
    tasks.push(
      `BEDÖMNING: Utvärdera om samtalet lyckades. Rubrik: "${cfg.successRubric}"\n` +
      `Svara med EXAKT ett av dessa ord: success | failure | unknown`,
    );
  }

  if (tasks.length === 0) return null;

  const userMessage = `TRANSKRIPT:\n${transcript}\n\nUPPGIFTER:\n${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n\n')}`;

  try {
    const response = await chat(
      [{ role: 'user', content: userMessage }],
      'Du är ett precist analyssystem. Följ formaten exakt. Svara alltid på svenska.',
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
    const m = text.match(/SAMMANFATTNING:\s*([\s\S]+?)(?=\n[A-ZÅÄÖ_]+:|$)/);
    result.summary = m ? m[1].trim() : text.split('\n')[0]?.trim() || null;
  }

  if (cfg.structuredSchema) {
    const m = text.match(/STRUKTURERAD_DATA:\s*(\{[\s\S]*?\})\s*(?=\n[A-ZÅÄÖ_]+:|$)/);
    if (m) {
      try {
        result.structuredData = JSON.parse(m[1]);
      } catch {
        // Try to find any JSON object in the text as fallback
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { result.structuredData = JSON.parse(jsonMatch[0]); } catch { result.structuredData = null; }
        } else {
          result.structuredData = null;
        }
      }
    } else {
      result.structuredData = null;
    }
  }

  if (cfg.successRubric) {
    const m = text.match(/BEDÖMNING:\s*(success|failure|unknown)/i);
    result.successEvaluation = m ? m[1].toLowerCase() : 'unknown';
  }

  return Object.keys(result).length > 0 ? result : null;
}

module.exports = { analyzeCall };
