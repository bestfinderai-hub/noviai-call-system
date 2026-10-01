'use strict';

const express = require('express');
const router  = express.Router();

// ── Dashboard HTML ────────────────────────────────────────────────────────────
// Serves a single-page admin dashboard at /dashboard
// Auth: token stored in localStorage, sent as Bearer on every API call

router.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(HTML);
});

module.exports = { router };

// ─────────────────────────────────────────────────────────────────────────────

const HTML = /* html */`<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NovAI Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0f;--surface:#12121a;--surface2:#1a1a26;--border:#252535;
  --text:#e8e8f0;--muted:#6b6b8a;--accent:#7c6dfa;--green:#4ade80;
  --red:#f87171;--yellow:#fbbf24;--blue:#60a5fa;
  --radius:10px;--font:'Inter',system-ui,sans-serif;
}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;font-size:14px}

/* ── Login ── */
#login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:40px;width:380px}
.login-card h1{font-size:22px;font-weight:700;margin-bottom:6px}
.login-card p{color:var(--muted);margin-bottom:28px;font-size:13px}
.login-card input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:11px 14px;color:var(--text);font-size:14px;font-family:monospace;outline:none;transition:border .2s}
.login-card input:focus{border-color:var(--accent)}
.login-card button{width:100%;margin-top:14px;background:var(--accent);border:none;border-radius:8px;padding:12px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s}
.login-card button:hover{opacity:.88}
#login-error{color:var(--red);font-size:12px;margin-top:10px;display:none}

/* ── App shell ── */
#app{height:100vh;display:none;flex-direction:row}
#app.visible{display:flex}

/* ── Sidebar ── */
#sidebar{width:220px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:20px 0}
.sidebar-logo{padding:0 20px 24px;font-size:18px;font-weight:800;letter-spacing:-.5px;color:#fff}
.sidebar-logo span{color:var(--accent)}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;border-radius:0;color:var(--muted);font-size:13px;font-weight:500;transition:all .15s;border-left:3px solid transparent}
.nav-item:hover{color:var(--text);background:rgba(124,109,250,.06)}
.nav-item.active{color:var(--text);background:rgba(124,109,250,.12);border-left-color:var(--accent)}
.nav-icon{font-size:16px;width:20px;text-align:center}
.sidebar-bottom{margin-top:auto;padding:0 20px}
.logout-btn{width:100%;background:transparent;border:1px solid var(--border);border-radius:8px;padding:9px;color:var(--muted);font-size:12px;cursor:pointer;transition:all .2s}
.logout-btn:hover{color:var(--red);border-color:var(--red)}

/* ── Main content ── */
#main{flex:1;overflow-y:auto;padding:32px}
.page{display:none}
.page.active{display:block}
h2{font-size:20px;font-weight:700;margin-bottom:6px}
.page-desc{color:var(--muted);font-size:13px;margin-bottom:28px}

/* ── Cards ── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px;margin-bottom:18px}
.card-title{font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:16px}
.card-row{display:flex;gap:16px;flex-wrap:wrap}

/* ── Stat cards ── */
.stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;flex:1;min-width:140px}
.stat-value{font-size:28px;font-weight:800;margin-bottom:4px}
.stat-label{font-size:12px;color:var(--muted)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.dot.green{background:var(--green)}
.dot.yellow{background:var(--yellow)}
.dot.red{background:var(--red)}

/* ── Forms ── */
label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;margin-top:14px}
label:first-child{margin-top:0}
input[type=text],input[type=number],select,textarea{
  width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
  padding:10px 13px;color:var(--text);font-size:13px;font-family:inherit;outline:none;
  transition:border .2s;resize:vertical
}
input:focus,select:focus,textarea:focus{border-color:var(--accent)}
select option{background:var(--surface)}
textarea{min-height:180px;font-family:'Courier New',monospace;font-size:12px;line-height:1.6}
.prompt-area{min-height:320px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
@media(max-width:700px){.row,.row3{grid-template-columns:1fr}}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{opacity:.88}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}
.btn-ghost:hover{color:var(--text);border-color:var(--muted)}
.btn-danger{background:rgba(248,113,113,.12);color:var(--red);border:1px solid rgba(248,113,113,.3)}
.btn-danger:hover{background:rgba(248,113,113,.2)}
.btn-green{background:rgba(74,222,128,.12);color:var(--green);border:1px solid rgba(74,222,128,.3)}
.btn-green:hover{background:rgba(74,222,128,.2)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.save-row{display:flex;align-items:center;gap:12px;margin-top:18px}
.save-status{font-size:12px;color:var(--green);opacity:0;transition:opacity .3s}
.save-status.show{opacity:1}

/* ── Tables ── */
.table-wrap{overflow-x:auto;border-radius:8px;border:1px solid var(--border)}
table{width:100%;border-collapse:collapse}
th{background:var(--surface2);padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
td{padding:11px 14px;border-top:1px solid var(--border);font-size:13px;vertical-align:middle}
tr:hover td{background:rgba(255,255,255,.02)}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
.badge-green{background:rgba(74,222,128,.15);color:var(--green)}
.badge-red{background:rgba(248,113,113,.15);color:var(--red)}
.badge-yellow{background:rgba(251,191,36,.15);color:var(--yellow)}
.badge-blue{background:rgba(96,165,250,.15);color:var(--blue)}
.badge-gray{background:rgba(107,107,138,.15);color:var(--muted)}

/* ── Transcript modal ── */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:90%;max-width:640px;max-height:80vh;overflow-y:auto;padding:28px}
.modal h3{font-size:16px;font-weight:700;margin-bottom:20px}
.msg{padding:10px 14px;border-radius:8px;margin-bottom:8px;font-size:13px;line-height:1.5;max-width:88%}
.msg.user{background:var(--surface2);margin-left:auto;text-align:right}
.msg.assistant{background:rgba(124,109,250,.1);border:1px solid rgba(124,109,250,.2)}
.msg-role{font-size:10px;font-weight:700;color:var(--muted);margin-bottom:4px;text-transform:uppercase}
.modal-close{float:right;background:transparent;border:none;color:var(--muted);font-size:20px;cursor:pointer;line-height:1}
.modal-close:hover{color:var(--text)}

/* ── Loading spinner ── */
.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(124,109,250,.3);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Refresh bar ── */
.refresh-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.refresh-bar .ts{font-size:11px;color:var(--muted)}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
</style>
</head>
<body>

<!-- Login -->
<div id="login-screen">
  <div class="login-card">
    <h1>NovAI Dashboard</h1>
    <p>Logga in med ditt admin-token</p>
    <input type="password" id="token-input" placeholder="Bearer token (NOVA_ADMIN_TOKEN)" autocomplete="off">
    <button onclick="login()">Logga in</button>
    <div id="login-error">Fel token — försök igen</div>
  </div>
</div>

<!-- App -->
<div id="app">
  <div id="sidebar">
    <div class="sidebar-logo">Nov<span>AI</span></div>
    <div class="nav-item active" onclick="nav('overview',this)"><span class="nav-icon">⚡</span> Översikt</div>
    <div class="nav-item" onclick="nav('prompt',this)"><span class="nav-icon">✍️</span> System Prompt</div>
    <div class="nav-item" onclick="nav('voice',this)"><span class="nav-icon">🎙️</span> Röst & Providers</div>
    <div class="nav-item" onclick="nav('settings',this)"><span class="nav-icon">⚙️</span> Inställningar</div>
    <div class="nav-item" onclick="nav('calls',this)"><span class="nav-icon">📞</span> Samtal</div>
    <div class="nav-item" onclick="nav('stats',this)"><span class="nav-icon">📊</span> Statistik</div>
    <div class="nav-item" onclick="nav('outbound',this)"><span class="nav-icon">📤</span> Ring ut</div>
    <div class="sidebar-bottom">
      <button class="logout-btn" onclick="logout()">Logga ut</button>
    </div>
  </div>

  <div id="main">

    <!-- OVERVIEW -->
    <div class="page active" id="page-overview">
      <h2>Översikt</h2>
      <p class="page-desc">Systemstatus och realtidsinfo</p>
      <div class="card-row" id="stat-cards">
        <div class="stat"><div class="stat-value" id="stat-status"><span class="dot green"></span>—</div><div class="stat-label">Status</div></div>
        <div class="stat"><div class="stat-value" id="stat-uptime">—</div><div class="stat-label">Uptime</div></div>
        <div class="stat"><div class="stat-value" id="stat-sessions">—</div><div class="stat-label">Aktiva samtal</div></div>
        <div class="stat"><div class="stat-value" id="stat-memory">—</div><div class="stat-label">Minne (MB)</div></div>
      </div>
      <div style="margin-top:18px" class="card">
        <div class="card-title">Konfiguration</div>
        <table style="font-size:13px">
          <tr><td style="color:var(--muted);width:160px;padding:6px 0">Röst</td><td id="ov-voice">—</td></tr>
          <tr><td style="color:var(--muted);padding:6px 0">STT</td><td id="ov-stt">—</td></tr>
          <tr><td style="color:var(--muted);padding:6px 0">LLM</td><td id="ov-llm">—</td></tr>
          <tr><td style="color:var(--muted);padding:6px 0">TTS Provider</td><td id="ov-tts">—</td></tr>
          <tr><td style="color:var(--muted);padding:6px 0">Hälsning</td><td id="ov-greeting" style="font-style:italic">—</td></tr>
          <tr><td style="color:var(--muted);padding:6px 0">Språk</td><td id="ov-lang">—</td></tr>
        </table>
      </div>
      <div class="refresh-bar">
        <span class="ts" id="overview-ts"></span>
        <button class="btn btn-ghost" onclick="loadOverview()">↻ Uppdatera</button>
      </div>
    </div>

    <!-- PROMPT -->
    <div class="page" id="page-prompt">
      <h2>System Prompt</h2>
      <p class="page-desc">AI:ns personlighet, instruktioner och beteende. Ändringar träder i kraft omedelbart — inga nya samtal avbryts.</p>
      <div class="card">
        <div class="card-title">Aktiv Prompt</div>
        <textarea class="prompt-area" id="prompt-text" placeholder="Du är Sofia, NovAI:s receptionist..."></textarea>
        <div class="save-row">
          <button class="btn btn-primary" onclick="savePrompt(this)">💾 Spara prompt</button>
          <span class="save-status" id="prompt-status">✓ Sparad</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Hälsningsfras</div>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Det första AI:n säger när ett samtal besvaras.</p>
        <input type="text" id="greeting-text" placeholder="NovAI, det här är Sofia, hur kan jag hjälpa dig?">
        <div class="save-row">
          <button class="btn btn-primary" onclick="saveGreeting(this)">💾 Spara hälsning</button>
          <span class="save-status" id="greeting-status">✓ Sparad</span>
        </div>
      </div>
    </div>

    <!-- VOICE & PROVIDERS -->
    <div class="page" id="page-voice">
      <h2>Röst & Providers</h2>
      <p class="page-desc">Byt röst och AI-tjänster live utan omstart.</p>
      <div class="card">
        <div class="card-title">TTS — Text till tal</div>
        <div class="row">
          <div>
            <label>Provider</label>
            <select id="tts-provider" onchange="onTtsProviderChange()">
              <option value="edge">Edge TTS (gratis)</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="cartesia">Cartesia</option>
            </select>
          </div>
          <div>
            <label>Röst / Voice ID</label>
            <select id="tts-voice-select" onchange="syncVoiceInput()">
              <option value="sv-SE-SofieNeural">sv-SE-SofieNeural (kvinna)</option>
              <option value="sv-SE-MattiasNeural">sv-SE-MattiasNeural (man)</option>
              <option value="custom">— Ange manuellt —</option>
            </select>
            <input type="text" id="tts-voice" style="margin-top:8px" placeholder="sv-SE-SofieNeural">
          </div>
        </div>
        <div class="save-row">
          <button class="btn btn-primary" onclick="saveVoice(this)">💾 Spara röst</button>
          <span class="save-status" id="voice-status">✓ Sparad</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">STT — Tal till text &amp; LLM</div>
        <div class="row">
          <div>
            <label>STT Provider</label>
            <select id="stt-provider">
              <option value="groq">Groq (Whisper)</option>
              <option value="deepgram">Deepgram</option>
            </select>
          </div>
          <div>
            <label>LLM Provider</label>
            <select id="llm-provider">
              <option value="groq">Groq</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
        </div>
        <div class="save-row">
          <button class="btn btn-primary" onclick="saveProviders(this)">💾 Spara providers</button>
          <span class="save-status" id="providers-status">✓ Sparad</span>
        </div>
      </div>
    </div>

    <!-- SETTINGS -->
    <div class="page" id="page-settings">
      <h2>Inställningar</h2>
      <p class="page-desc">Samtalsparametrar och timeouts. Träder i kraft på nästa samtal.</p>
      <div class="card">
        <div class="card-title">Samtalsbeteende</div>
        <div class="row3">
          <div>
            <label>VAD Tystnad (ms)</label>
            <input type="number" id="s-vad" min="100" max="3000" placeholder="300">
          </div>
          <div>
            <label>Max samtalstid (sek)</label>
            <input type="number" id="s-maxdur" min="30" max="3600" placeholder="600">
          </div>
          <div>
            <label>Max tokens (LLM-svar)</label>
            <input type="number" id="s-maxtok" min="50" max="1000" placeholder="150">
          </div>
        </div>
        <div class="row" style="margin-top:14px">
          <div>
            <label>First message mode</label>
            <select id="s-firstmsg">
              <option value="assistant">assistant — AI hälsar direkt</option>
              <option value="user">user — AI väntar på kunden</option>
              <option value="model">model — LLM genererar hälsning</option>
            </select>
          </div>
          <div>
            <label>Språk (CALL_LANGUAGE)</label>
            <select id="s-lang">
              <option value="sv">Svenska (sv)</option>
              <option value="en">Engelska (en)</option>
            </select>
          </div>
        </div>
        <div class="save-row">
          <button class="btn btn-primary" onclick="saveSettings(this)">💾 Spara inställningar</button>
          <span class="save-status" id="settings-status">✓ Sparad</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Idle Timeout — tystnad efter AI pratat</div>
        <div class="row">
          <div>
            <label>Timeout 1 (ms) — fråga</label>
            <input type="number" id="s-idle1" placeholder="10000">
          </div>
          <div>
            <label>Meddelande vid timeout 1</label>
            <input type="text" id="s-idle1msg" placeholder="Är du kvar?">
          </div>
        </div>
        <div class="row" style="margin-top:14px">
          <div>
            <label>Timeout 2 (ms) — lägg på</label>
            <input type="number" id="s-idle2" placeholder="8000">
          </div>
          <div>
            <label>Meddelande vid timeout 2 (tom = tyst avslut)</label>
            <input type="text" id="s-idle2msg" placeholder="Hej då, välkommen åter!">
          </div>
        </div>
        <div class="save-row">
          <button class="btn btn-primary" onclick="saveIdle(this)">💾 Spara timeouts</button>
          <span class="save-status" id="idle-status">✓ Sparad</span>
        </div>
      </div>
    </div>

    <!-- CALLS -->
    <div class="page" id="page-calls">
      <h2>Samtal</h2>
      <p class="page-desc">Senaste samtalen med transkript och metadata.</p>
      <div class="refresh-bar">
        <div style="display:flex;gap:10px;align-items:center">
          <input type="text" id="calls-phone-filter" placeholder="Filtrera på nummer..." style="width:220px">
          <button class="btn btn-ghost" onclick="loadCalls()">↻ Ladda</button>
        </div>
        <span class="ts" id="calls-ts"></span>
      </div>
      <div class="table-wrap">
        <table id="calls-table">
          <thead>
            <tr>
              <th>Tid</th><th>Från</th><th>Till</th><th>Riktning</th><th>Längd</th><th>Turer</th><th>Avslut</th><th>Transkript</th>
            </tr>
          </thead>
          <tbody id="calls-body">
            <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px">Klicka Ladda för att hämta samtal</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- STATS -->
    <div class="page" id="page-stats">
      <h2>Statistik</h2>
      <p class="page-desc">Daglig sammanfattning av samtalsvolymer och kostnader.</p>
      <div class="refresh-bar">
        <div style="display:flex;gap:10px;align-items:center">
          <label style="margin:0;color:var(--muted)">Dagar:</label>
          <select id="stats-days" onchange="loadStats()" style="width:100px">
            <option value="7">7</option>
            <option value="30" selected>30</option>
            <option value="90">90</option>
          </select>
        </div>
        <button class="btn btn-ghost" onclick="loadStats()">↻ Ladda</button>
      </div>
      <div class="card-row" id="stats-totals" style="margin-bottom:18px"></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Datum</th><th>Samtal</th><th>Total tid</th><th>Genomsnitt</th><th>Voicemail</th><th>Avslutade</th><th>Kostnad</th></tr>
          </thead>
          <tbody id="stats-body">
            <tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px">Klicka Ladda för att hämta statistik</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- OUTBOUND -->
    <div class="page" id="page-outbound">
      <h2>Ring ut</h2>
      <p class="page-desc">Starta ett utgående samtal direkt eller lägg till batch-kampanj.</p>
      <div class="card">
        <div class="card-title">Enskilt samtal</div>
        <div class="row">
          <div>
            <label>Telefonnummer (E.164)</label>
            <input type="text" id="ob-to" placeholder="+46701234567">
          </div>
          <div>
            <label>Hälsning (valfri)</label>
            <input type="text" id="ob-msg" placeholder="Hej, jag heter Sofia från NovAI...">
          </div>
        </div>
        <div style="margin-top:14px">
          <label>Variabler (JSON, valfritt)</label>
          <input type="text" id="ob-vars" placeholder='{"company":"Acme AB","name":"Anna"}'>
        </div>
        <div class="save-row">
          <button class="btn btn-green" onclick="makeCall(this)">📞 Ring nu</button>
          <span class="save-status" id="ob-status"></span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Batch-kampanj</div>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Klistra in nummer (ett per rad eller kommaseparerat). Varje nummer ringer ett samtal.</p>
        <textarea id="batch-numbers" placeholder="+46701234567&#10;+46709876543&#10;+46731112233" style="min-height:120px"></textarea>
        <div class="row" style="margin-top:14px">
          <div>
            <label>Parallellitet (max samtida samtal)</label>
            <input type="number" id="batch-concurrency" value="3" min="1" max="20">
          </div>
          <div>
            <label>Fördröjning mellan samtal (ms)</label>
            <input type="number" id="batch-delay" value="2000" min="500">
          </div>
        </div>
        <div class="save-row">
          <button class="btn btn-green" onclick="startBatch(this)">🚀 Starta kampanj</button>
          <span class="save-status" id="batch-status"></span>
        </div>
      </div>
    </div>

  </div><!-- /main -->
</div><!-- /app -->

<!-- Transcript modal -->
<div class="modal-overlay" id="modal">
  <div class="modal">
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3 id="modal-title">Transkript</h3>
    <div id="modal-body"></div>
  </div>
</div>

<script>
const BASE = '';  // same origin
let TOKEN = '';

// ── Auth ──────────────────────────────────────────────────────────────────────
async function login() {
  const t = document.getElementById('token-input').value.trim();
  if (!t) return;
  const res = await fetch(BASE + '/admin/config', { headers: { Authorization: 'Bearer ' + t } });
  if (res.status === 401 || res.status === 503) {
    document.getElementById('login-error').style.display = 'block';
    return;
  }
  TOKEN = t;
  localStorage.setItem('nova_token', t);
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  loadOverview();
  loadConfig();
}

function logout() {
  localStorage.removeItem('nova_token');
  location.reload();
}

document.getElementById('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

// Auto-login from storage
window.addEventListener('load', () => {
  const saved = localStorage.getItem('nova_token');
  if (saved) {
    TOKEN = saved;
    document.getElementById('token-input').value = saved;
    login();
  }
});

// ── Navigation ─────────────────────────────────────────────────────────────
function nav(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
  if (id === 'calls') loadCalls();
  if (id === 'stats') loadStats();
}

// ── API helpers ────────────────────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  try {
    const res = await fetch(BASE + path, opts);
    if (!res.ok && res.status === 401) { logout(); return null; }
    return res.json().catch(() => null);
  } catch {
    return { _networkError: true };
  }
}

function showStatus(id, msg = '✓ Sparad', color = 'var(--green)') {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.color = color;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

async function withLoading(btn, fn) {
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sparar...';
  try { await fn(); } finally { btn.disabled = false; btn.innerHTML = orig; }
}

// ── Overview ─────────────────────────────────────────────────────────────────
async function loadOverview() {
  const [health, config] = await Promise.all([
    api('/health'),
    api('/admin/config'),
  ]);
  if (!health || !config) return;

  const up = health.uptime;
  const m = Math.floor(up / 60), s = up % 60, h = Math.floor(m / 60);
  const upStr = h > 0 ? h + 'h ' + (m % 60) + 'm' : m + 'm ' + s + 's';

  document.getElementById('stat-status').innerHTML = '<span class="dot green"></span>' + health.status.toUpperCase();
  document.getElementById('stat-uptime').textContent = upStr;
  document.getElementById('stat-sessions').textContent = health.activeSessions;
  document.getElementById('stat-memory').textContent = health.memory.heapUsedMB + ' / ' + health.memory.heapTotalMB;

  document.getElementById('ov-voice').textContent    = config.voice;
  document.getElementById('ov-stt').textContent      = config.providers.stt + ' · ' + config.models.stt;
  document.getElementById('ov-llm').textContent      = config.providers.llm + ' · ' + config.models.llm;
  document.getElementById('ov-tts').textContent      = config.providers.tts;
  document.getElementById('ov-greeting').textContent = config.greeting;
  document.getElementById('ov-lang').textContent     = config.settings.language;
  document.getElementById('overview-ts').textContent = 'Uppdaterad ' + new Date().toLocaleTimeString('sv-SE');
}

// ── Config (fills all form fields) ────────────────────────────────────────────
async function loadConfig() {
  const c = await api('/admin/config');
  if (!c) return;

  // Prompt & Greeting
  document.getElementById('prompt-text').value  = c.systemPrompt === '(default — Sofia receptionist)' ? '' : c.systemPrompt;
  document.getElementById('greeting-text').value = c.greeting;

  // Voice
  document.getElementById('tts-provider').value = c.providers.tts;
  document.getElementById('tts-voice').value     = c.voice;
  const sel = document.getElementById('tts-voice-select');
  const known = Array.from(sel.options).map(o => o.value);
  sel.value = known.includes(c.voice) ? c.voice : 'custom';

  // Providers
  document.getElementById('stt-provider').value = c.providers.stt;
  document.getElementById('llm-provider').value = c.providers.llm;

  // Settings
  const s = c.settings;
  document.getElementById('s-vad').value      = s.vadSilenceMs;
  document.getElementById('s-maxdur').value   = s.maxCallDuration;
  document.getElementById('s-maxtok').value   = s.maxTokensLlm;
  document.getElementById('s-firstmsg').value = s.firstMessageMode;
  document.getElementById('s-lang').value     = s.language || 'sv';
  document.getElementById('s-idle1').value    = s.idleTimeout1Ms;
  document.getElementById('s-idle2').value    = s.idleTimeout2Ms;
  document.getElementById('s-idle1msg').value = s.idleMessage1 || '';
  document.getElementById('s-idle2msg').value = s.idleMessage2 || '';
}

// ── Prompt ────────────────────────────────────────────────────────────────────
async function savePrompt(btn) {
  const prompt = document.getElementById('prompt-text').value.trim();
  if (!prompt) { showStatus('prompt-status', '⚠ Tom prompt', 'var(--yellow)'); return; }
  await withLoading(btn, async () => {
    const r = await api('/admin/prompt', 'POST', { prompt });
    if (r?._networkError) showStatus('prompt-status', '✗ Servern svarar inte', 'var(--red)');
    else if (r?.ok) showStatus('prompt-status');
    else showStatus('prompt-status', '✗ ' + (r?.error || 'okänt'), 'var(--red)');
  });
}

async function saveGreeting(btn) {
  const greeting = document.getElementById('greeting-text').value.trim();
  if (!greeting) return;
  await withLoading(btn, async () => {
    const r = await api('/admin/greeting', 'POST', { greeting });
    if (r?._networkError) showStatus('greeting-status', '✗ Servern svarar inte', 'var(--red)');
    else if (r?.ok) showStatus('greeting-status');
    else showStatus('greeting-status', '✗ ' + (r?.error || 'okänt'), 'var(--red)');
  });
}

// ── Voice ─────────────────────────────────────────────────────────────────────
function onTtsProviderChange() {
  const p = document.getElementById('tts-provider').value;
  const sel = document.getElementById('tts-voice-select');
  if (p === 'edge') {
    sel.innerHTML = \`
      <option value="sv-SE-SofieNeural">sv-SE-SofieNeural (kvinna)</option>
      <option value="sv-SE-MattiasNeural">sv-SE-MattiasNeural (man)</option>
      <option value="custom">— Ange manuellt —</option>\`;
  } else {
    sel.innerHTML = '<option value="custom">— Ange Voice ID —</option>';
  }
  syncVoiceInput();
}

function syncVoiceInput() {
  const sel = document.getElementById('tts-voice-select');
  if (sel.value !== 'custom') document.getElementById('tts-voice').value = sel.value;
}

async function saveVoice(btn) {
  const voice    = document.getElementById('tts-voice').value.trim();
  const provider = document.getElementById('tts-provider').value;
  if (!voice) return;
  await withLoading(btn, async () => {
    const r = await api('/admin/voice', 'POST', { voice, provider });
    if (r?._networkError) showStatus('voice-status', '✗ Servern svarar inte', 'var(--red)');
    else if (r?.ok) showStatus('voice-status');
    else showStatus('voice-status', '✗ ' + (r?.error || 'okänt'), 'var(--red)');
  });
}

async function saveProviders(btn) {
  const stt = document.getElementById('stt-provider').value;
  const llm = document.getElementById('llm-provider').value;
  await withLoading(btn, async () => {
    const r = await api('/admin/providers', 'POST', { stt, llm });
    if (r?._networkError) showStatus('providers-status', '✗ Servern svarar inte', 'var(--red)');
    else if (r?.ok) showStatus('providers-status');
    else showStatus('providers-status', '✗ ' + (r?.error || 'okänt'), 'var(--red)');
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function saveSettings(btn) {
  const body = {
    vadSilenceMs:     parseInt(document.getElementById('s-vad').value),
    maxCallDuration:  parseInt(document.getElementById('s-maxdur').value),
    maxTokensLlm:     parseInt(document.getElementById('s-maxtok').value),
    firstMessageMode: document.getElementById('s-firstmsg').value,
    language:         document.getElementById('s-lang').value,
  };
  await withLoading(btn, async () => {
    const r = await api('/admin/settings', 'POST', body);
    if (r?._networkError) showStatus('settings-status', '✗ Servern svarar inte', 'var(--red)');
    else if (r?.ok) showStatus('settings-status');
    else showStatus('settings-status', '✗ ' + (r?.error || 'okänt'), 'var(--red)');
  });
}

async function saveIdle(btn) {
  const body = {
    idleTimeout1Ms: parseInt(document.getElementById('s-idle1').value),
    idleTimeout2Ms: parseInt(document.getElementById('s-idle2').value),
    idleMessage1:   document.getElementById('s-idle1msg').value,
    idleMessage2:   document.getElementById('s-idle2msg').value,
  };
  await withLoading(btn, async () => {
    const r = await api('/admin/settings', 'POST', body);
    if (r?._networkError) showStatus('idle-status', '✗ Servern svarar inte', 'var(--red)');
    else if (r?.ok) showStatus('idle-status');
    else showStatus('idle-status', '✗ ' + (r?.error || 'okänt'), 'var(--red)');
  });
}

// ── Calls ─────────────────────────────────────────────────────────────────────
async function loadCalls() {
  const phone = document.getElementById('calls-phone-filter').value.trim();
  const qs    = phone ? '?phone=' + encodeURIComponent(phone) + '&limit=50' : '?limit=50';
  const r = await api('/admin/calls' + qs);
  document.getElementById('calls-ts').textContent = 'Uppdaterad ' + new Date().toLocaleTimeString('sv-SE');

  const tbody = document.getElementById('calls-body');
  if (!r) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--red);padding:32px">⚠ Kunde inte hämta samtal — servern svarar inte</td></tr>';
    return;
  }
  if (!r.calls.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px">Inga samtal hittades</td></tr>';
    return;
  }

  tbody.innerHTML = r.calls.map(c => {
    const started = new Date(c.started_at);
    const dateStr = started.toLocaleDateString('sv-SE') + ' ' + started.toLocaleTimeString('sv-SE', {hour:'2-digit',minute:'2-digit'});
    const dur     = c.duration_sec != null ? fmtDur(c.duration_sec) : '—';
    const cause   = causeBadge(c.hangup_cause);
    const dir     = c.direction === 'incoming'
      ? '<span class="badge badge-blue">inkommande</span>'
      : '<span class="badge badge-yellow">utgående</span>';
    const hasTranscript = c.id ? 'onclick="loadTranscript(' + "'" + c.call_id + "'" + ')"' : '';
    return \`<tr>
      <td>\${dateStr}</td>
      <td style="font-family:monospace">\${esc(c.phone_from||'—')}</td>
      <td style="font-family:monospace">\${esc(c.phone_to||'—')}</td>
      <td>\${dir}</td>
      <td>\${dur}</td>
      <td>\${c.turn_count??'—'}</td>
      <td>\${cause}</td>
      <td><button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" \${hasTranscript}>📋 Visa</button></td>
    </tr>\`;
  }).join('');
}

async function loadTranscript(callId) {
  const r = await api('/admin/calls/' + encodeURIComponent(callId));
  if (!r) return;

  const transcript = r.transcript || r.messages || [];
  let html = '';
  if (r.summary) html += '<div style="background:rgba(124,109,250,.08);border:1px solid rgba(124,109,250,.2);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:var(--muted)"><strong style="color:var(--text)">Sammanfattning:</strong> ' + esc(r.summary) + '</div>';
  if (!transcript.length) html += '<p style="color:var(--muted)">Inget transkript</p>';
  transcript.forEach(m => {
    const role = m.role === 'user' ? 'user' : 'assistant';
    const name = role === 'user' ? '👤 Kund' : '🤖 Sofia';
    html += \`<div class="msg \${role}"><div class="msg-role">\${name}</div>\${esc(m.content)}</div>\`;
  });

  document.getElementById('modal-title').textContent = 'Transkript — ' + (r.phone_from || callId.slice(-8));
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.add('open');
}

function closeModal() { document.getElementById('modal').classList.remove('open'); }
document.getElementById('modal').addEventListener('click', e => { if (e.target === document.getElementById('modal')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  const days = document.getElementById('stats-days').value;
  const r = await api('/admin/stats?days=' + days);
  if (!r) return;

  const t = r.totals;
  const totalsEl = document.getElementById('stats-totals');
  totalsEl.innerHTML = [
    ['Samtal', t.calls, 'var(--accent)'],
    ['Total tid', fmtDur(t.total_seconds), 'var(--blue)'],
    ['Kostnad (USD)', '$' + t.total_cost_usd.toFixed(2), 'var(--green)'],
    ['Kostnad/samtal', '$' + (t.avg_cost_per_call||0).toFixed(4), 'var(--muted)'],
  ].map(([label, val, color]) =>
    \`<div class="stat"><div class="stat-value" style="color:\${color}">\${val}</div><div class="stat-label">\${label}</div></div>\`
  ).join('');

  const tbody = document.getElementById('stats-body');
  if (!r.daily.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px">Inga data</td></tr>';
    return;
  }
  tbody.innerHTML = r.daily.map(d => \`<tr>
    <td>\${d.date}</td>
    <td><strong>\${d.calls}</strong></td>
    <td>\${fmtDur(d.total_seconds)}</td>
    <td>\${d.avg_duration_sec ? d.avg_duration_sec + 's' : '—'}</td>
    <td>\${d.voicemail_count}</td>
    <td>\${d.completed_count}</td>
    <td style="font-family:monospace">$\${parseFloat(d.total_cost_usd).toFixed(4)}</td>
  </tr>\`).join('');
}

// ── Outbound ──────────────────────────────────────────────────────────────────
async function makeCall(btn) {
  const to  = document.getElementById('ob-to').value.trim();
  const msg = document.getElementById('ob-msg').value.trim();
  let   vars = {};
  const varsRaw = document.getElementById('ob-vars').value.trim();
  if (varsRaw) { try { vars = JSON.parse(varsRaw); } catch { showStatus('ob-status', '✗ Ogiltig JSON i variabler', 'var(--red)'); return; } }
  if (!to) { showStatus('ob-status', '✗ Ange telefonnummer', 'var(--red)'); return; }

  const body = { to };
  if (msg)  body.firstMessage = msg;
  if (Object.keys(vars).length) body.variables = vars;

  await withLoading(btn, async () => {
    const r = await api('/admin/calls/outbound', 'POST', body);
    if (r?._networkError) showStatus('ob-status', '✗ Servern svarar inte', 'var(--red)');
    else if (r?.ok) {
      showStatus('ob-status', '✓ Samtal startat — ' + to, 'var(--green)');
      document.getElementById('ob-to').value = '';
      document.getElementById('ob-msg').value = '';
      document.getElementById('ob-vars').value = '';
    } else {
      showStatus('ob-status', '✗ ' + (r?.error || 'Fel'), 'var(--red)');
    }
  });
}

async function startBatch(btn) {
  const raw = document.getElementById('batch-numbers').value.trim();
  if (!raw) return;
  const numbers = raw.split(/[,\\n]+/).map(s => s.trim()).filter(Boolean).map(to => ({ to }));
  if (!numbers.length) return;

  if (!confirm(\`Starta kampanj och ring \${numbers.length} nummer?\nDetta startar riktiga samtal.\`)) return;

  const concurrency = parseInt(document.getElementById('batch-concurrency').value) || 3;
  const delayMs     = parseInt(document.getElementById('batch-delay').value) || 2000;

  await withLoading(btn, async () => {
    const r = await api('/admin/batch-calls', 'POST', { numbers, concurrency, delayMs });
    if (r?._networkError) showStatus('batch-status', '✗ Servern svarar inte', 'var(--red)');
    else if (r?.ok) {
      showStatus('batch-status', '✓ Kampanj startad — ' + numbers.length + ' samtal', 'var(--green)');
      document.getElementById('batch-numbers').value = '';
    } else {
      showStatus('batch-status', '✗ ' + (r?.error || 'Fel'), 'var(--red)');
    }
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDur(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? m + 'm ' + s + 's' : s + 's';
}

function causeBadge(cause) {
  const map = {
    normal_clearing:   ['gray',   'avslutat'],
    assistant_ended:   ['green',  'slutfört'],
    voicemail_detected:['yellow', 'voicemail'],
    max_duration:      ['blue',   'max tid'],
    idle_timeout:      ['red',    'timeout'],
    transferred:       ['blue',   'transfer'],
  };
  const [color, label] = map[cause] || ['gray', cause || '—'];
  return \`<span class="badge badge-\${color}">\${label}</span>\`;
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Auto-refresh overview every 30s
setInterval(() => {
  const overviewActive = document.getElementById('page-overview').classList.contains('active');
  if (TOKEN && overviewActive) loadOverview();
}, 30_000);
</script>
</body>
</html>`;
