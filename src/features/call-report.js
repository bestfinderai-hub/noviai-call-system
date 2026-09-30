'use strict';

// End-of-call report: saves to Neon DB + POSTs to webhook URL if configured.
// Also runs post-call LLM analysis (summary, structured data, success eval) if configured.
// Triggered by CallSession.cleanup().
//
// Webhook payload matches Vapi's end-of-call-report format (extended).
// Set NOVA_REPORT_WEBHOOK_URL + NOVA_REPORT_WEBHOOK_SECRET in .env.

const { query }      = require('../db');
const { analyzeCall } = require('./analysis');

async function saveCallReport(report) {
  const {
    callId, phoneFrom, phoneTo, startedAt, durationSec,
    turnCount, hangupCause, transcript,
    direction = 'incoming', variables = {},
    sentimentTurns = [], costUsd = null, recordingUrl = null,
  } = report;

  const sttProvider = process.env.STT_PROVIDER || 'groq';
  const ttsProvider = process.env.TTS_PROVIDER || 'edge';
  const llmProvider = process.env.LLM_PROVIDER || 'groq';

  // Run post-call analysis (non-blocking from caller's perspective)
  let analysis = null;
  try {
    analysis = await analyzeCall(transcript);
  } catch (err) {
    console.error('[Report] Analysis failed (non-fatal):', err.message);
  }

  // 1. Save to DB
  try {
    await query(
      `INSERT INTO novai_calls
        (call_id, phone_from, phone_to, started_at, duration_sec, turn_count, hangup_cause,
         transcript, stt_provider, tts_provider, llm_provider, direction, variables,
         summary, structured_data, success_evaluation,
         sentiment_turns, cost_usd, recording_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (call_id) DO UPDATE SET
         ended_at=NOW(), duration_sec=$5, turn_count=$6, hangup_cause=$7, transcript=$8,
         summary=$14, structured_data=$15, success_evaluation=$16,
         sentiment_turns=$17, cost_usd=$18, recording_url=$19`,
      [
        callId,
        phoneFrom || null,
        phoneTo   || null,
        startedAt || null,
        durationSec,
        turnCount,
        hangupCause || 'normal_clearing',
        JSON.stringify(transcript || []),
        sttProvider, ttsProvider, llmProvider,
        direction,
        JSON.stringify(variables),
        analysis?.summary        || null,
        analysis?.structuredData ? JSON.stringify(analysis.structuredData) : null,
        analysis?.successEvaluation || null,
        sentimentTurns.length ? JSON.stringify(sentimentTurns) : null,
        costUsd,
        recordingUrl,
      ],
    );
    console.log(`[Report] Saved call ${callId?.slice(-8)} to DB${analysis ? ' + analysis' : ''}`);
  } catch (err) {
    console.error('[Report] DB save failed:', err.message);
  }

  // 2. POST to webhook if configured
  const webhookUrl = process.env.NOVA_REPORT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = {
    type: 'end-of-call-report',
    call: {
      id: callId,
      phoneFrom,
      phoneTo,
      startedAt,
      durationSeconds: durationSec,
      turnCount,
      hangupCause: hangupCause || 'normal_clearing',
      direction,
    },
    transcript: (transcript || [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'Kund' : 'Sofia'}: ${m.content}`)
      .join('\n'),
    messages: transcript || [],
    analysis: analysis || null,
    providers: { stt: sttProvider, tts: ttsProvider, llm: llmProvider },
    timestamp: new Date().toISOString(),
  };

  try {
    const headers = { 'Content-Type': 'application/json' };
    const secret = process.env.NOVA_REPORT_WEBHOOK_SECRET;
    if (secret) headers['x-novai-secret'] = secret;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    console.log(`[Report] Webhook → ${res.status} ${webhookUrl}`);
  } catch (err) {
    console.error('[Report] Webhook failed:', err.message);
  }
}

module.exports = { saveCallReport };
