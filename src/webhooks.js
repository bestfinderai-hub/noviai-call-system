'use strict';

const express   = require('express');
const { createVerify, createPublicKey } = require('crypto');
const rateLimit = require('express-rate-limit');
const router    = express.Router();

const TELNYX_BASE = 'https://api.telnyx.com/v2';

// callMeta TTL — entries auto-expire if WebSocket never connects
const CALL_META_TTL_MS = 30_000;

function telnyxHeaders() {
  return {
    Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ── Telnyx Ed25519 signature verification ─────────────────────────────────────

function verifyTelnyxSignature(rawBody, signature, timestamp) {
  const pubKeyB64 = process.env.TELNYX_PUBLIC_KEY;
  if (!pubKeyB64) {
    if (!verifyTelnyxSignature._warned) {
      verifyTelnyxSignature._warned = true;
      console.warn('[Webhook] ⚠ TELNYX_PUBLIC_KEY not set — signature verification DISABLED. Add it from Telnyx portal → Account → Webhooks → Ed25519 Public Key');
    }
    return true;
  }

  try {
    const signedPayload = Buffer.from(`${timestamp}|${rawBody}`);
    const sig    = Buffer.from(signature, 'base64');
    const prefix = Buffer.from('302a300506032b6570032100', 'hex');
    const keyBytes = Buffer.from(pubKeyB64, 'base64');
    const derKey   = Buffer.concat([prefix, keyBytes]);
    const publicKey = createPublicKey({ key: derKey, format: 'der', type: 'spki' });
    const verifier  = createVerify('Ed25519');
    verifier.update(signedPayload);
    return verifier.verify(publicKey, sig);
  } catch (err) {
    console.error('[Webhook] Signature verification error:', err.message);
    return false;
  }
}

// ── REST helper ───────────────────────────────────────────────────────────────

async function telnyxAction(callControlId, action, body = {}) {
  const url = `${TELNYX_BASE}/calls/${callControlId}/actions/${action}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: telnyxHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[Webhook] Telnyx ${action} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.ok;
}

// ── Streaming helper (shared by inbound + outbound answer) ────────────────────

async function startAudioStream(cid) {
  const streamUrl = `wss://${process.env.SERVER_DOMAIN}/audio-stream/${cid}`;
  const ok = await telnyxAction(cid, 'streaming_start', {
    stream_url: streamUrl,
    stream_track: 'inbound_track',
    send_silence_when_idle: true,
  });
  if (ok) console.log(`[Webhook] Streaming started → ${streamUrl}`);
  return ok;
}

// Tracks calls where we are actively speaking a voicemail message (wait for speak.ended before hangup)
const _voicemailSpeaking = new Set();

// ── callMeta helpers ──────────────────────────────────────────────────────────

function storeCallMeta(callMeta, cid, data) {
  if (!callMeta) return;
  callMeta.set(cid, data);
  setTimeout(() => {
    if (callMeta.has(cid)) {
      callMeta.delete(cid);
      console.warn(`[Webhook] callMeta TTL expired for ${cid.slice(-8)} — WS never connected`);
    }
  }, CALL_META_TTL_MS);
}

function parseClientState(clientState) {
  if (!clientState) return {};
  try {
    return JSON.parse(Buffer.from(clientState, 'base64').toString('utf-8'));
  } catch {
    return {};
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleCallInitiated(payload, callMeta) {
  const { call_control_id: cid, direction, from, to, client_state } = payload;

  // Decode per-call customisation from outbound client_state
  const state = parseClientState(client_state);

  storeCallMeta(callMeta, cid, {
    phoneFrom:    direction === 'incoming' ? from : to,
    phoneTo:      direction === 'incoming' ? to   : from,
    startedAt:    new Date(),
    firstMessage: state.firstMessage || null,
    variables:    state.variables    || {},
    direction:    direction === 'incoming' ? 'incoming' : 'outgoing',
  });

  if (direction === 'incoming') {
    console.log(`[Webhook] Answering inbound call: ${cid.slice(-8)} from=${from}`);
    await telnyxAction(cid, 'answer', {});
    await startAudioStream(cid);
  } else {
    // Outgoing: we wait for call.answered before streaming
    console.log(`[Webhook] Outbound call initiated: ${cid.slice(-8)} to=${to}`);
  }
}

async function handleCallAnswered(payload, sessions, callMeta) {
  const { call_control_id: cid, direction } = payload;

  if (direction === 'outgoing') {
    // Start streaming now that remote party answered
    console.log(`[Webhook] Outbound answered: ${cid.slice(-8)}`);
    await startAudioStream(cid);
  }

  if (sessions.get(cid)) {
    console.log(`[Webhook] Call answered, session exists: ${cid.slice(-8)}`);
  }
}

async function handleCallHangup(payload, sessions) {
  const { call_control_id: cid } = payload;
  const session = sessions.get(cid);
  if (session) {
    session.cleanup();
    sessions.delete(cid);
    console.log(`[Webhook] Hangup → session removed: ${cid.slice(-8)}`);
  }

  // Optional Google Sheets CRM logging
  const sheetsModule = process.env.GOOGLE_SHEETS_MODULE;
  if (sheetsModule) {
    try {
      const { logCallStats } = require(sheetsModule);
      await logCallStats({
        phone: payload.from || '',
        company: '',
        stage: 'samtal_avslutat',
        result: payload.hangup_cause || 'normal_clearing',
        callId: payload.call_control_id,
      });
    } catch (err) {
      console.warn('[Webhook] Sheets log failed:', err.message);
    }
  }
}

async function handleDtmf(payload, sessions) {
  const { call_control_id: cid, digit } = payload;
  const session = sessions.get(cid);
  if (session && digit) {
    session.handleDtmf(String(digit));
  }
}

async function handleAmdResult(payload, sessions, callMeta) {
  const { call_control_id: cid, result } = payload;
  console.log(`[Webhook] AMD: ${result} — ${cid.slice(-8)}`);

  if (!result || result === 'human') return;

  const voicemailMsg = process.env.VOICEMAIL_MESSAGE?.trim();

  // machine_end_beep = beep detected → perfect time to leave a voicemail message
  if (result === 'machine_end_beep' && voicemailMsg) {
    console.log(`[Webhook] AMD beep — leaving voicemail: ${cid.slice(-8)}`);
    _voicemailSpeaking.add(cid);
    const ok = await telnyxAction(cid, 'speak', {
      payload:      voicemailMsg,
      payload_type: 'text',
      voice:        'female',
      language:     process.env.CALL_LANGUAGE === 'sv' ? 'sv-SE' : 'en-US',
    });
    if (!ok) {
      _voicemailSpeaking.delete(cid);
      await telnyxAction(cid, 'hangup', {});
    }
    // Hang up happens in handleSpeakEnded when Telnyx fires call.speak.ended
    return;
  }

  console.log(`[Webhook] AMD non-human (${result}) — hanging up: ${cid.slice(-8)}`);
  await telnyxAction(cid, 'hangup', {});

  const session = sessions.get(cid);
  if (session) {
    session._hangupCause = 'voicemail_detected';
    session.cleanup();
    sessions.delete(cid);
  }
  if (callMeta) callMeta.delete(cid);
}

async function handleSpeakEnded(payload, sessions, callMeta) {
  const { call_control_id: cid } = payload;

  // Voicemail path — hang up after the message plays
  if (_voicemailSpeaking.has(cid)) {
    _voicemailSpeaking.delete(cid);
    console.log(`[Webhook] Voicemail message delivered — hanging up: ${cid.slice(-8)}`);
    await telnyxAction(cid, 'hangup', {});
    const session = sessions.get(cid);
    if (session) {
      session._hangupCause = 'voicemail_left';
      session.cleanup();
      sessions.delete(cid);
    }
    if (callMeta) callMeta.delete(cid);
    return;
  }

  // Normal conversation path — notify session that Telnyx speak finished
  const session = sessions.get(cid);
  if (session) {
    console.log(`[Webhook] call.speak.ended → notifying session: ${cid.slice(-8)}`);
    session.onSpeakEnded();
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

// Rate limit: 500 req/min — generous for Telnyx burst, blocks DoS
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many webhook requests' },
});

function createWebhookRouter(sessions, callMeta) {
  router.use(webhookLimiter);

  router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['telnyx-signature-ed25519'];
    const timestamp = req.headers['telnyx-timestamp'];
    const rawBody   = req.body.toString('utf-8');

    if (signature && timestamp) {
      if (!verifyTelnyxSignature(rawBody, signature, timestamp)) {
        console.warn('[Webhook] Invalid signature — request rejected');
        return res.status(403).json({ error: 'invalid signature' });
      }
    }

    // Acknowledge immediately — Telnyx requires fast 200 response
    res.json({ status: 'ok' });

    let event;
    try { event = JSON.parse(rawBody)?.data; } catch { return; }
    if (!event) return;

    const { event_type, payload } = event;
    console.log(`[Webhook] ${event_type} — ${(payload?.call_control_id || '').slice(-8)}`);

    const { publish } = require('./features/events');
    publish('webhook', { event_type, callId: payload?.call_control_id, from: payload?.from, to: payload?.to });

    try {
      switch (event_type) {
        case 'call.initiated':
          await handleCallInitiated(payload, callMeta);
          break;
        case 'call.answered':
          await handleCallAnswered(payload, sessions, callMeta);
          break;
        case 'call.hangup':
          await handleCallHangup(payload, sessions);
          break;
        case 'call.dtmf.received':
          await handleDtmf(payload, sessions);
          break;
        case 'call.machine.detection.ended':
          await handleAmdResult(payload, sessions, callMeta);
          break;
        case 'call.speak.ended':
          await handleSpeakEnded(payload, sessions, callMeta);
          break;
        case 'call.streaming.started':
          console.log('[Webhook] Audio streaming confirmed');
          break;
        case 'call.streaming.stopped':
          console.log('[Webhook] Audio streaming stopped');
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(`[Webhook] Error handling ${event_type}:`, err.message);
    }
  });

  return router;
}

module.exports = { createWebhookRouter, telnyxAction };
