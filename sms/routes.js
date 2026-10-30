'use strict';

// SMS Routes — referenskopia, aktiv fil är src/routes/sms.js
//
// Authenticated endpoints (Bearer NOVA_ADMIN_TOKEN):
//   POST /sms/send          — send SMS
//   GET  /sms/logs          — SMS history
//   GET  /sms/stats         — today stats
//   GET  /sms/device        — Android device health
//   GET  /sms/opted-out     — GDPR blocklist
//   POST /sms/opted-out     — block number
//   DELETE /sms/opted-out/:phone — unblock number
//
// Webhook (shared secret via X-SMS-Secret header):
//   POST /sms/webhook       — incoming SMS from Android gateway

const express   = require('express');
const { timingSafeEqual } = require('crypto');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { sendSms, getDeviceHealth, saveIncomingSms, optOut, optIn, listOptedOut } = require('../services/sms');

const router = express.Router();

// ── Rate limiting ─────────────────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'SMS send rate limit — max 10/min' },
});

// ── Auth ──────────────────────────────────────────────────────────────────────

function requireToken(req, res, next) {
  const token = process.env.NOVA_ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'Admin token not configured' });

  const provided = req.headers.authorization || '';
  const expected = `Bearer ${token}`;

  const bufA = Buffer.alloc(256);
  const bufB = Buffer.alloc(256);
  bufA.write(provided);
  bufB.write(expected);

  if (!timingSafeEqual(bufA, bufB)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Send SMS ──────────────────────────────────────────────────────────────────

router.post('/send', apiLimiter, sendLimiter, requireToken, express.json({ limit: '16kb' }), async (req, res) => {
  const { to, message, provider } = req.body || {};

  if (!to || typeof to !== 'string') return res.status(400).json({ error: 'Missing: to' });
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Missing: message' });

  try {
    const result = await sendSms(to.trim(), message.trim(), { provider });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── SMS Logs ──────────────────────────────────────────────────────────────────

router.get('/logs', apiLimiter, requireToken, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
  const offset = Math.max(parseInt(req.query.offset || '0',  10), 0);
  const dir    = req.query.direction;
  const phone  = req.query.phone;

  if (dir && !['in', 'out'].includes(dir)) {
    return res.status(400).json({ error: 'direction must be "in" or "out"' });
  }
  if (phone && !/^\+\d{7,15}$/.test(phone.replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Invalid phone format — use E.164 e.g. +46701234567' });
  }

  let sql = `SELECT id, direction, phone_to, phone_from, message, status, provider, provider_id, error, created_at, delivered_at
             FROM novai_sms`;
  const params = [];
  const conds  = [];

  if (dir)   { params.push(dir);              conds.push(`direction = $${params.length}`); }
  if (phone) {
    const norm = phone.replace(/\s/g, '');
    params.push(norm); const idxTo = params.length;
    params.push(norm); const idxFrom = params.length;
    conds.push(`(phone_to = $${idxTo} OR phone_from = $${idxFrom})`);
  }

  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  try {
    const rows = await query(sql, params);
    res.json({ ok: true, sms: rows.rows, limit, offset });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', apiLimiter, requireToken, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE direction='out')                                  AS total_out,
        COUNT(*) FILTER (WHERE direction='in')                                   AS total_in,
        COUNT(*) FILTER (WHERE direction='out' AND created_at > NOW()-INTERVAL '24h') AS today_out,
        COUNT(*) FILTER (WHERE direction='in'  AND created_at > NOW()-INTERVAL '24h') AS today_in,
        COUNT(*) FILTER (WHERE status='failed')                                  AS total_failed,
        COUNT(*) FILTER (WHERE provider='android')                               AS via_android,
        COUNT(*) FILTER (WHERE provider='telnyx')                                AS via_telnyx
      FROM novai_sms
    `);
    res.json({ ok: true, stats: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Device health ─────────────────────────────────────────────────────────────

router.get('/device', apiLimiter, requireToken, async (req, res) => {
  const health = await getDeviceHealth();
  res.json({ ok: true, device: health });
});

// ── Opt-out / GDPR block list ─────────────────────────────────────────────────

router.get('/opted-out', apiLimiter, requireToken, async (_req, res) => {
  const list = await listOptedOut();
  res.json({ ok: true, blocked: list });
});

router.post('/opted-out', apiLimiter, requireToken, express.json({ limit: '4kb' }), async (req, res) => {
  const { phone, reason } = req.body || {};
  if (!phone || !/^\+\d{7,15}$/.test(phone.replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Invalid phone (E.164 required)' });
  }
  await optOut(phone.replace(/\s/g, ''), reason || 'manual');
  res.json({ ok: true });
});

router.delete('/opted-out/:phone', apiLimiter, requireToken, async (req, res) => {
  const phone = decodeURIComponent(req.params.phone || '');
  if (!/^\+\d{7,15}$/.test(phone.replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Invalid phone' });
  }
  await optIn(phone.replace(/\s/g, ''));
  res.json({ ok: true });
});

// ── Incoming webhook (from Android gateway) ───────────────────────────────────

router.post('/webhook', express.json({ limit: '64kb' }), async (req, res) => {
  const secret = process.env.ANDROID_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Webhook not configured — set ANDROID_WEBHOOK_SECRET in .env' });

  const provided = req.headers['x-sms-secret'] || '';
  const bufA = Buffer.alloc(256); bufA.write(provided);
  const bufB = Buffer.alloc(256); bufB.write(secret);
  if (!timingSafeEqual(bufA, bufB)) return res.status(403).json({ error: 'Forbidden' });

  const { from, message, phoneNumber } = req.body || {};
  const sender = from || phoneNumber;
  if (!sender || !message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing required fields: from/phoneNumber, message' });
  }

  res.json({ ok: true });

  await saveIncomingSms(sender, process.env.SMS_FROM_NUMBER || '', message.slice(0, 1600), 'android');
  console.log(`[SMS] Incoming from ${sender.slice(-4)}: ${message.slice(0, 50)}`);
});

module.exports = { router };
