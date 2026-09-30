'use strict';

// Admin API tests — uses Node's built-in HTTP client, no extra deps.
// Starts server on a random port, runs tests, shuts down.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');

// Set test env before requiring anything
process.env.TELNYX_API_KEY  = 'test-key';
process.env.GROQ_API_KEY    = 'test-key';
process.env.SERVER_DOMAIN   = 'localhost:0';
process.env.NOVA_ADMIN_TOKEN = 'test-admin-token-secure-abc123';
process.env.NODE_ENV         = 'test';
// Skip DB in tests
delete process.env.NOVA_DATABASE_URL;
delete process.env.AICHATT_DATABASE_URL;

let _server, _port;

// Minimal express app — only admin routes, no DB init
function buildTestApp() {
  const express = require('express');
  const app = express();
  const { router } = require('../src/routes/admin');
  app.use('/admin', router);
  return app;
}

before(async () => {
  const app = buildTestApp();
  _server = http.createServer(app);
  await new Promise(resolve => _server.listen(0, '127.0.0.1', resolve));
  _port = _server.address().port;
});

after(async () => {
  await new Promise(resolve => _server.close(resolve));
});

// ── Helper ────────────────────────────────────────────────────────────────────

function req(method, path, body, token = 'test-admin-token-secure-abc123') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: _port,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

test('GET /admin/config — wrong token returns 401', async () => {
  const res = await req('GET', '/admin/config', null, 'wrong-token');
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Unauthorized');
});

test('GET /admin/config — no token returns 401', async () => {
  const res = await req('GET', '/admin/config', null, '');
  assert.equal(res.status, 401);
});

test('GET /admin/config — correct token returns 200', async () => {
  const res = await req('GET', '/admin/config');
  assert.equal(res.status, 200);
  assert.ok(res.body.providers);
  assert.ok(res.body.settings);
});

// ── Prompt ────────────────────────────────────────────────────────────────────

test('POST /admin/prompt — valid prompt returns ok', async () => {
  const res = await req('POST', '/admin/prompt', { prompt: 'Du är en testrobot för unit testing.' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.preview.includes('testrobot'));
});

test('POST /admin/prompt — too short returns 400', async () => {
  const res = await req('POST', '/admin/prompt', { prompt: 'Kort' });
  assert.equal(res.status, 400);
});

test('POST /admin/prompt — too long returns 400', async () => {
  const res = await req('POST', '/admin/prompt', { prompt: 'A'.repeat(8001) });
  assert.equal(res.status, 400);
});

test('POST /admin/prompt — missing prompt returns 400', async () => {
  const res = await req('POST', '/admin/prompt', {});
  assert.equal(res.status, 400);
});

// ── Greeting ──────────────────────────────────────────────────────────────────

test('POST /admin/greeting — valid returns ok', async () => {
  const res = await req('POST', '/admin/greeting', { greeting: 'Hej från testet!' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.greeting, 'Hej från testet!');
});

test('POST /admin/greeting — empty string returns 400', async () => {
  const res = await req('POST', '/admin/greeting', { greeting: '' });
  assert.equal(res.status, 400);
});

// ── Voice ─────────────────────────────────────────────────────────────────────

test('POST /admin/voice — valid voice returns ok', async () => {
  const res = await req('POST', '/admin/voice', { voice: 'sv-SE-MattiasNeural' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('POST /admin/voice — invalid provider returns 400', async () => {
  const res = await req('POST', '/admin/voice', { provider: 'nonexistent' });
  assert.equal(res.status, 400);
});

test('POST /admin/voice — no body returns 400', async () => {
  const res = await req('POST', '/admin/voice', {});
  assert.equal(res.status, 400);
});

// ── Providers ─────────────────────────────────────────────────────────────────

test('POST /admin/providers — valid stt/tts', async () => {
  const res = await req('POST', '/admin/providers', { stt: 'groq', tts: 'edge' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.providers.stt, 'groq');
});

test('POST /admin/providers — invalid stt returns 400', async () => {
  const res = await req('POST', '/admin/providers', { stt: 'aws-transcribe' });
  assert.equal(res.status, 400);
});

// ── Transfer input validation ─────────────────────────────────────────────────

test('POST /admin/calls/x/transfer — bad phone returns 400', async () => {
  const res = await req('POST', '/admin/calls/test-id/transfer', { to: '0701234567' }); // missing +
  assert.equal(res.status, 400);
  assert.ok(res.body.error.includes('E.164'));
});

test('POST /admin/calls/x/transfer — valid E.164 hits Telnyx (expected 502 in test)', async () => {
  const res = await req('POST', '/admin/calls/test-id/transfer', { to: '+46701234567' });
  // In test environment Telnyx call fails — 502 is expected and correct
  assert.ok([200, 500, 502].includes(res.status));
});

// ── Settings ──────────────────────────────────────────────────────────────────

test('POST /admin/settings — valid firstMessageMode returns ok', async () => {
  const res = await req('POST', '/admin/settings', { firstMessageMode: 'user' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.changed.firstMessageMode, 'user');
});

test('POST /admin/settings — invalid firstMessageMode returns 400', async () => {
  const res = await req('POST', '/admin/settings', { firstMessageMode: 'robot' });
  assert.equal(res.status, 400);
});

test('POST /admin/settings — valid idleTimeout1Ms returns ok', async () => {
  const res = await req('POST', '/admin/settings', { idleTimeout1Ms: 15000 });
  assert.equal(res.status, 200);
  assert.equal(res.body.changed.idleTimeout1Ms, 15000);
});

test('POST /admin/settings — negative idleTimeout returns 400', async () => {
  const res = await req('POST', '/admin/settings', { idleTimeout1Ms: -1 });
  assert.equal(res.status, 400);
});

test('POST /admin/settings — empty body returns 400', async () => {
  const res = await req('POST', '/admin/settings', {});
  assert.equal(res.status, 400);
});

// ── Tools ─────────────────────────────────────────────────────────────────────

test('GET /admin/tools — returns tools array', async () => {
  const res = await req('GET', '/admin/tools');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.tools));
  assert.ok(res.body.tools.some(t => t.name === 'endCall'));
  assert.ok(res.body.tools.some(t => t.name === 'transferCall'));
});

test('POST /admin/tools — valid array returns ok', async () => {
  const res = await req('POST', '/admin/tools', {
    tools: [{ name: 'myTool', description: 'test tool', url: 'https://example.com/api', parameters: { type: 'object', properties: {} } }],
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.count, 1);
});

test('POST /admin/tools — not an array returns 400', async () => {
  const res = await req('POST', '/admin/tools', { tools: 'not-array' });
  assert.equal(res.status, 400);
});

test('POST /admin/tools — tool missing url returns 400', async () => {
  const res = await req('POST', '/admin/tools', {
    tools: [{ name: 'noUrl', description: 'missing url' }],
  });
  assert.equal(res.status, 400);
});

// ── Outbound ──────────────────────────────────────────────────────────────────

test('POST /admin/calls/outbound — bad phone returns 400', async () => {
  const res = await req('POST', '/admin/calls/outbound', { to: '0701234567' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.includes('E.164'));
});

test('POST /admin/calls/outbound — missing to returns 400', async () => {
  const res = await req('POST', '/admin/calls/outbound', {});
  assert.equal(res.status, 400);
});

test('POST /admin/calls/outbound — valid E.164 hits Telnyx (expected 502 in test)', async () => {
  const res = await req('POST', '/admin/calls/outbound', {
    to: '+46701234567',
    firstMessage: 'Hej, det här är Sofia!',
    variables: { name: 'Anders' },
  });
  // Telnyx will fail in test env — 502 is expected and correct
  assert.ok([200, 502].includes(res.status));
});
