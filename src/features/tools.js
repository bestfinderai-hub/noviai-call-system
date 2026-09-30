'use strict';

// Tool execution engine — lets the LLM call external HTTP APIs or built-in actions.
//
// Built-in tools: endCall, transferCall
// Custom tools: loaded from NOVA_TOOLS env (JSON array) or config/tools.json
//
// Tool calling uses prompt injection with <tool_call> XML tags — works with any LLM.

const fs = require('fs');
const path = require('path');

// ── Built-in tools ─────────────────────────────────────────────────────────────

const BUILTIN_TOOLS = [
  {
    name: 'endCall',
    description: 'Avsluta samtalet naturligt när kunden är nöjd och det finns inget mer att göra. Anropa BARA när det är ett logiskt avslutsläge.',
    parameters: {
      type: 'object',
      properties: {
        farewell: { type: 'string', description: 'Avslutningsfras att tala innan samtalet avslutas, t.ex. "Ha en fin dag!"' },
      },
      required: [],
    },
    builtin: true,
  },
  {
    name: 'transferCall',
    description: 'Koppla vidare kunden till en människa eller annan avdelning. Använd när kunden vill tala med en person eller ärendet kräver mänsklig handläggning.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Telefonnummer i E.164-format, t.ex. +46701234567' },
        reason: { type: 'string', description: 'Kort förklaring varför, t.ex. "kunden vill tala med teknisk support"' },
      },
      required: ['to'],
    },
    builtin: true,
  },
];

// ── Tool loading ───────────────────────────────────────────────────────────────

let _customToolsCache = null;

function loadCustomTools() {
  if (_customToolsCache !== null) return _customToolsCache;

  const envTools = process.env.NOVA_TOOLS;
  if (envTools) {
    try {
      _customToolsCache = JSON.parse(envTools);
      return _customToolsCache;
    } catch {
      console.warn('[Tools] Invalid NOVA_TOOLS JSON — no custom tools loaded');
    }
  }

  const cfgPath = path.join(process.cwd(), 'config', 'tools.json');
  if (fs.existsSync(cfgPath)) {
    try {
      _customToolsCache = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      console.log(`[Tools] Loaded ${_customToolsCache.length} custom tools from config/tools.json`);
      return _customToolsCache;
    } catch {
      console.warn('[Tools] config/tools.json parse error — no custom tools loaded');
    }
  }

  _customToolsCache = [];
  return _customToolsCache;
}

function getTools() {
  return [...BUILTIN_TOOLS, ...loadCustomTools()];
}

function clearToolsCache() {
  _customToolsCache = null;
}

// ── System prompt injection ────────────────────────────────────────────────────

function buildToolsPrompt(tools) {
  if (!tools || tools.length === 0) return '';

  const lines = tools.map(t => {
    const params = Object.entries(t.parameters?.properties || {})
      .map(([k, v]) => `  ${k} (${v.type}): ${v.description || ''}`)
      .join('\n');
    return `• ${t.name}:\n  Beskrivning: ${t.description}\n${params ? '  Parametrar:\n' + params : '  Inga parametrar.'}`;
  }).join('\n\n');

  return `\n\nTILLGÄNGLIGA VERKTYG
Du kan anropa dessa verktyg under samtalet. Format (exakt):
<tool_call>{"name":"verktygsnamn","arguments":{"param":"värde"}}</tool_call>

${lines}

REGLER:
- Avsluta ALDRIG <tool_call>-taggen mitt i en mening — placera den på en egen rad
- Tala INTE om för kunden att du anropar ett verktyg
- Om du anropar endCall, säg en naturlig avskedsfras INNAN taggen
- Om du anropar transferCall, förklara kort för kunden att du kopplar vidare`;
}

// ── Tool call parsing ──────────────────────────────────────────────────────────

function parseToolCalls(text) {
  const calls = [];
  const re = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      calls.push(JSON.parse(m[1].trim()));
    } catch {
      console.warn('[Tools] Could not parse tool_call JSON:', m[1].slice(0, 100));
    }
  }
  return calls;
}

function stripToolCalls(text) {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
}

// ── Tool execution ─────────────────────────────────────────────────────────────

/**
 * Execute a named tool.
 * @returns {{ result: string, action?: 'endCall'|'transfer', actionPayload?: object }}
 */
async function executeTool(name, args = {}, ctx = {}) {
  // Built-in: endCall
  if (name === 'endCall') {
    const farewell = args.farewell || '';
    return { result: farewell || 'Samtalet avslutas.', action: 'endCall' };
  }

  // Built-in: transferCall
  if (name === 'transferCall') {
    const to = String(args.to || '').trim();
    if (!/^\+[1-9]\d{6,14}$/.test(to)) {
      return { result: 'Ogiltigt telefonnummer för vidarekoppling — kan inte koppla vidare.' };
    }
    const reason = args.reason || '';
    console.log(`[Tools] Transfer to ${to}${reason ? ' — ' + reason : ''}`);
    return { result: `Kopplar vidare${reason ? ' (' + reason + ')' : ''}...`, action: 'transfer', actionPayload: { to } };
  }

  // Custom HTTP tool
  const customTools = loadCustomTools();
  const tool = customTools.find(t => t.name === name);
  if (!tool) {
    console.warn(`[Tools] Unknown tool: "${name}"`);
    return { result: `Okänt verktyg: "${name}".` };
  }

  if (!tool.url) {
    console.warn(`[Tools] Tool "${name}" has no url`);
    return { result: 'Verktyget är felkonfigurerat (saknar url).' };
  }

  // Parse and validate URL — block invalid schemes and private/internal IPs (SSRF)
  let parsedUrl;
  try {
    parsedUrl = new URL(tool.url);
  } catch {
    console.warn(`[Tools] Tool "${name}" has invalid url: ${tool.url.slice(0, 50)}`);
    return { result: 'Verktyget är felkonfigurerat (ogiltig URL).' };
  }
  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    console.warn(`[Tools] Tool "${name}" blocked url scheme: ${parsedUrl.protocol}`);
    return { result: 'Verktyget är felkonfigurerat (ogiltigt URL-schema, bara https tillåtet).' };
  }
  const h = parsedUrl.hostname;
  if (
    h === 'localhost' || h === '0.0.0.0' || h === '[::1]' ||
    h.startsWith('127.') || h.startsWith('10.') ||
    h.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  ) {
    console.warn(`[Tools] SSRF blocked: ${h}`);
    return { result: 'Verktyget är felkonfigurerat (privata IP-adresser ej tillåtna).' };
  }

  const timeout = Math.min(tool.timeout || 5000, 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(tool.headers || {}),
    };
    if (ctx.callId) headers['X-NovAI-Call-Id'] = ctx.callId;
    if (ctx.phoneFrom) headers['X-NovAI-Phone-From'] = ctx.phoneFrom;

    const body = { ...args };
    if (ctx.callId) body._callId = ctx.callId;

    const res = await fetch(tool.url, {
      method: (tool.method || 'POST').toUpperCase(),
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const raw = await res.text();

    if (!res.ok) {
      console.warn(`[Tools] ${name} HTTP ${res.status}: ${raw.slice(0, 100)}`);
      return { result: `Verktyget svarade med fel (${res.status}).` };
    }

    let result;
    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(raw);
        result = data.result ?? data.message ?? data.text ?? data.answer ?? JSON.stringify(data);
      } catch {
        result = raw;
      }
    } else {
      result = raw;
    }

    result = String(result).slice(0, 500);
    console.log(`[Tools] ${name}(${JSON.stringify(args).slice(0, 80)}) → "${result.slice(0, 80)}"`);
    return { result };

  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[Tools] ${name} timed out after ${timeout}ms`);
      return { result: 'Verktyget svarade inte i tid, försök igen.' };
    }
    console.error(`[Tools] ${name} error:`, err.message);
    return { result: 'Verktyget rapporterade ett fel.' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  getTools,
  clearToolsCache,
  buildToolsPrompt,
  parseToolCalls,
  stripToolCalls,
  executeTool,
};
