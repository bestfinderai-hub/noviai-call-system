'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const os       = require('os');
const path     = require('path');
const fs       = require('fs');

process.env.NODE_ENV = 'test';

// Use a temp directory for templates in tests.
// Monkey-patch process.cwd BEFORE requiring the module so TEMPLATES_DIR
// (a module-level const) is resolved to tmpDir at load time.
const tmpDir = path.join(os.tmpdir(), `nova-templates-test-${Date.now()}`);
fs.mkdirSync(path.join(tmpDir, 'config', 'templates'), { recursive: true });

const origCwd = process.cwd.bind(process);
process.cwd = () => tmpDir;

const { loadTemplates, getTemplate, saveTemplate } = require('../src/features/templates');

// Restore immediately — TEMPLATES_DIR is already fixed as a const inside the module
process.cwd = origCwd;

test('loadTemplates returns empty object when dir is empty', () => {
  const result = loadTemplates();
  assert.ok(typeof result === 'object');
});

test('saveTemplate creates a template file', () => {
  saveTemplate('test-prompt', 'Du är en testagent. Hjälp kunden.');
  const templates = loadTemplates();
  assert.ok('test-prompt' in templates);
  assert.ok(templates['test-prompt'].includes('testagent'));
});

test('getTemplate returns content for existing template', () => {
  const content = getTemplate('test-prompt');
  assert.ok(content !== null);
  assert.ok(content.includes('testagent'));
});

test('getTemplate returns null for non-existent template', () => {
  const content = getTemplate('does-not-exist');
  assert.equal(content, null);
});

test('saveTemplate rejects invalid name', () => {
  assert.throws(() => saveTemplate('INVALID NAME!', 'content'), /name/i);
});

test('saveTemplate rejects too-short content', () => {
  assert.throws(() => saveTemplate('short', 'hi'), /min/i);
});

test('getTemplate returns null for invalid name', () => {
  const result = getTemplate('../../etc/passwd');
  assert.equal(result, null);
});
