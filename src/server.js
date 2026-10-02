'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');
const WebSocket = require('ws');

const { createWebhookRouter } = require('./webhooks');
const { CallSession } = require('./call-session');
const { warmup: warmupTts } = require('./services/tts');
const { initSchema } = require('./db');
const { router: adminRouter } = require('./routes/admin');
const { router: dashboardRouter } = require('./routes/dashboard');

// ── App setup ────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

// Active call sessions: callControlId → CallSession
const sessions = new Map();

// Caller metadata from webhook call.initiated → merged into CallSession on WS connect
// Keyed by callControlId, auto-cleaned when session starts
const callMeta = new Map();

// ── WebSocket server ─────────────────────────────────────────────────────────

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
  const callControlId = req.url?.split('/').pop();
  if (!callControlId) {
    console.warn('[WS] Connection without callControlId — closing');
    ws.close();
    return;
  }

  console.log(`[WS] Connected: ${callControlId.slice(-8)}`);

  // Pull caller meta stored by webhook handler (may not exist if WS arrived first)
  const meta = callMeta.get(callControlId) || {};
  callMeta.delete(callControlId);

  const session = new CallSession(callControlId, ws, meta);
  sessions.set(callControlId, session);

  session.on('ended', () => {
    sessions.delete(callControlId);
    console.log(`[WS] Session removed: ${callControlId.slice(-8)}`);
  });

  ws.on('message', (rawMsg) => {
    let msg;
    try { msg = JSON.parse(rawMsg); } catch { return; }

    switch (msg.event) {
      case 'start':
        console.log(`[WS] Stream started for ${callControlId.slice(-8)}`);
        session.sendGreeting().catch(err =>
          console.error('[WS] Greeting error:', err.message)
        );
        break;

      case 'media':
        if (msg.media?.track === 'inbound' || msg.media?.track === undefined) {
          session.handleAudioChunk(msg.media.payload);
        }
        break;

      case 'mark':
        session.handleMark(msg.mark?.name);
        break;

      case 'stop':
        console.log(`[WS] Stream stopped: ${callControlId.slice(-8)}`);
        session.cleanup();
        sessions.delete(callControlId);
        break;

      default:
        break;
    }
  });

  ws.on('close', (code) => {
    console.log(`[WS] Closed (${code}): ${callControlId.slice(-8)}`);
    if (sessions.has(callControlId)) {
      sessions.get(callControlId).cleanup();
      sessions.delete(callControlId);
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error (${callControlId.slice(-8)}):`, err.message);
  });
});

// WebSocket keepalive — ping Telnyx every 25s to prevent Railway/proxy timeouts
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  });
}, 25_000);

// Render free-tier keepalive — self-ping every 10 min to prevent sleep (15-min threshold)
if (process.env.NODE_ENV === 'production' && process.env.SERVER_DOMAIN) {
  setInterval(() => {
    const https = require('https');
    https.get(`https://${process.env.SERVER_DOMAIN}/health`, (res) => {
      res.resume(); // drain
    }).on('error', () => {}); // ignore errors silently
  }, 10 * 60 * 1000);
}

server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/audio-stream/')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// ── HTTP routes ───────────────────────────────────────────────────────────────

app.use('/webhooks/telnyx', createWebhookRouter(sessions, callMeta));
app.use('/admin', adminRouter);
app.use('/dashboard', dashboardRouter);

// Root status page
app.get('/', (_req, res) => {
  const uptime = Math.round(process.uptime());
  const m = Math.floor(uptime / 60), s = uptime % 60;
  const adminEnabled = !!process.env.NOVA_ADMIN_TOKEN;
  const dbEnabled = !!(process.env.NOVA_DATABASE_URL || process.env.AICHATT_DATABASE_URL);
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8">
<title>NoviAi Call System</title>
<meta http-equiv="refresh" content="10">
<style>
  body{font-family:monospace;background:#0f0f0f;color:#e0e0e0;padding:40px;max-width:640px}
  h1{color:#4ade80;margin-bottom:4px}
  .sub{color:#666;margin-bottom:32px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  td{padding:8px 12px;border-bottom:1px solid #222}
  td:first-child{color:#888;width:160px}
  td:last-child{color:#fff}
  .ok{color:#4ade80} .warn{color:#facc15} .off{color:#ef4444}
  a{color:#60a5fa;text-decoration:none}
  h3{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:24px 0 8px}
</style></head><body>
<h1>NoviAi Call System</h1>
<div class="sub">AI-telefoni · noviai.se</div>
<h3>Status</h3>
<table>
  <tr><td>Server</td><td class="ok">● Running</td></tr>
  <tr><td>Uptime</td><td>${m}m ${s}s</td></tr>
  <tr><td>Aktiva samtal</td><td>${sessions.size}</td></tr>
  <tr><td>Domän</td><td class="${process.env.SERVER_DOMAIN === 'localhost:3000' ? 'warn' : 'ok'}">${process.env.SERVER_DOMAIN || '—'}</td></tr>
  <tr><td>Databas</td><td class="${dbEnabled ? 'ok' : 'warn'}">${dbEnabled ? '✓ Ansluten' : '⚠ Ingen DB-URL'}</td></tr>
  <tr><td>Admin API</td><td class="${adminEnabled ? 'ok' : 'warn'}">${adminEnabled ? '✓ Aktiverat' : '⚠ Sätt NOVA_ADMIN_TOKEN'}</td></tr>
</table>
<h3>Providers</h3>
<table>
  <tr><td>STT</td><td>${process.env.STT_PROVIDER || 'groq'} · ${process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo'}</td></tr>
  <tr><td>LLM</td><td>${process.env.LLM_PROVIDER || 'groq'} · ${process.env.GROQ_LLM_MODEL || 'qwen/qwen3.8-27b'}</td></tr>
  <tr><td>TTS</td><td>${process.env.TTS_PROVIDER || 'edge'} · ${process.env.TTS_VOICE || 'sv-SE-SofieNeural'}</td></tr>
</table>
<h3>Endpoints</h3>
<table>
  <tr><td>Webhook</td><td><a href="/webhooks/telnyx">/webhooks/telnyx</a></td></tr>
  <tr><td>Health</td><td><a href="/health">/health</a></td></tr>
  <tr><td>Admin</td><td>${adminEnabled ? '<a href="/admin/config">/admin/config</a>' : '<span class="warn">/admin (ej aktiverat)</span>'}</td></tr>
  <tr><td>Samtal</td><td>${adminEnabled ? '<a href="/admin/calls">/admin/calls</a>' : '—'}</td></tr>
</table>
<p style="color:#333;font-size:11px">Uppdateras var 10:e sekund</p>
</body></html>`);
});

app.get('/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    version: require('../package.json').version,
    uptime: Math.round(process.uptime()),
    env: process.env.NODE_ENV || 'development',
    activeSessions: sessions.size,
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
    features: {
      sentiment: process.env.SENTIMENT_ENABLED === 'true',
      recording: process.env.RECORDING_ENABLED === 'true',
      megaStorage: !!(process.env.MEGA_EMAIL && process.env.MEGA_PASSWORD),
    },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PLACEHOLDER_TOKEN = 'byt-ut-detta-till-ett-starkt-losenord';

function validateEnv() {
  const required = ['TELNYX_API_KEY', 'GROQ_API_KEY', 'SERVER_DOMAIN'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('❌ Missing required env vars:', missing.join(', '));
    process.exit(1);
  }

  // Security warnings — don't block startup, but be loud about it
  const isProd = process.env.NODE_ENV === 'production' ||
    (process.env.SERVER_DOMAIN && !process.env.SERVER_DOMAIN.startsWith('localhost'));

  if (!process.env.TELNYX_PUBLIC_KEY) {
    const msg = '[Security] ⚠ TELNYX_PUBLIC_KEY not set — webhook signatures NOT verified!';
    isProd ? console.error(msg) : console.warn(msg);
  }

  if (!process.env.NOVA_ADMIN_TOKEN) {
    console.warn('[Security] ⚠ NOVA_ADMIN_TOKEN not set — admin API disabled');
  } else if (process.env.NOVA_ADMIN_TOKEN === PLACEHOLDER_TOKEN) {
    const msg = '[Security] ⚠ NOVA_ADMIN_TOKEN is the default placeholder — change it before deploying!';
    isProd ? console.error(msg) : console.warn(msg);
    if (isProd) process.exit(1); // hard stop in production with weak token
  }

  if (!process.env.NOVA_DATABASE_URL && !process.env.AICHATT_DATABASE_URL) {
    console.warn('[Security] ⚠ No database URL — call reports will not be saved');
  }
}

async function start() {
  validateEnv();

  // Init DB schema (non-blocking if no DB URL)
  const dbUrl = process.env.NOVA_DATABASE_URL || process.env.AICHATT_DATABASE_URL;
  if (dbUrl) {
    await initSchema().catch(err => console.warn('[DB] Init failed (non-fatal):', err.message));
  } else {
    console.warn('[DB] No database URL — call reports will not be saved');
  }

  server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║       NoviAi Call System  ✓          ║');
    console.log('╚══════════════════════════════════════╝');
    console.log(`  HTTP:      http://localhost:${PORT}`);
    console.log(`  Webhook:   http://localhost:${PORT}/webhooks/telnyx`);
    console.log(`  WebSocket: ws://localhost:${PORT}/audio-stream/:callControlId`);
    console.log(`  Admin:     http://localhost:${PORT}/admin/config  (kräver NOVA_ADMIN_TOKEN)`);
    console.log(`  Health:    http://localhost:${PORT}/health`);
    console.log(`  Voice:     ${process.env.TTS_VOICE || 'sv-SE-SofieNeural'}`);
    console.log(`  STT:       ${process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo'}`);
    console.log(`  LLM:       ${process.env.GROQ_LLM_MODEL || 'qwen/qwen3.8-27b'}`);
    console.log('');

    warmupTts();
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down...');
    for (const session of sessions.values()) session.cleanup();
    server.close(() => process.exit(0));
  });
}

start();

module.exports = { app, server };
