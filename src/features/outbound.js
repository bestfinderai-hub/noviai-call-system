'use strict';

// Outbound calling — initiate a call via Telnyx REST API.
// Variables and firstMessage are encoded in client_state (base64 JSON)
// and decoded on call.initiated to customize the session.

const TELNYX_BASE = 'https://api.telnyx.com/v2';

function telnyxHeaders() {
  return {
    Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Initiate an outbound call.
 *
 * @param {object} opts
 * @param {string} opts.to             - E.164 destination (required)
 * @param {string} [opts.from]         - caller ID (default: TELNYX_PHONE_NUMBER)
 * @param {string} [opts.firstMessage] - opening line (overrides TTS_GREETING)
 * @param {object} [opts.variables]    - {{key}} template vars injected into system prompt
 * @param {string} [opts.connectionId] - Telnyx connection (default: TELNYX_CONNECTION_ID)
 * @returns {Promise<{ callControlId: string }>}
 */
async function initiateOutboundCall({ to, from, firstMessage, variables, connectionId } = {}) {
  if (!to) throw new Error('to is required');

  const fromNumber  = from || process.env.TELNYX_PHONE_NUMBER;
  const connId      = connectionId || process.env.TELNYX_CONNECTION_ID;
  const webhookBase = `https://${process.env.SERVER_DOMAIN}`;

  if (!fromNumber)  throw new Error('No from number — set TELNYX_PHONE_NUMBER in .env');
  if (!connId)      throw new Error('No connection ID — set TELNYX_CONNECTION_ID in .env');
  if (!process.env.SERVER_DOMAIN || process.env.SERVER_DOMAIN.startsWith('localhost')) {
    throw new Error('SERVER_DOMAIN must be a public URL for outbound calls');
  }

  // Encode session customisation in client_state (base64 JSON)
  const clientStatePayload = { firstMessage: firstMessage || null, variables: variables || {} };
  const clientState = Buffer.from(JSON.stringify(clientStatePayload)).toString('base64');

  const body = {
    connection_id: connId,
    to,
    from: fromNumber,
    webhook_url: `${webhookBase}/webhooks/telnyx`,
    client_state: clientState,
  };

  // AMD (Answering Machine Detection) — on by default for outbound calls.
  // Fires call.machine.detection.ended with result: human | machine_start | machine_end_beep | etc.
  // Set AMD_ENABLED=false in .env to disable.
  if (process.env.AMD_ENABLED !== 'false') {
    body.amd = {
      enabled: true,
      total_analysis_time_millis: parseInt(process.env.AMD_TIMEOUT_MS || '5000', 10),
      silence_threshold_millis:   parseInt(process.env.AMD_SILENCE_MS  || '1500', 10),
    };
  }

  const res = await fetch(`${TELNYX_BASE}/calls`, {
    method: 'POST',
    headers: telnyxHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Telnyx outbound call failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const callControlId = data?.data?.call_control_id;
  if (!callControlId) throw new Error('Telnyx returned no call_control_id');

  console.log(`[Outbound] Initiated call to ${to} — id: ${callControlId.slice(-8)}`);
  return { callControlId };
}

module.exports = { initiateOutboundCall };
