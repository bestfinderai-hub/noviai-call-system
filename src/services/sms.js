'use strict';

// SMS Service — Android gateway primary, Telnyx fallback
//
// Env vars:
//   ANDROID_GATEWAY_URL   — e.g. http://192.168.1.100:8080 (local) or https://api.sms-gate.app (cloud)
//   ANDROID_GATEWAY_USER  — username (default: "user")
//   ANDROID_GATEWAY_PASS  — password
//   SMS_FROM_NUMBER       — your Telnyx number for fallback, e.g. +46851791777
//   SMS_PROVIDER          — "android" | "telnyx" | "auto" (default: auto)

const { query } = require('../db');

const TELNYX_BASE = 'https://api.telnyx.com/v2';

// Strip control characters that could cause issues in SMS payloads
function sanitizeMessage(msg) {
  return msg.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

// Retry a send function up to maxAttempts on network/5xx errors
async function withRetry(fn, maxAttempts = 2) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      // Don't retry on validation errors (4xx)
      if (/4\d\d/.test(err.message)) throw err;
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ── Opt-out / GDPR block list ─────────────────────────────────────────────────

async function isOptedOut(phone) {
  try {
    const { rows } = await query('SELECT 1 FROM novai_sms_opted_out WHERE phone = $1', [phone]);
    return rows.length > 0;
  } catch { return false; }
}

async function optOut(phone, reason = 'STOPP') {
  try {
    await query(
      'INSERT INTO novai_sms_opted_out (phone, reason) VALUES ($1, $2) ON CONFLICT (phone) DO NOTHING',
      [phone, reason]
    );
    console.log(`[SMS] Opt-out registered: ${phone.slice(-4)} (${reason})`);
  } catch (err) {
    console.error('[SMS] Opt-out save failed:', err.message);
  }
}

async function optIn(phone) {
  try {
    await query('DELETE FROM novai_sms_opted_out WHERE phone = $1', [phone]);
  } catch (err) {
    console.error('[SMS] Opt-in failed:', err.message);
  }
}

async function listOptedOut() {
  try {
    const { rows } = await query('SELECT phone, reason, created_at FROM novai_sms_opted_out ORDER BY created_at DESC');
    return rows;
  } catch { return []; }
}

// ── Android SMS Gateway (capcom6/android-sms-gateway) ────────────────────────

function androidBase() {
  return (process.env.ANDROID_GATEWAY_URL || '').replace(/\/$/, '');
}

function androidAuth() {
  const user = process.env.ANDROID_GATEWAY_USER || 'user';
  const pass = process.env.ANDROID_GATEWAY_PASS || '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

async function sendViaAndroid(to, message) {
  const base = androidBase();
  if (!base) throw new Error('ANDROID_GATEWAY_URL not set');

  const res = await fetch(`${base}/api/v1/messages`, {
    method: 'POST',
    headers: {
      Authorization: androidAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumbers: [to],
      message,
      withDeliveryReport: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Android gateway ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    provider: 'android',
    providerId: data.id,
    state: data.state || 'Pending',
  };
}

async function getDeviceHealth() {
  const base = androidBase();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/api/v1/health`, {
      headers: { Authorization: androidAuth() },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { online: false, status: res.status };
    const data = await res.json();
    return { online: true, ...data };
  } catch {
    return { online: false };
  }
}

// ── Telnyx SMS ────────────────────────────────────────────────────────────────

async function sendViaTelnyx(to, message) {
  const apiKey = process.env.TELNYX_API_KEY;
  const from   = process.env.SMS_FROM_NUMBER;

  if (!apiKey) throw new Error('TELNYX_API_KEY not set');
  if (!from)   throw new Error('SMS_FROM_NUMBER not set');

  const res = await fetch(`${TELNYX_BASE}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, text: message }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Telnyx SMS ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    provider: 'telnyx',
    providerId: data.data?.id,
    state: data.data?.to?.[0]?.status || 'queued',
  };
}

// ── Main send function ────────────────────────────────────────────────────────

async function sendSms(to, message, opts = {}) {
  const provider = opts.provider || process.env.SMS_PROVIDER || 'auto';

  // Sanitize phone number to E.164
  const normalized = to.replace(/\s/g, '');
  if (!/^\+\d{7,15}$/.test(normalized)) {
    throw new Error(`Invalid phone number: ${to}`);
  }

  // Check GDPR opt-out before sending
  if (await isOptedOut(normalized)) {
    throw new Error(`Number has opted out — cannot send SMS`);
  }

  const clean = sanitizeMessage(message);
  if (!clean) throw new Error('Message is empty after sanitization');
  if (clean.length > 1600) {
    throw new Error('Message too long (max 1600 chars)');
  }

  // Log to DB as pending
  let dbId = null;
  try {
    const row = await query(
      `INSERT INTO novai_sms (direction, phone_to, message, status, provider)
       VALUES ('out', $1, $2, 'pending', 'pending') RETURNING id`,
      [normalized, clean]
    );
    dbId = row.rows[0]?.id;
  } catch (err) {
    console.warn('[SMS] DB log failed (non-fatal):', err.message);
  }

  let result;
  let finalProvider;

  try {
    if (provider === 'telnyx') {
      result = await withRetry(() => sendViaTelnyx(normalized, clean));
      finalProvider = 'telnyx';
    } else if (provider === 'android') {
      result = await withRetry(() => sendViaAndroid(normalized, clean));
      finalProvider = 'android';
    } else {
      // auto: try Android first, fall back to Telnyx
      try {
        result = await withRetry(() => sendViaAndroid(normalized, clean));
        finalProvider = 'android';
      } catch (androidErr) {
        console.warn('[SMS] Android gateway failed, falling back to Telnyx:', androidErr.message);
        result = await withRetry(() => sendViaTelnyx(normalized, clean));
        finalProvider = 'telnyx';
      }
    }
  } catch (err) {
    if (dbId) {
      await query('UPDATE novai_sms SET status=$1, error=$2 WHERE id=$3', ['failed', err.message, dbId]).catch(() => {});
    }
    throw err;
  }

  if (dbId) {
    await query(
      'UPDATE novai_sms SET status=$1, provider=$2, provider_id=$3 WHERE id=$4',
      ['sent', finalProvider, result.providerId || null, dbId]
    ).catch(() => {});
  }

  console.log(`[SMS] Sent via ${finalProvider} → ${normalized.slice(-4)}`);
  return { ...result, dbId };
}

// ── Save incoming SMS ─────────────────────────────────────────────────────────

const STOPP_RE = /^\s*(stopp|stop|avregistrera|unsubscribe|quit|avsluta)\s*$/i;

async function saveIncomingSms(from, to, message, provider = 'telnyx') {
  const clean = sanitizeMessage(message || '');

  // Auto opt-out on STOPP keyword (Marknadsföringslagen 19 §)
  if (STOPP_RE.test(clean)) {
    await optOut(from, 'STOPP-svar');
  }

  try {
    await query(
      `INSERT INTO novai_sms (direction, phone_from, phone_to, message, status, provider)
       VALUES ('in', $1, $2, $3, 'received', $4)`,
      [from, to, clean, provider]
    );
  } catch (err) {
    console.error('[SMS] Failed to save incoming SMS:', err.message, { provider, from: from?.slice(-4) });
  }
}

module.exports = { sendSms, getDeviceHealth, saveIncomingSms, sendViaAndroid, sendViaTelnyx, isOptedOut, optOut, optIn, listOptedOut };
