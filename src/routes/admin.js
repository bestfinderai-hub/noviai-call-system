'use strict';

// Admin REST API — configure prompt/greeting/voice/settings without restart,
// view recent calls, transfer active calls, make outbound calls.
//
// Auth: Authorization: Bearer NOVA_ADMIN_TOKEN  (required on all routes)
// Rate limit: 60 req/min per IP
//
// Endpoints:
//   GET  /admin/config
//   POST /admin/prompt
//   POST /admin/greeting
//   POST /admin/voice
//   POST /admin/providers
//   POST /admin/settings
//   GET  /admin/tools
//   POST /admin/tools
//   GET  /admin/calls[?limit=N&phone=+46X]
//   GET  /admin/calls/:callId
//   POST /admin/calls/:callId/transfer
//   POST /admin/calls/outbound
//   POST /admin/batch-calls
//   GET  /admin/batch-calls
//   GET  /admin/batch-calls/:batchId
//   DELETE /admin/batch-calls/:batchId

const express    = require('express');
const { timingSafeEqual } = require('crypto');
const rateLimit  = require('express-rate-limit');
const { query }  = require('../db');
const { clearPromptCache } = require('../providers/llm');
const { clearToolsCache }  = require('../features/tools');

const router = express.Router();

// ── Rate limiting ─────────────────────────────────────────────────────────────

router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — max 60/min' },
}));

// ── Timing-safe auth ──────────────────────────────────────────────────────────

function requireToken(req, res, next) {
  const token = process.env.NOVA_ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'Admin API disabled — set NOVA_ADMIN_TOKEN in .env' });

  const provided = req.headers.authorization || '';
  const expected = `Bearer ${token}`;

  const bufProvided = Buffer.alloc(256);
  const bufExpected = Buffer.alloc(256);
  bufProvided.write(provided);
  bufExpected.write(expected);

  if (!timingSafeEqual(bufProvided, bufExpected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireToken);
router.use(express.json({ limit: '64kb' }));

// ── In-memory config ──────────────────────────────────────────────────────────

const _config = {
  systemPrompt: null,
  greeting:     null,
  voice:        null,
  settings:     {},
};

// ── GET /admin/config ─────────────────────────────────────────────────────────

router.get('/config', (_req, res) => {
  res.json({
    systemPrompt: _config.systemPrompt || process.env.SYSTEM_PROMPT || '(default — Sofia receptionist)',
    greeting:     _config.greeting     || process.env.TTS_GREETING  || '(default)',
    voice:        _config.voice        || process.env.TTS_VOICE     || 'sv-SE-SofieNeural',
    providers: {
      stt: process.env.STT_PROVIDER || 'groq',
      llm: process.env.LLM_PROVIDER || 'groq',
      tts: process.env.TTS_PROVIDER || 'edge',
    },
    models: {
      stt: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',
      llm: process.env.GROQ_LLM_MODEL || 'qwen/qwen3.8-27b',
    },
    settings: {
      vadSilenceMs:      parseInt(process.env.VAD_SILENCE_MS     || '400'),
      maxCallDuration:   parseInt(process.env.MAX_CALL_DURATION  || '600'),
      maxTokensLlm:      parseInt(process.env.MAX_TOKENS_LLM     || '150'),
      language:          process.env.CALL_LANGUAGE               || 'sv',
      firstMessageMode:  process.env.FIRST_MESSAGE_MODE          || 'assistant',
      idleTimeout1Ms:    parseInt(process.env.IDLE_TIMEOUT_1_MS  || '10000'),
      idleTimeout2Ms:    parseInt(process.env.IDLE_TIMEOUT_2_MS  || '8000'),
      idleMessage1:      process.env.IDLE_MESSAGE_1              || 'Är du kvar?',
    },
  });
});

// ── POST /admin/prompt ────────────────────────────────────────────────────────

router.post('/prompt', (req, res) => {
  const { prompt } = req.body || {};
  if (typeof prompt !== 'string' || prompt.trim().length < 10) {
    return res.status(400).json({ error: 'prompt: string, min 10 chars' });
  }
  if (prompt.length > 8000) {
    return res.status(400).json({ error: 'prompt: max 8000 chars' });
  }
  _config.systemPrompt = prompt.trim();
  process.env.SYSTEM_PROMPT = _config.systemPrompt;
  clearPromptCache();
  console.log('[Admin] System prompt updated:', prompt.slice(0, 80));
  res.json({ ok: true, chars: _config.systemPrompt.length, preview: _config.systemPrompt.slice(0, 100) });
});

// ── POST /admin/greeting ──────────────────────────────────────────────────────

router.post('/greeting', (req, res) => {
  const { greeting } = req.body || {};
  if (typeof greeting !== 'string' || greeting.trim().length < 2) {
    return res.status(400).json({ error: 'greeting: non-empty string' });
  }
  if (greeting.length > 500) {
    return res.status(400).json({ error: 'greeting: max 500 chars' });
  }
  _config.greeting = greeting.trim();
  process.env.TTS_GREETING = _config.greeting;
  console.log('[Admin] Greeting updated:', _config.greeting);
  res.json({ ok: true, greeting: _config.greeting });
});

// ── POST /admin/voice ─────────────────────────────────────────────────────────

const VALID_TTS_PROVIDERS = ['edge', 'elevenlabs', 'cartesia'];

router.post('/voice', (req, res) => {
  const { voice, provider } = req.body || {};
  if (!voice && !provider) {
    return res.status(400).json({ error: 'provide voice and/or provider' });
  }
  if (voice) {
    if (typeof voice !== 'string' || voice.length > 100) {
      return res.status(400).json({ error: 'voice: string, max 100 chars' });
    }
    _config.voice = voice.trim();
    process.env.TTS_VOICE = _config.voice;
  }
  if (provider) {
    if (!VALID_TTS_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: `provider: ${VALID_TTS_PROVIDERS.join(' | ')}` });
    }
    process.env.TTS_PROVIDER = provider;
  }
  res.json({ ok: true, voice: process.env.TTS_VOICE, provider: process.env.TTS_PROVIDER });
});

// ── POST /admin/providers ─────────────────────────────────────────────────────

const VALID_PROVIDERS = { stt: ['groq', 'deepgram'], llm: ['groq', 'openai'], tts: VALID_TTS_PROVIDERS };

router.post('/providers', (req, res) => {
  const { stt, llm, tts } = req.body || {};
  const errors = [];

  if (stt !== undefined) {
    if (!VALID_PROVIDERS.stt.includes(stt)) errors.push(`stt: ${VALID_PROVIDERS.stt.join('|')}`);
    else process.env.STT_PROVIDER = stt;
  }
  if (llm !== undefined) {
    if (!VALID_PROVIDERS.llm.includes(llm)) errors.push(`llm: ${VALID_PROVIDERS.llm.join('|')}`);
    else process.env.LLM_PROVIDER = llm;
  }
  if (tts !== undefined) {
    if (!VALID_PROVIDERS.tts.includes(tts)) errors.push(`tts: ${VALID_PROVIDERS.tts.join('|')}`);
    else process.env.TTS_PROVIDER = tts;
  }

  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  res.json({ ok: true, providers: { stt: process.env.STT_PROVIDER || 'groq', llm: process.env.LLM_PROVIDER || 'groq', tts: process.env.TTS_PROVIDER || 'edge' } });
});

// ── POST /admin/settings ──────────────────────────────────────────────────────
// Live-tune call behaviour without restart.

const VALID_FIRST_MSG_MODES = ['assistant', 'user', 'model'];

router.post('/settings', (req, res) => {
  const body = req.body || {};
  const changed = {};

  if (body.firstMessageMode !== undefined) {
    if (!VALID_FIRST_MSG_MODES.includes(body.firstMessageMode)) {
      return res.status(400).json({ error: `firstMessageMode: ${VALID_FIRST_MSG_MODES.join('|')}` });
    }
    process.env.FIRST_MESSAGE_MODE = body.firstMessageMode;
    changed.firstMessageMode = body.firstMessageMode;
  }

  if (body.idleTimeout1Ms !== undefined) {
    const v = parseInt(body.idleTimeout1Ms, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'idleTimeout1Ms: non-negative integer' });
    process.env.IDLE_TIMEOUT_1_MS = String(v);
    changed.idleTimeout1Ms = v;
  }

  if (body.idleTimeout2Ms !== undefined) {
    const v = parseInt(body.idleTimeout2Ms, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'idleTimeout2Ms: non-negative integer' });
    process.env.IDLE_TIMEOUT_2_MS = String(v);
    changed.idleTimeout2Ms = v;
  }

  if (typeof body.idleMessage1 === 'string') {
    if (body.idleMessage1.length > 200) return res.status(400).json({ error: 'idleMessage1: max 200 chars' });
    process.env.IDLE_MESSAGE_1 = body.idleMessage1.trim();
    changed.idleMessage1 = process.env.IDLE_MESSAGE_1;
  }

  if (typeof body.idleMessage2 === 'string') {
    if (body.idleMessage2.length > 200) return res.status(400).json({ error: 'idleMessage2: max 200 chars' });
    process.env.IDLE_MESSAGE_2 = body.idleMessage2.trim();
    changed.idleMessage2 = process.env.IDLE_MESSAGE_2;
  }

  if (body.vadSilenceMs !== undefined) {
    const v = parseInt(body.vadSilenceMs, 10);
    if (isNaN(v) || v < 100 || v > 3000) return res.status(400).json({ error: 'vadSilenceMs: 100-3000' });
    process.env.VAD_SILENCE_MS = String(v);
    changed.vadSilenceMs = v;
  }

  if (Object.keys(changed).length === 0) {
    return res.status(400).json({ error: 'No valid settings provided' });
  }

  console.log('[Admin] Settings updated:', changed);
  res.json({ ok: true, changed });
});

// ── GET /admin/tools ──────────────────────────────────────────────────────────

router.get('/tools', (_req, res) => {
  const { getTools } = require('../features/tools');
  res.json({ tools: getTools() });
});

// ── POST /admin/tools ─────────────────────────────────────────────────────────
// Replace NOVA_TOOLS at runtime (JSON array of tool definitions).

router.post('/tools', (req, res) => {
  const { tools } = req.body || {};
  if (!Array.isArray(tools)) {
    return res.status(400).json({ error: 'tools: array required' });
  }

  for (const t of tools) {
    if (!t.name || typeof t.name !== 'string') {
      return res.status(400).json({ error: 'each tool must have a name string' });
    }
    if (!t.url || typeof t.url !== 'string') {
      return res.status(400).json({ error: `tool "${t.name}" must have a url string` });
    }
  }

  process.env.NOVA_TOOLS = JSON.stringify(tools);
  clearToolsCache();
  console.log(`[Admin] Tools updated: ${tools.map(t => t.name).join(', ')}`);
  res.json({ ok: true, count: tools.length });
});

// ── GET /admin/calls ──────────────────────────────────────────────────────────

router.get('/calls', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  if (isNaN(limit) || limit < 1) return res.status(400).json({ error: 'limit: 1-100' });

  const phone = req.query.phone?.replace(/[^+\d]/g, '').slice(0, 20) || null;

  try {
    const params = [limit];
    const where = phone ? (params.push(`%${phone}%`), `WHERE phone_from LIKE $2`) : '';

    const result = await query(
      `SELECT id, call_id, phone_from, phone_to, started_at, ended_at,
              duration_sec, turn_count, hangup_cause, direction,
              stt_provider, tts_provider, llm_provider,
              summary, success_evaluation
       FROM novai_calls ${where}
       ORDER BY created_at DESC LIMIT $1`,
      params,
    );
    res.json({ calls: result.rows, count: result.rowCount });
  } catch (err) {
    console.error('[Admin] DB error on /calls:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /admin/calls/:callId ──────────────────────────────────────────────────

router.get('/calls/:callId', async (req, res) => {
  const callId = req.params.callId?.slice(0, 128);
  if (!callId) return res.status(400).json({ error: 'callId required' });

  try {
    const result = await query('SELECT * FROM novai_calls WHERE call_id = $1', [callId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Call not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Admin] DB error on /calls/:id:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── POST /admin/calls/:callId/transfer ───────────────────────────────────────

const E164_RE = /^\+[1-9]\d{6,14}$/;

router.post('/calls/:callId/transfer', async (req, res) => {
  const { to } = req.body || {};
  if (!to || !E164_RE.test(to)) {
    return res.status(400).json({ error: 'to: E.164 format required (+46701234567)' });
  }
  const callId = req.params.callId?.slice(0, 128);

  const { telnyxAction } = require('../webhooks');
  try {
    const ok = await telnyxAction(callId, 'transfer', { to: [{ phone_number: to }] });
    if (ok) {
      console.log(`[Admin] Transferred ${callId?.slice(-8)} → ${to}`);
      res.json({ ok: true, transferredTo: to });
    } else {
      res.status(502).json({ error: 'Transfer failed — check server logs' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/calls/outbound ────────────────────────────────────────────────
// Initiate an outbound call with optional variables and custom first message.

router.post('/calls/outbound', async (req, res) => {
  const { to, from, firstMessage, variables, connectionId } = req.body || {};

  if (!to || !E164_RE.test(to)) {
    return res.status(400).json({ error: 'to: E.164 format required (+46701234567)' });
  }
  if (from && !E164_RE.test(from)) {
    return res.status(400).json({ error: 'from: E.164 format required' });
  }
  if (firstMessage !== undefined && typeof firstMessage !== 'string') {
    return res.status(400).json({ error: 'firstMessage: string' });
  }
  if (variables !== undefined && (typeof variables !== 'object' || Array.isArray(variables))) {
    return res.status(400).json({ error: 'variables: object (key-value pairs)' });
  }

  const { initiateOutboundCall } = require('../features/outbound');
  try {
    const result = await initiateOutboundCall({ to, from, firstMessage, variables, connectionId });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Admin] Outbound call error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── POST /admin/calls/:callId/hangup ─────────────────────────────────────────
// Force-end an active call. Safe to call even if call is already ended.

router.post('/calls/:callId/hangup', async (req, res) => {
  const callId = req.params.callId?.slice(0, 128);
  if (!callId) return res.status(400).json({ error: 'callId required' });

  const { telnyxAction } = require('../webhooks');
  try {
    const ok = await telnyxAction(callId, 'hangup', {});
    if (ok) {
      console.log(`[Admin] Forced hangup: ${callId?.slice(-8)}`);
      res.json({ ok: true });
    } else {
      res.status(502).json({ error: 'Hangup failed — check server logs' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/stats ──────────────────────────────────────────────────────────
// Cost dashboard: daily call counts + costs for the last N days.

router.get('/stats', async (req, res) => {
  const days = Math.min(parseInt(req.query.days || '30', 10), 365);
  if (isNaN(days) || days < 1) return res.status(400).json({ error: 'days: 1-365' });

  try {
    const result = await query(
      `SELECT
         DATE(started_at)                     AS date,
         COUNT(*)::int                        AS calls,
         SUM(duration_sec)::int               AS total_seconds,
         ROUND(SUM(COALESCE(cost_usd, 0))::numeric, 4) AS total_cost_usd,
         ROUND(AVG(duration_sec)::numeric, 1) AS avg_duration_sec,
         COUNT(*) FILTER (WHERE hangup_cause = 'voicemail_detected')::int AS voicemail_count,
         COUNT(*) FILTER (WHERE hangup_cause = 'assistant_ended')::int    AS completed_count
       FROM novai_calls
       WHERE started_at > NOW() - ($1 || ' days')::interval
       GROUP BY DATE(started_at)
       ORDER BY date DESC`,
      [days],
    );

    const totals = result.rows.reduce((acc, r) => ({
      calls:        acc.calls     + (r.calls     || 0),
      total_seconds: acc.total_seconds + (r.total_seconds || 0),
      total_cost_usd: acc.total_cost_usd + parseFloat(r.total_cost_usd || 0),
    }), { calls: 0, total_seconds: 0, total_cost_usd: 0 });

    res.json({
      period_days: days,
      daily: result.rows,
      totals: {
        ...totals,
        total_cost_usd: parseFloat(totals.total_cost_usd.toFixed(4)),
        avg_cost_per_call: totals.calls
          ? parseFloat((totals.total_cost_usd / totals.calls).toFixed(4))
          : 0,
      },
    });
  } catch (err) {
    console.error('[Admin] DB error on /stats:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /admin/templates ──────────────────────────────────────────────────────

router.get('/templates', (_req, res) => {
  const { loadTemplates } = require('../features/templates');
  res.json({ templates: loadTemplates() });
});

// ── POST /admin/templates/:name ───────────────────────────────────────────────
// Save or overwrite a template. Use GET /admin/templates to load it into prompt.

router.post('/templates/:name', (req, res) => {
  const name    = req.params.name?.slice(0, 60);
  const content = req.body?.content;

  if (!name) return res.status(400).json({ error: 'name required' });
  if (typeof content !== 'string') return res.status(400).json({ error: 'content: string required' });

  const { saveTemplate } = require('../features/templates');
  try {
    saveTemplate(name, content);
    console.log(`[Admin] Template saved: ${name}`);
    res.json({ ok: true, name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /admin/prompt/template ───────────────────────────────────────────────
// Activate a saved template as the current system prompt.

router.post('/prompt/template', (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name: string required' });

  const { getTemplate } = require('../features/templates');
  const content = getTemplate(name.slice(0, 60));
  if (!content) return res.status(404).json({ error: `Template not found: ${name}` });

  _config.systemPrompt   = content;
  process.env.SYSTEM_PROMPT = content;
  clearPromptCache();
  console.log(`[Admin] Template "${name}" activated as system prompt`);
  res.json({ ok: true, name, chars: content.length, preview: content.slice(0, 100) });
});

// ── POST /admin/batch-calls ───────────────────────────────────────────────────
// Start a batch outbound campaign. Returns batchId to poll for status.
//
// Body: { numbers: [{to,firstMessage?,variables?},...], concurrency?, delayMs?, name? }

router.post('/batch-calls', async (req, res) => {
  const { numbers, concurrency, delayMs, name } = req.body || {};
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'numbers: non-empty array of {to,...} required' });
  }
  const { startBatch } = require('../features/batch-caller');
  try {
    const result = await startBatch({ numbers, concurrency, delayMs, name });
    res.json({ ok: true, ...result, total: numbers.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /admin/batch-calls ────────────────────────────────────────────────────

router.get('/batch-calls', (_req, res) => {
  const { listBatches } = require('../features/batch-caller');
  res.json({ batches: listBatches() });
});

// ── GET /admin/batch-calls/:batchId ──────────────────────────────────────────

router.get('/batch-calls/:batchId', (req, res) => {
  const { getBatch } = require('../features/batch-caller');
  const job = getBatch(req.params.batchId?.slice(0, 36));
  if (!job) return res.status(404).json({ error: 'Batch not found' });
  res.json(job);
});

// ── DELETE /admin/batch-calls/:batchId ───────────────────────────────────────

router.delete('/batch-calls/:batchId', (req, res) => {
  const { cancelBatch } = require('../features/batch-caller');
  const ok = cancelBatch(req.params.batchId?.slice(0, 36));
  if (!ok) return res.status(400).json({ error: 'Batch not found or already finished' });
  res.json({ ok: true, cancelled: true });
});

module.exports = { router, getConfig: () => ({ ..._config }) };
