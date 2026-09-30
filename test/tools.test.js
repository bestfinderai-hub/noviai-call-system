'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const {
  getTools, clearToolsCache,
  buildToolsPrompt, parseToolCalls, stripToolCalls, executeTool,
} = require('../src/features/tools');

// ── Tool loading ───────────────────────────────────────────────────────────────

test('getTools returns built-in tools', () => {
  clearToolsCache();
  const tools = getTools();
  assert.ok(Array.isArray(tools));
  assert.ok(tools.some(t => t.name === 'endCall'));
  assert.ok(tools.some(t => t.name === 'transferCall'));
});

test('getTools includes custom tools from NOVA_TOOLS env', () => {
  clearToolsCache();
  process.env.NOVA_TOOLS = JSON.stringify([{
    name: 'lookupOrder',
    description: 'Hämtar orderstatus',
    parameters: { type: 'object', properties: { orderId: { type: 'string', description: 'Order-ID' } } },
    url: 'https://example.com/api/order',
  }]);
  const tools = getTools();
  assert.ok(tools.some(t => t.name === 'lookupOrder'));
  delete process.env.NOVA_TOOLS;
  clearToolsCache();
});

test('getTools handles invalid NOVA_TOOLS JSON gracefully', () => {
  clearToolsCache();
  process.env.NOVA_TOOLS = 'NOT_VALID_JSON';
  const tools = getTools();
  assert.ok(Array.isArray(tools));
  assert.ok(tools.some(t => t.builtin)); // built-ins still present
  delete process.env.NOVA_TOOLS;
  clearToolsCache();
});

// ── Prompt building ────────────────────────────────────────────────────────────

test('buildToolsPrompt returns empty string for empty array', () => {
  assert.equal(buildToolsPrompt([]), '');
});

test('buildToolsPrompt includes tool names', () => {
  const tools = [{ name: 'testTool', description: 'test', parameters: { type: 'object', properties: {} } }];
  const prompt = buildToolsPrompt(tools);
  assert.ok(prompt.includes('testTool'));
  assert.ok(prompt.includes('<tool_call>'));
});

// ── Parsing ────────────────────────────────────────────────────────────────────

test('parseToolCalls finds tool_call in text', () => {
  const text = 'Visst, ett ögonblick.\n<tool_call>{"name":"lookupOrder","arguments":{"orderId":"12345"}}</tool_call>';
  const calls = parseToolCalls(text);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'lookupOrder');
  assert.equal(calls[0].arguments.orderId, '12345');
});

test('parseToolCalls returns empty array when no tags', () => {
  const calls = parseToolCalls('Hej, hur kan jag hjälpa dig?');
  assert.equal(calls.length, 0);
});

test('parseToolCalls ignores malformed JSON', () => {
  const text = '<tool_call>NOT_JSON</tool_call>';
  const calls = parseToolCalls(text);
  assert.equal(calls.length, 0);
});

test('parseToolCalls handles multiple tool calls', () => {
  const text = '<tool_call>{"name":"a","arguments":{}}</tool_call> text <tool_call>{"name":"b","arguments":{}}</tool_call>';
  const calls = parseToolCalls(text);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, 'a');
  assert.equal(calls[1].name, 'b');
});

test('stripToolCalls removes tool_call tags', () => {
  const text = 'Hej! <tool_call>{"name":"x"}</tool_call> Ha det bra.';
  const stripped = stripToolCalls(text);
  assert.ok(!stripped.includes('<tool_call>'));
  assert.ok(stripped.includes('Hej!'));
  assert.ok(stripped.includes('Ha det bra.'));
});

// ── Built-in execution ─────────────────────────────────────────────────────────

test('executeTool endCall returns endCall action', async () => {
  const result = await executeTool('endCall', { farewell: 'Ha en fin dag!' });
  assert.equal(result.action, 'endCall');
  assert.equal(result.result, 'Ha en fin dag!');
});

test('executeTool endCall without farewell returns default text', async () => {
  const result = await executeTool('endCall', {});
  assert.equal(result.action, 'endCall');
  assert.ok(result.result.length > 0);
});

test('executeTool transferCall valid E.164', async () => {
  const result = await executeTool('transferCall', { to: '+46701234567' });
  assert.equal(result.action, 'transfer');
  assert.equal(result.actionPayload.to, '+46701234567');
});

test('executeTool transferCall invalid number returns error text', async () => {
  const result = await executeTool('transferCall', { to: '0701234567' });
  assert.ok(!result.action);
  assert.ok(result.result.length > 0);
});

test('executeTool rejects non-http URL scheme', async () => {
  clearToolsCache();
  process.env.NOVA_TOOLS = JSON.stringify([{
    name: 'badScheme',
    description: 'test',
    url: 'file:///etc/passwd',
    parameters: { type: 'object', properties: {} },
  }]);
  const result = await executeTool('badScheme', {});
  assert.ok(!result.action);
  assert.ok(result.result.includes('ogiltigt URL-schema') || result.result.includes('felkonfigurerat'));
  delete process.env.NOVA_TOOLS;
  clearToolsCache();
});

test('executeTool unknown tool returns error text', async () => {
  const result = await executeTool('nonExistentTool', {});
  assert.ok(!result.action);
  assert.ok(result.result.includes('nonExistentTool'));
});
