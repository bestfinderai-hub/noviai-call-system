'use strict';

// Swedish sales prompt templates — stored as .md files in config/templates/.
// Load via GET /admin/templates, apply via POST /admin/prompt with { template: 'lead-gen' }.
//
// Template name rules: a-z, 0-9, hyphens only (e.g. "lead-gen", "booking", "follow-up").

const fs   = require('fs');
const path = require('path');

const TEMPLATES_DIR    = path.join(process.cwd(), 'config', 'templates');
const TEMPLATE_NAME_RE = /^[a-z0-9-]+$/;

/**
 * Load all templates from disk. Returns { name: content } map.
 */
function loadTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return {};
  const result = {};
  for (const file of fs.readdirSync(TEMPLATES_DIR)) {
    if (!file.endsWith('.md') && !file.endsWith('.txt')) continue;
    const name = file.replace(/\.(md|txt)$/, '');
    try {
      result[name] = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8').trim();
    } catch { /* skip */ }
  }
  return result;
}

/**
 * Get a single template by name. Returns null if not found.
 */
function getTemplate(name) {
  if (!TEMPLATE_NAME_RE.test(name)) return null;
  for (const ext of ['.md', '.txt']) {
    try {
      return fs.readFileSync(path.join(TEMPLATES_DIR, name + ext), 'utf-8').trim();
    } catch { /* not found, try next ext */ }
  }
  return null;
}

/**
 * Save or overwrite a template.
 */
function saveTemplate(name, content) {
  if (!TEMPLATE_NAME_RE.test(name)) throw new Error('Template name: a-z, 0-9, hyphens only');
  if (!content || content.length < 10)  throw new Error('content: min 10 chars');
  if (content.length > 8000)            throw new Error('content: max 8000 chars');
  if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  fs.writeFileSync(path.join(TEMPLATES_DIR, `${name}.md`), content, 'utf-8');
}

module.exports = { loadTemplates, getTemplate, saveTemplate };
