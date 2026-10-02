'use strict';

const express = require('express');
const router  = express.Router();

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
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#07070f;--surface:#0f0f1a;--surface2:#161625;--surface3:#1d1d30;
  --border:#22223a;--border2:#2e2e4a;
  --text:#eeeef5;--muted:#6b6b90;--muted2:#9494b8;
  --accent:#7c6dfa;--accent2:#a99bfc;--accent-bg:rgba(124,109,250,.1);
  --green:#4ade80;--green-bg:rgba(74,222,128,.1);
  --red:#f87171;--red-bg:rgba(248,113,113,.1);
  --yellow:#fbbf24;--yellow-bg:rgba(251,191,36,.1);
  --blue:#60a5fa;--blue-bg:rgba(96,165,250,.1);
  --radius:10px;--radius-lg:16px;
  --font:'Inter',system-ui,-apple-system,sans-serif;
  --shadow:0 4px 24px rgba(0,0,0,.4);
}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;font-size:14px;-webkit-font-smoothing:antialiased}

/* ── Login ────────────────────────────────────── */
#login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;background:radial-gradient(ellipse at 50% 0%,rgba(124,109,250,.15) 0%,transparent 70%)}
.login-card{background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-lg);padding:44px;width:400px;box-shadow:var(--shadow)}
.login-logo{font-size:28px;font-weight:900;letter-spacing:-1px;color:#fff;margin-bottom:6px}
.login-logo span{color:var(--accent)}
.login-card p{color:var(--muted2);margin-bottom:32px;font-size:13px}
.login-card label{display:block;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
.login-card input{width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:8px;padding:12px 14px;color:var(--text);font-size:14px;font-family:monospace;outline:none;transition:border .2s;letter-spacing:.05em}
.login-card input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(124,109,250,.15)}
.login-card button{width:100%;margin-top:16px;background:var(--accent);border:none;border-radius:8px;padding:13px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:.02em}
.login-card button:hover{background:var(--accent2);transform:translateY(-1px);box-shadow:0 4px 16px rgba(124,109,250,.4)}
#login-error{display:none;color:var(--red);font-size:12px;margin-top:12px;padding:10px 12px;background:var(--red-bg);border-radius:8px;border:1px solid rgba(248,113,113,.2)}

/* ── App shell ────────────────────────────────── */
#app{height:100vh;display:none;flex-direction:row}
#app.visible{display:flex}

/* ── Sidebar ──────────────────────────────────── */
#sidebar{width:232px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:0}
.sidebar-header{padding:20px 20px 8px;border-bottom:1px solid var(--border)}
.sidebar-logo{font-size:20px;font-weight:900;letter-spacing:-1px;color:#fff}
.sidebar-logo span{color:var(--accent)}
.sidebar-subtitle{font-size:11px;color:var(--muted);margin-top:2px}
.nav-section{padding:12px 12px 4px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;margin:1px 8px;cursor:pointer;border-radius:8px;color:var(--muted2);font-size:13px;font-weight:500;transition:all .15s;user-select:none}
.nav-item:hover{color:var(--text);background:var(--surface2)}
.nav-item.active{color:var(--text);background:var(--accent-bg);font-weight:600}
.nav-item.active .nav-icon{color:var(--accent)}
.nav-icon{font-size:15px;width:20px;text-align:center;flex-shrink:0}
.nav-badge{margin-left:auto;background:var(--accent);color:#fff;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700}
.nav-badge.green{background:var(--green);color:#000}
.sidebar-bottom{margin-top:auto;padding:12px;border-top:1px solid var(--border)}
.sidebar-user{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;margin-bottom:8px;background:var(--surface2)}
.sidebar-user-dot{width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0}
.sidebar-user-info{flex:1;min-width:0}
.sidebar-user-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sidebar-user-role{font-size:10px;color:var(--muted)}
.logout-btn{width:100%;background:transparent;border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--muted);font-size:12px;cursor:pointer;transition:all .2s}
.logout-btn:hover{color:var(--red);border-color:rgba(248,113,113,.4);background:var(--red-bg)}

/* ── Main ─────────────────────────────────────── */
#main{flex:1;overflow-y:auto;background:var(--bg)}
.page{display:none;padding:32px;max-width:1200px}
.page.active{display:block}
.page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px}
.page-title h2{font-size:22px;font-weight:800;letter-spacing:-.5px}
.page-title p{color:var(--muted2);font-size:13px;margin-top:4px}
.page-actions{display:flex;gap:8px;flex-shrink:0}

/* ── Grid ─────────────────────────────────────── */
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px}
@media(max-width:900px){.grid2,.grid3,.grid4{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.grid2,.grid3,.grid4{grid-template-columns:1fr}}

/* ── Cards ────────────────────────────────────── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px;margin-bottom:16px}
.card:last-child{margin-bottom:0}
.card-title{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card-title-icon{font-size:14px}

/* ── Stat cards ───────────────────────────────── */
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px 22px;transition:border .2s}
.stat-card:hover{border-color:var(--border2)}
.stat-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.stat-label{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.stat-icon{font-size:18px;opacity:.7}
.stat-value{font-size:30px;font-weight:900;letter-spacing:-1px;line-height:1}
.stat-value.accent{color:var(--accent2)}
.stat-value.green{color:var(--green)}
.stat-value.blue{color:var(--blue)}
.stat-value.yellow{color:var(--yellow)}
.stat-sub{font-size:11px;color:var(--muted);margin-top:6px}
.stat-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}
.stat-dot.green{background:var(--green);box-shadow:0 0 6px var(--green)}
.stat-dot.yellow{background:var(--yellow)}
.stat-dot.red{background:var(--red)}

/* ── Forms ────────────────────────────────────── */
.field{margin-bottom:14px}
.field:last-child{margin-bottom:0}
.field label{display:block;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px}
.field-hint{font-size:11px;color:var(--muted);margin-top:5px}
input[type=text],input[type=number],input[type=password],select,textarea{
  width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;
  padding:10px 13px;color:var(--text);font-size:13px;font-family:inherit;outline:none;
  transition:border .2s,box-shadow .2s;resize:vertical;-webkit-appearance:none
}
input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(124,109,250,.12)}
input::placeholder,textarea::placeholder{color:var(--muted)}
select option{background:var(--surface2);color:var(--text)}
textarea{min-height:180px;line-height:1.65}
.prompt-area{min-height:340px;font-family:'Courier New',monospace;font-size:12px}
.char-counter{text-align:right;font-size:11px;color:var(--muted);margin-top:5px}
.char-counter.warn{color:var(--yellow)}
.char-counter.over{color:var(--red)}
.input-with-btn{display:flex;gap:8px}
.input-with-btn input{flex:1}

/* ── Buttons ──────────────────────────────────── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 18px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap;font-family:inherit}
.btn-primary{background:var(--accent);color:#fff;box-shadow:0 2px 8px rgba(124,109,250,.3)}
.btn-primary:hover:not(:disabled){background:var(--accent2);transform:translateY(-1px);box-shadow:0 4px 16px rgba(124,109,250,.4)}
.btn-ghost{background:transparent;color:var(--muted2);border:1px solid var(--border2)}
.btn-ghost:hover:not(:disabled){color:var(--text);border-color:var(--muted);background:var(--surface2)}
.btn-danger{background:var(--red-bg);color:var(--red);border:1px solid rgba(248,113,113,.25)}
.btn-danger:hover:not(:disabled){background:rgba(248,113,113,.2)}
.btn-success{background:var(--green-bg);color:var(--green);border:1px solid rgba(74,222,128,.25)}
.btn-success:hover:not(:disabled){background:rgba(74,222,128,.2)}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-icon{padding:8px;border-radius:7px}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important}
.btn-row{display:flex;align-items:center;gap:10px;margin-top:18px;flex-wrap:wrap}
.save-msg{font-size:12px;opacity:0;transition:opacity .3s;margin-left:2px}
.save-msg.show{opacity:1}

/* ── Tables ───────────────────────────────────── */
.table-wrap{overflow-x:auto;border-radius:var(--radius);border:1px solid var(--border)}
.table-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px;flex-wrap:wrap}
.table-toolbar-left{display:flex;gap:8px;align-items:center;flex:1}
table{width:100%;border-collapse:collapse}
th{background:var(--surface2);padding:10px 14px;text-align:left;font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;white-space:nowrap}
td{padding:11px 14px;border-top:1px solid var(--border);font-size:13px;vertical-align:middle}
tr:hover td{background:rgba(255,255,255,.015)}
.empty-row td{text-align:center;padding:48px 20px;color:var(--muted)}
.empty-icon{font-size:32px;display:block;margin-bottom:8px}
.loading-row td{text-align:center;padding:48px 20px;color:var(--muted)}

/* ── Badges ───────────────────────────────────── */
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.badge-green{background:var(--green-bg);color:var(--green)}
.badge-red{background:var(--red-bg);color:var(--red)}
.badge-yellow{background:var(--yellow-bg);color:var(--yellow)}
.badge-blue{background:var(--blue-bg);color:var(--blue)}
.badge-gray{background:rgba(107,107,144,.15);color:var(--muted2)}
.badge-accent{background:var(--accent-bg);color:var(--accent2)}

/* ── Copy button ──────────────────────────────── */
.copy-field{display:flex;gap:8px;align-items:center}
.copy-field input{flex:1;font-family:monospace;font-size:12px;letter-spacing:.03em}
.copy-btn{flex-shrink:0}

/* ── Toast notifications ──────────────────────── */
#toast-container{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast{background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:13px 16px;box-shadow:var(--shadow);display:flex;align-items:center;gap:12px;min-width:280px;max-width:380px;pointer-events:auto;transform:translateX(120%);transition:transform .3s cubic-bezier(.34,1.56,.64,1);font-size:13px}
.toast.show{transform:translateX(0)}
.toast-icon{font-size:16px;flex-shrink:0}
.toast-body{flex:1}
.toast-title{font-weight:700;margin-bottom:1px}
.toast-msg{font-size:12px;color:var(--muted2)}
.toast-close{background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:0;line-height:1;flex-shrink:0}
.toast-close:hover{color:var(--text)}
.toast.success{border-color:rgba(74,222,128,.3)}
.toast.success .toast-icon{color:var(--green)}
.toast.error{border-color:rgba(248,113,113,.3)}
.toast.error .toast-icon{color:var(--red)}
.toast.info{border-color:rgba(124,109,250,.3)}
.toast.info .toast-icon{color:var(--accent2)}

/* ── Modal ────────────────────────────────────── */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;align-items:center;justify-content:center;padding:20px}
.modal-overlay.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-lg);width:100%;max-width:660px;max-height:85vh;overflow-y:auto;box-shadow:var(--shadow)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);z-index:1}
.modal-header h3{font-size:16px;font-weight:700}
.modal-meta{font-size:12px;color:var(--muted);margin-top:3px}
.modal-close{background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--muted2);font-size:14px;cursor:pointer;padding:5px 9px;transition:all .15s}
.modal-close:hover{color:var(--text);border-color:var(--muted)}
.modal-body{padding:20px 24px}
.msg{padding:10px 14px;border-radius:8px;margin-bottom:8px;font-size:13px;line-height:1.55;max-width:85%}
.msg.user{background:var(--surface2);border:1px solid var(--border);margin-left:auto}
.msg.assistant{background:var(--accent-bg);border:1px solid rgba(124,109,250,.2)}
.msg-role{font-size:10px;font-weight:700;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
.msg-summary{background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:14px;margin-bottom:16px;font-size:12px;color:var(--muted2);line-height:1.55}
.msg-summary strong{color:var(--text);display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:.5px}

/* ── Spinner ──────────────────────────────────── */
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.25);border-top-color:currentColor;border-radius:50%;animation:spin .65s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Chart ────────────────────────────────────── */
.chart-wrap{position:relative;height:220px;margin-top:4px}

/* ── Quick actions ────────────────────────────── */
.quick-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
.qa-btn{display:flex;align-items:center;gap:7px;padding:9px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--muted2);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit}
.qa-btn:hover{color:var(--text);border-color:var(--border2);background:var(--surface2)}
.qa-btn .qa-icon{font-size:14px}

/* ── Config row ───────────────────────────────── */
.config-row{display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)}
.config-row:last-child{border-bottom:none}
.config-row-label{font-size:12px;color:var(--muted);width:160px;flex-shrink:0}
.config-row-value{flex:1;font-size:13px;font-family:monospace}
.config-row-action{flex-shrink:0}

/* ── Preset templates ─────────────────────────── */
.preset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:16px}
.preset-card{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px;cursor:pointer;transition:all .15s}
.preset-card:hover{border-color:var(--accent);background:var(--accent-bg)}
.preset-card.selected{border-color:var(--accent);background:var(--accent-bg)}
.preset-icon{font-size:22px;margin-bottom:8px}
.preset-name{font-size:12px;font-weight:700}
.preset-desc{font-size:11px;color:var(--muted);margin-top:3px}

/* ── Scrollbar ────────────────────────────────── */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}

/* ── Keyboard hint ────────────────────────────── */
kbd{background:var(--surface2);border:1px solid var(--border2);border-radius:4px;padding:1px 5px;font-size:10px;font-family:monospace;color:var(--muted2)}
</style>
</head>
<body>

<div id="toast-container"></div>

<!-- Login -->
<div id="login-screen">
  <div class="login-card">
    <div class="login-logo">Nov<span>AI</span></div>
    <p>Admin Dashboard — ange ditt token för att logga in</p>
    <label>Admin Token</label>
    <input type="password" id="token-input" placeholder="c3dd8feab5..." autocomplete="current-password">
    <button onclick="login()">Logga in →</button>
    <div id="login-error">⚠ Fel token eller servern är nere — försök igen</div>
  </div>
</div>

<!-- App -->
<div id="app">
  <div id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">Nov<span>AI</span></div>
      <div class="sidebar-subtitle">Call System Dashboard</div>
    </div>
    <div class="nav-section">Översikt</div>
    <div class="nav-item active" onclick="nav('overview',this)"><span class="nav-icon">⚡</span> Live Översikt</div>
    <div class="nav-item" onclick="nav('setup',this)"><span class="nav-icon">🔧</span> Konfiguration</div>
    <div class="nav-section">AI & Röst</div>
    <div class="nav-item" onclick="nav('prompt',this)"><span class="nav-icon">✍️</span> System Prompt</div>
    <div class="nav-item" onclick="nav('voice',this)"><span class="nav-icon">🎙️</span> Röst & Providers</div>
    <div class="nav-item" onclick="nav('settings',this)"><span class="nav-icon">⚙️</span> Samtalsinställningar</div>
    <div class="nav-section">Data</div>
    <div class="nav-item" onclick="nav('calls',this)"><span class="nav-icon">📞</span> Samtalslogg <span class="nav-badge" id="calls-badge" style="display:none">0</span></div>
    <div class="nav-item" onclick="nav('stats',this)"><span class="nav-icon">📊</span> Statistik</div>
    <div class="nav-section">Kampanjer</div>
    <div class="nav-item" onclick="nav('outbound',this)"><span class="nav-icon">📤</span> Ring ut</div>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="sidebar-dot" id="server-dot" style="width:8px;height:8px;border-radius:50%;background:var(--muted);flex-shrink:0"></div>
        <div class="sidebar-user-info"><div class="sidebar-user-name" id="sidebar-domain">Laddar...</div><div class="sidebar-user-role">Admin</div></div>
      </div>
      <button class="logout-btn" onclick="logout()">Logga ut</button>
    </div>
  </div>

  <div id="main">

    <!-- ═══ OVERVIEW ════════════════════════════════════════════════════════ -->
    <div class="page active" id="page-overview">
      <div class="page-header">
        <div class="page-title"><h2>Live Översikt</h2><p>Realtidsstatus — uppdateras var 5:e sekund</p></div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="loadOverview()">↻ Uppdatera</button>
        </div>
      </div>

      <div class="quick-actions">
        <button class="qa-btn" onclick="nav('prompt',document.querySelector('[onclick*=prompt]'))"><span class="qa-icon">✍️</span> Redigera prompt</button>
        <button class="qa-btn" onclick="nav('outbound',document.querySelector('[onclick*=outbound]'))"><span class="qa-icon">📤</span> Ring ut</button>
        <button class="qa-btn" onclick="copyWebhookUrl()"><span class="qa-icon">🔗</span> Kopiera webhook URL</button>
        <button class="qa-btn" onclick="nav('calls',document.querySelector('[onclick*=calls])'))"><span class="qa-icon">📋</span> Visa samtal</button>
      </div>

      <div class="grid4" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Status</span><span class="stat-icon">🟢</span></div><div class="stat-value green" id="ov-status"><span class="spinner"></span></div><div class="stat-sub" id="ov-env">—</div></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Uptime</span><span class="stat-icon">⏱️</span></div><div class="stat-value accent" id="ov-uptime">—</div><div class="stat-sub" id="ov-version">—</div></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Aktiva samtal</span><span class="stat-icon">📞</span></div><div class="stat-value" id="ov-sessions">—</div><div class="stat-sub">just nu</div></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Minne</span><span class="stat-icon">💾</span></div><div class="stat-value blue" id="ov-mem">—</div><div class="stat-sub">MB heap</div></div>
      </div>

      <div class="grid2">
        <div class="card">
          <div class="card-title"><span class="card-title-icon">⚙️</span> Aktiv konfiguration</div>
          <div class="config-row"><span class="config-row-label">Röst</span><span class="config-row-value" id="ov-voice">—</span></div>
          <div class="config-row"><span class="config-row-label">STT</span><span class="config-row-value" id="ov-stt">—</span></div>
          <div class="config-row"><span class="config-row-label">LLM</span><span class="config-row-value" id="ov-llm">—</span></div>
          <div class="config-row"><span class="config-row-label">TTS Provider</span><span class="config-row-value" id="ov-tts">—</span></div>
          <div class="config-row"><span class="config-row-label">Språk</span><span class="config-row-value" id="ov-lang">—</span></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="card-title-icon">🤖</span> AI Hälsning</div>
          <div style="font-style:italic;color:var(--muted2);font-size:14px;line-height:1.6;padding:8px 0" id="ov-greeting">—</div>
          <div style="margin-top:16px" class="card-title"><span class="card-title-icon">📊</span> Features</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="ov-features">—</div>
          <div style="margin-top:16px;font-size:11px;color:var(--muted)" id="ov-ts"></div>
        </div>
      </div>
    </div>

    <!-- ═══ SETUP ════════════════════════════════════════════════════════════ -->
    <div class="page" id="page-setup">
      <div class="page-header">
        <div class="page-title"><h2>Konfiguration</h2><p>Viktiga URL:er, nycklar och inställningar</p></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔗</span> Endpoints</div>
        <div class="field"><label>Telnyx Webhook URL</label>
          <div class="copy-field"><input type="text" id="cfg-webhook" readonly><button class="btn btn-ghost btn-sm copy-btn" onclick="copyField('cfg-webhook')">📋 Kopiera</button></div>
          <div class="field-hint">Klistra in denna URL i Telnyx → Call Control App → Webhook URL</div>
        </div>
        <div class="field"><label>Dashboard URL</label>
          <div class="copy-field"><input type="text" id="cfg-dashboard" readonly><button class="btn btn-ghost btn-sm copy-btn" onclick="copyField('cfg-dashboard')">📋 Kopiera</button></div>
        </div>
        <div class="field"><label>Health Check URL</label>
          <div class="copy-field"><input type="text" id="cfg-health" readonly><button class="btn btn-ghost btn-sm copy-btn" onclick="copyField('cfg-health')">📋 Kopiera</button></div>
          <div class="field-hint">Använd denna för UptimeRobot för att hålla servern vaken</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🔑</span> Autentisering</div>
        <div class="field"><label>Admin Token (ditt inloggningslösenord)</label>
          <div class="copy-field"><input type="password" id="cfg-token" readonly><button class="btn btn-ghost btn-sm copy-btn" onclick="copyField('cfg-token')">📋 Kopiera</button><button class="btn btn-ghost btn-sm" onclick="toggleTokenVis()" id="token-vis-btn">👁 Visa</button></div>
          <div class="field-hint">Skicka som <kbd>Authorization: Bearer TOKEN</kbd> till alla /admin/* endpoints</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">📡</span> Telnyx</div>
        <div class="field"><label>Telefonnummer</label>
          <div class="copy-field"><input type="text" id="cfg-phone" readonly><button class="btn btn-ghost btn-sm copy-btn" onclick="copyField('cfg-phone')">📋 Kopiera</button></div>
        </div>
        <div class="field"><label>API Curl-exempel — testa hälsning</label>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;font-family:monospace;font-size:11px;color:var(--muted2);line-height:1.7;overflow-x:auto">
            <span style="color:var(--muted)">curl</span> -X POST https://YOUR-SERVER/admin/greeting \\<br>
            &nbsp;&nbsp;-H <span style="color:var(--green)">"Authorization: Bearer TOKEN"</span> \\<br>
            &nbsp;&nbsp;-H <span style="color:var(--green)">"Content-Type: application/json"</span> \\<br>
            &nbsp;&nbsp;-d <span style="color:var(--yellow)">'{"greeting":"Hej, välkommen!"}'</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ PROMPT ═══════════════════════════════════════════════════════════ -->
    <div class="page" id="page-prompt">
      <div class="page-header">
        <div class="page-title"><h2>System Prompt</h2><p>AI:ns personlighet och instruktioner — träder i kraft omedelbart</p></div>
        <div class="page-actions">
          <kbd>⌘S</kbd><span style="font-size:11px;color:var(--muted);margin-left:4px">för att spara</span>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-title"><span class="card-title-icon">📋</span> Snabbmallar</div>
        <div class="preset-grid" id="preset-grid"></div>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">✍️</span> Aktiv Prompt</div>
        <textarea class="prompt-area" id="prompt-text" placeholder="Du är Sofia, NovAIs receptionist. Du pratar svenska och hjälper kunder..." oninput="updateCharCounter()"></textarea>
        <div class="char-counter" id="prompt-chars">0 / 8000 tecken</div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="savePrompt(this)">💾 Spara prompt</button>
          <span class="save-msg" id="prompt-status"></span>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">👋</span> Hälsningsfras</div>
        <div class="field-hint" style="margin-bottom:12px">Det allra första AI:n säger när ett samtal besvaras.</div>
        <div class="field"><input type="text" id="greeting-text" placeholder="NovAI, det här är Sofia, hur kan jag hjälpa dig?"></div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="saveGreeting(this)">💾 Spara hälsning</button>
          <span class="save-msg" id="greeting-status"></span>
        </div>
      </div>
    </div>

    <!-- ═══ VOICE ══════════════════════════════════════════════════════════════ -->
    <div class="page" id="page-voice">
      <div class="page-header">
        <div class="page-title"><h2>Röst & Providers</h2><p>Byt AI-tjänster live utan omstart</p></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🎙️</span> TTS — Text till tal</div>
        <div class="grid2">
          <div class="field"><label>Provider</label>
            <select id="tts-provider" onchange="onTtsProviderChange()">
              <option value="edge">Edge TTS — Gratis (Microsoft Neural)</option>
              <option value="elevenlabs">ElevenLabs — ~$5/mån (mest mänsklig)</option>
              <option value="cartesia">Cartesia — ~$2/mån (60ms latens)</option>
            </select>
          </div>
          <div class="field"><label>Röst / Voice ID</label>
            <select id="tts-voice-select" onchange="syncVoiceInput()">
              <option value="sv-SE-SofieNeural">sv-SE-SofieNeural (kvinna)</option>
              <option value="sv-SE-MattiasNeural">sv-SE-MattiasNeural (man)</option>
              <option value="custom">— Ange manuellt —</option>
            </select>
            <input type="text" id="tts-voice" style="margin-top:8px" placeholder="sv-SE-SofieNeural eller ElevenLabs Voice ID">
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="saveVoice(this)">💾 Spara röst</button>
          <span class="save-msg" id="voice-status"></span>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🧠</span> STT — Tal till text &amp; LLM</div>
        <div class="grid2">
          <div class="field"><label>STT Provider</label>
            <select id="stt-provider">
              <option value="groq">Groq — Gratis (Whisper, ~80ms)</option>
              <option value="deepgram">Deepgram — ~$0.004/min (bättre svenska)</option>
            </select>
          </div>
          <div class="field"><label>LLM Provider</label>
            <select id="llm-provider">
              <option value="groq">Groq — Gratis (qwen/llama)</option>
              <option value="openai">OpenAI — Betald</option>
            </select>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="saveProviders(this)">💾 Spara providers</button>
          <span class="save-msg" id="providers-status"></span>
        </div>
      </div>
    </div>

    <!-- ═══ SETTINGS ══════════════════════════════════════════════════════════ -->
    <div class="page" id="page-settings">
      <div class="page-header">
        <div class="page-title"><h2>Samtalsinställningar</h2><p>Samtalsparametrar — träder i kraft på nästa samtal</p></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">📞</span> Samtalsparametrar</div>
        <div class="grid3">
          <div class="field"><label>VAD Tystnad (ms)</label><input type="number" id="s-vad" min="100" max="3000"><div class="field-hint">Hur länge kunden måste vara tyst — 200-400ms rekommenderas</div></div>
          <div class="field"><label>Max samtalstid (sek)</label><input type="number" id="s-maxdur" min="30" max="3600"><div class="field-hint">600 = 10 min</div></div>
          <div class="field"><label>Max tokens LLM-svar</label><input type="number" id="s-maxtok" min="50" max="2000"><div class="field-hint">150 = kort svar, snabb, låg latens</div></div>
        </div>
        <div class="grid2" style="margin-top:4px">
          <div class="field"><label>First message mode</label>
            <select id="s-firstmsg">
              <option value="assistant">assistant — AI hälsar direkt (rekommenderat)</option>
              <option value="user">user — AI väntar på kunden</option>
              <option value="model">model — LLM genererar hälsning</option>
            </select>
          </div>
          <div class="field"><label>Samtalsspråk</label>
            <select id="s-lang">
              <option value="sv">Svenska (sv)</option>
              <option value="en">Engelska (en)</option>
            </select>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="saveSettings(this)">💾 Spara</button>
          <span class="save-msg" id="settings-status"></span>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">⏱️</span> Idle Timeout — när kunden inte svarar</div>
        <div class="grid2">
          <div class="field"><label>Timeout 1 (ms) — skicka fråga</label><input type="number" id="s-idle1" placeholder="10000"></div>
          <div class="field"><label>Fråga vid timeout 1</label><input type="text" id="s-idle1msg" placeholder="Är du kvar?"></div>
        </div>
        <div class="grid2" style="margin-top:4px">
          <div class="field"><label>Timeout 2 (ms) — lägg på</label><input type="number" id="s-idle2" placeholder="8000"></div>
          <div class="field"><label>Meddelande vid timeout 2 (tom = tyst avslut)</label><input type="text" id="s-idle2msg" placeholder="Hej då, välkommen åter!"></div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="saveIdle(this)">💾 Spara timeouts</button>
          <span class="save-msg" id="idle-status"></span>
        </div>
      </div>
    </div>

    <!-- ═══ CALLS ════════════════════════════════════════════════════════════ -->
    <div class="page" id="page-calls">
      <div class="page-header">
        <div class="page-title"><h2>Samtalslogg</h2><p>Alla samtal med transkript och metadata</p></div>
      </div>
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <input type="text" id="calls-phone-filter" placeholder="🔍 Sök på nummer..." style="width:220px;max-width:100%">
          <button class="btn btn-ghost btn-sm" onclick="loadCalls()">↻ Ladda</button>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="exportCallsCsv()">⬇ Exportera CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tid</th><th>Från</th><th>Till</th><th>Riktning</th><th>Längd</th><th>Turer</th><th>Avslut</th><th></th></tr></thead>
          <tbody id="calls-body"><tr class="empty-row"><td colspan="8"><span class="empty-icon">📋</span>Klicka Ladda för att hämta samtal</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- ═══ STATS ════════════════════════════════════════════════════════════ -->
    <div class="page" id="page-stats">
      <div class="page-header">
        <div class="page-title"><h2>Statistik</h2><p>Samtal, kostnader och framgångsrate</p></div>
        <div class="page-actions">
          <select id="stats-days" onchange="loadStats()" class="btn btn-ghost btn-sm" style="padding:6px 12px">
            <option value="7">7 dagar</option><option value="30" selected>30 dagar</option><option value="90">90 dagar</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="loadStats()">↻</button>
        </div>
      </div>
      <div class="grid4" id="stats-totals" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Samtal</span></div><div class="stat-value accent" id="st-calls">—</div></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Total tid</span></div><div class="stat-value blue" id="st-time">—</div></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Kostnad</span></div><div class="stat-value green" id="st-cost">—</div></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Per samtal</span></div><div class="stat-value" id="st-avg">—</div></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-title"><span class="card-title-icon">📈</span> Samtal per dag</div>
        <div class="chart-wrap"><canvas id="calls-chart"></canvas></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Datum</th><th>Samtal</th><th>Total tid</th><th>Genomsnitt</th><th>Voicemail</th><th>Slutförda</th><th>Kostnad</th></tr></thead>
          <tbody id="stats-body"><tr class="empty-row"><td colspan="7"><span class="empty-icon">📊</span>Välj period och klicka ↻</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- ═══ OUTBOUND ══════════════════════════════════════════════════════════ -->
    <div class="page" id="page-outbound">
      <div class="page-header">
        <div class="page-title"><h2>Ring ut</h2><p>Starta utgående samtal eller batch-kampanj</p></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">📞</span> Enskilt samtal</div>
        <div class="grid2">
          <div class="field"><label>Telefonnummer (E.164)</label><input type="text" id="ob-to" placeholder="+46701234567"></div>
          <div class="field"><label>Öppningsmening (valfri)</label><input type="text" id="ob-msg" placeholder="Hej, jag heter Sofia från NovAI..."></div>
        </div>
        <div class="field"><label>Variabler (JSON, valfritt)</label><input type="text" id="ob-vars" placeholder='{"company":"Acme AB","name":"Anna"}'></div>
        <div class="btn-row">
          <button class="btn btn-success" onclick="makeCall(this)">📞 Ring nu</button>
          <span class="save-msg" id="ob-status"></span>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🚀</span> Batch-kampanj</div>
        <div class="field-hint" style="margin-bottom:12px">Klistra in nummer — ett per rad eller kommaseparerat.</div>
        <textarea id="batch-numbers" placeholder="+46701234567&#10;+46709876543&#10;+46731112233" style="min-height:140px"></textarea>
        <div class="grid2" style="margin-top:14px">
          <div class="field"><label>Max samtida samtal</label><input type="number" id="batch-concurrency" value="3" min="1" max="20"></div>
          <div class="field"><label>Fördröjning mellan samtal (ms)</label><input type="number" id="batch-delay" value="2000" min="500"></div>
        </div>
        <div class="btn-row">
          <button class="btn btn-success" onclick="startBatch(this)">🚀 Starta kampanj</button>
          <span class="save-msg" id="batch-status"></span>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- Transcript Modal -->
<div class="modal-overlay" id="modal">
  <div class="modal">
    <div class="modal-header">
      <div><h3 id="modal-title">Transkript</h3><div class="modal-meta" id="modal-meta"></div></div>
      <button class="modal-close" onclick="closeModal()">✕ Stäng</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>
</div>

<script>
const BASE = '';
let TOKEN = '';
let _callsChart = null;
let _overviewInterval = null;

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(title, msg = '', type = 'success') {
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = \`<span class="toast-icon">\${icons[type]||'✓'}</span><div class="toast-body"><div class="toast-title">\${esc(title)}</div>\${msg ? '<div class="toast-msg">' + esc(msg) + '</div>' : ''}</div><button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>\`;
  document.getElementById('toast-container').appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4000);
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function login() {
  const t = document.getElementById('token-input').value.trim();
  if (!t) return;
  const btn = document.querySelector('#login-screen button');
  const origText = btn.textContent;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Ansluter...';
  try {
    const res = await fetch(BASE + '/admin/config', { headers: { Authorization: 'Bearer ' + t } });
    if (res.status === 401 || res.status === 503) {
      document.getElementById('login-error').style.display = 'block';
      return;
    }
    TOKEN = t;
    localStorage.setItem('nova_token', t);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    initDashboard();
  } catch {
    document.getElementById('login-error').style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = origText;
  }
}

function logout() {
  localStorage.removeItem('nova_token');
  location.reload();
}

document.getElementById('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
window.addEventListener('load', () => {
  const t = localStorage.getItem('nova_token');
  if (t) { TOKEN = t; document.getElementById('token-input').value = t; login(); }
});

// ── API ────────────────────────────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  try {
    const res = await fetch(BASE + path, opts);
    if (res.status === 401) { logout(); return null; }
    return res.json().catch(() => null);
  } catch { return { _err: true }; }
}

async function withLoading(btn, fn) {
  const orig = btn.innerHTML; btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sparar...';
  try { await fn(); } finally { btn.disabled = false; btn.innerHTML = orig; }
}

function showMsg(id, msg, ok = true) {
  const el = document.getElementById(id);
  el.textContent = (ok ? '✓ ' : '✗ ') + msg;
  el.style.color = ok ? 'var(--green)' : 'var(--red)';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Navigation ─────────────────────────────────────────────────────────────
function nav(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
  if (id === 'calls') loadCalls();
  if (id === 'stats') loadStats();
  if (id === 'overview') startOverviewPolling();
  else stopOverviewPolling();
}

// ── Init ───────────────────────────────────────────────────────────────────
async function initDashboard() {
  const c = await api('/admin/config');
  if (!c || c._err) { toast('Kunde inte ladda config', 'Kontrollera att servern körs', 'error'); return; }

  // Fill overview
  const domain = window.location.host;
  document.getElementById('sidebar-domain').textContent = domain;
  document.getElementById('server-dot').style.background = 'var(--green)';

  // Fill setup page
  const proto = window.location.protocol;
  document.getElementById('cfg-webhook').value   = proto + '//' + domain + '/webhooks/telnyx';
  document.getElementById('cfg-dashboard').value = proto + '//' + domain + '/dashboard';
  document.getElementById('cfg-health').value    = proto + '//' + domain + '/health';
  document.getElementById('cfg-token').value     = TOKEN;
  document.getElementById('cfg-phone').value     = '+46851791777';

  fillForms(c);
  loadOverview();
  startOverviewPolling();
}

function fillForms(c) {
  document.getElementById('prompt-text').value   = c.systemPrompt === '(default — Sofia receptionist)' ? '' : c.systemPrompt;
  document.getElementById('greeting-text').value = c.greeting;
  updateCharCounter();

  document.getElementById('tts-provider').value  = c.providers.tts;
  document.getElementById('tts-voice').value     = c.voice;
  const sel = document.getElementById('tts-voice-select');
  sel.value = Array.from(sel.options).map(o => o.value).includes(c.voice) ? c.voice : 'custom';

  document.getElementById('stt-provider').value  = c.providers.stt;
  document.getElementById('llm-provider').value  = c.providers.llm;

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

// ── Overview ───────────────────────────────────────────────────────────────
function startOverviewPolling() {
  stopOverviewPolling();
  _overviewInterval = setInterval(loadOverview, 5000);
}
function stopOverviewPolling() {
  if (_overviewInterval) { clearInterval(_overviewInterval); _overviewInterval = null; }
}

async function loadOverview() {
  const [health, config] = await Promise.all([api('/health'), api('/admin/config')]);
  if (!health || health._err) {
    document.getElementById('ov-status').innerHTML = '<span style="color:var(--red)">OFFLINE</span>';
    document.getElementById('server-dot').style.background = 'var(--red)';
    return;
  }
  document.getElementById('server-dot').style.background = 'var(--green)';
  const up = health.uptime, m = Math.floor(up/60), s = up%60, h = Math.floor(m/60);
  document.getElementById('ov-status').innerHTML  = '<span class="stat-dot green"></span>' + health.status.toUpperCase();
  document.getElementById('ov-uptime').textContent = h > 0 ? h+'h '+(m%60)+'m' : m+'m '+s+'s';
  document.getElementById('ov-version').textContent = 'v' + health.version;
  document.getElementById('ov-sessions').textContent = health.activeSessions;
  document.getElementById('ov-mem').textContent   = health.memory.heapUsedMB + '/' + health.memory.heapTotalMB;
  document.getElementById('ov-env').textContent   = health.env || '';

  if (config && !config._err) {
    document.getElementById('ov-voice').textContent   = config.voice;
    document.getElementById('ov-stt').textContent     = config.providers.stt + ' · ' + config.models.stt;
    document.getElementById('ov-llm').textContent     = config.providers.llm + ' · ' + config.models.llm;
    document.getElementById('ov-tts').textContent     = config.providers.tts;
    document.getElementById('ov-lang').textContent    = config.settings.language;
    document.getElementById('ov-greeting').textContent = '"' + config.greeting + '"';
    const feats = [
      config.settings && ['sentiment', health.features.sentiment],
      ['recording', health.features.recording],
      ['mega', health.features.megaStorage],
    ].filter(Boolean);
    document.getElementById('ov-features').innerHTML = feats.map(([n,v]) =>
      \`<span class="badge \${v?'badge-green':'badge-gray'}">\${v?'✓':'○'} \${n}</span>\`
    ).join('');
  }
  document.getElementById('ov-ts').textContent = 'Uppdaterad ' + new Date().toLocaleTimeString('sv-SE');
}

// ── Prompt & templates ──────────────────────────────────────────────────────
const PRESETS = [
  { name:'Receptionist', icon:'👩‍💼', desc:'Allmän mottagning', text:'Du är Sofia, en professionell och vänlig receptionist hos {company}. Du svarar alltid på svenska. Hjälp kunden med deras ärende och boka möten vid behov. Håll svaren korta, max 2 meningar.' },
  { name:'Säljare', icon:'💼', desc:'Outbound säljsamtal', text:'Du är Sofia, säljare från NovAI. Ring upp potentiella kunder och presentera AI-telefonist-tjänsten kort. Fråga om de vill ha en demo. Acceptera nej snabbt och tacka för tiden.' },
  { name:'Support', icon:'🛠', desc:'Teknisk support', text:'Du är Mattias, teknisk support hos {company}. Hjälp kunder med problem. Fråga alltid om ärendenummer. Eskalera komplexa ärenden till mänsklig support via transferCall.' },
  { name:'Bokningsbot', icon:'📅', desc:'Bokar möten', text:'Du är Sofia och hanterar bokningar för {company}. Fråga om önskat datum och tid. Bekräfta alltid bokningen i slutet. Tala lugnt och tydligt.' },
];

(function initPresets() {
  const grid = document.getElementById('preset-grid');
  PRESETS.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'preset-card';
    el.innerHTML = \`<div class="preset-icon">\${p.icon}</div><div class="preset-name">\${p.name}</div><div class="preset-desc">\${p.desc}</div>\`;
    el.onclick = () => {
      document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('prompt-text').value = p.text;
      updateCharCounter();
    };
    grid.appendChild(el);
  });
})();

function updateCharCounter() {
  const len = document.getElementById('prompt-text').value.length;
  const el  = document.getElementById('prompt-chars');
  el.textContent = len.toLocaleString('sv-SE') + ' / 8 000 tecken';
  el.className = 'char-counter' + (len > 7500 ? ' over' : len > 6000 ? ' warn' : '');
}

async function savePrompt(btn) {
  const prompt = document.getElementById('prompt-text').value.trim();
  if (!prompt) { toast('Tom prompt', 'Skriv ett systemmeddelande först', 'error'); return; }
  await withLoading(btn, async () => {
    const r = await api('/admin/prompt', 'POST', { prompt });
    if (r?._err)  toast('Nätverksfel', 'Servern svarar inte', 'error');
    else if (r?.ok) { toast('Prompt sparad', prompt.slice(0,60)+'...'); showMsg('prompt-status','Sparad'); }
    else toast('Fel', r?.error || 'Okänt fel', 'error');
  });
}

async function saveGreeting(btn) {
  const greeting = document.getElementById('greeting-text').value.trim();
  if (!greeting) return;
  await withLoading(btn, async () => {
    const r = await api('/admin/greeting', 'POST', { greeting });
    if (r?._err)  toast('Nätverksfel', '', 'error');
    else if (r?.ok) { toast('Hälsning sparad', greeting); showMsg('greeting-status','Sparad'); }
    else toast('Fel', r?.error, 'error');
  });
}

// ── Voice ───────────────────────────────────────────────────────────────────
function onTtsProviderChange() {
  const p = document.getElementById('tts-provider').value;
  const sel = document.getElementById('tts-voice-select');
  if (p === 'edge') {
    sel.innerHTML = \`<option value="sv-SE-SofieNeural">sv-SE-SofieNeural (kvinna)</option><option value="sv-SE-MattiasNeural">sv-SE-MattiasNeural (man)</option><option value="custom">— Ange manuellt —</option>\`;
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
  const voice = document.getElementById('tts-voice').value.trim();
  const provider = document.getElementById('tts-provider').value;
  if (!voice) return;
  await withLoading(btn, async () => {
    const r = await api('/admin/voice', 'POST', { voice, provider });
    if (r?._err) toast('Nätverksfel','','error');
    else if (r?.ok) { toast('Röst bytt', voice + ' via ' + provider); showMsg('voice-status','Sparad'); }
    else toast('Fel', r?.error, 'error');
  });
}

async function saveProviders(btn) {
  const stt = document.getElementById('stt-provider').value;
  const llm = document.getElementById('llm-provider').value;
  await withLoading(btn, async () => {
    const r = await api('/admin/providers', 'POST', { stt, llm });
    if (r?._err) toast('Nätverksfel','','error');
    else if (r?.ok) { toast('Providers sparade', 'STT: ' + stt + ' · LLM: ' + llm); showMsg('providers-status','Sparad'); }
    else toast('Fel', r?.error, 'error');
  });
}

// ── Settings ────────────────────────────────────────────────────────────────
async function saveSettings(btn) {
  await withLoading(btn, async () => {
    const r = await api('/admin/settings', 'POST', {
      vadSilenceMs:    parseInt(document.getElementById('s-vad').value),
      maxCallDuration: parseInt(document.getElementById('s-maxdur').value),
      maxTokensLlm:    parseInt(document.getElementById('s-maxtok').value),
      firstMessageMode:document.getElementById('s-firstmsg').value,
      language:        document.getElementById('s-lang').value,
    });
    if (r?._err) toast('Nätverksfel','','error');
    else if (r?.ok) { toast('Inställningar sparade'); showMsg('settings-status','Sparad'); }
    else toast('Fel', r?.error, 'error');
  });
}

async function saveIdle(btn) {
  await withLoading(btn, async () => {
    const r = await api('/admin/settings', 'POST', {
      idleTimeout1Ms: parseInt(document.getElementById('s-idle1').value),
      idleTimeout2Ms: parseInt(document.getElementById('s-idle2').value),
      idleMessage1:   document.getElementById('s-idle1msg').value,
      idleMessage2:   document.getElementById('s-idle2msg').value,
    });
    if (r?._err) toast('Nätverksfel','','error');
    else if (r?.ok) { toast('Timeouts sparade'); showMsg('idle-status','Sparad'); }
    else toast('Fel', r?.error, 'error');
  });
}

// ── Calls ───────────────────────────────────────────────────────────────────
let _callsCache = [];

async function loadCalls() {
  const phone = document.getElementById('calls-phone-filter').value.trim();
  const qs = phone ? '?phone=' + encodeURIComponent(phone) + '&limit=50' : '?limit=50';
  const tbody = document.getElementById('calls-body');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="8"><span class="spinner" style="width:20px;height:20px"></span></td></tr>';
  const r = await api('/admin/calls' + qs);

  if (!r || r._err) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8"><span class="empty-icon">⚠️</span>Kunde inte hämta samtal — servern svarar inte</td></tr>';
    return;
  }
  _callsCache = r.calls || [];
  const badge = document.getElementById('calls-badge');
  if (_callsCache.length) { badge.textContent = _callsCache.length; badge.style.display = ''; }
  else badge.style.display = 'none';

  if (!_callsCache.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8"><span class="empty-icon">📭</span>Inga samtal ännu</td></tr>';
    return;
  }
  tbody.innerHTML = _callsCache.map(c => {
    const dt    = new Date(c.started_at);
    const dtStr = dt.toLocaleDateString('sv-SE') + ' ' + dt.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
    const dir   = c.direction === 'incoming'
      ? '<span class="badge badge-blue">↙ in</span>'
      : '<span class="badge badge-accent">↗ ut</span>';
    return \`<tr>
      <td style="white-space:nowrap">\${dtStr}</td>
      <td style="font-family:monospace;font-size:12px">\${esc(c.phone_from||'—')}</td>
      <td style="font-family:monospace;font-size:12px">\${esc(c.phone_to||'—')}</td>
      <td>\${dir}</td>
      <td>\${c.duration_sec!=null?fmtDur(c.duration_sec):'—'}</td>
      <td>\${c.turn_count??'—'}</td>
      <td>\${causeBadge(c.hangup_cause)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="openTranscript('\${esc(c.call_id)}')">📋 Visa</button></td>
    </tr>\`;
  }).join('');
}

async function openTranscript(callId) {
  const r = await api('/admin/calls/' + encodeURIComponent(callId));
  if (!r || r._err) { toast('Kunde inte hämta transkript','','error'); return; }
  const transcript = r.transcript || r.messages || [];
  let html = '';
  if (r.summary) html += \`<div class="msg-summary"><strong>Sammanfattning</strong>\${esc(r.summary)}</div>\`;
  if (!transcript.length) html += '<p style="color:var(--muted);padding:16px 0">Inget transkript sparat</p>';
  transcript.forEach(m => {
    const isUser = m.role === 'user';
    html += \`<div class="msg \${isUser?'user':'assistant'}"><div class="msg-role">\${isUser?'👤 Kund':'🤖 Sofia'}</div>\${esc(m.content)}</div>\`;
  });
  const dt = r.started_at ? new Date(r.started_at).toLocaleString('sv-SE') : '';
  document.getElementById('modal-title').textContent = 'Transkript — ' + (r.phone_from || callId.slice(-8));
  document.getElementById('modal-meta').textContent  = dt + (r.duration_sec ? ' · ' + fmtDur(r.duration_sec) : '') + (r.turn_count ? ' · ' + r.turn_count + ' turer' : '');
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.add('open');
}

function exportCallsCsv() {
  if (!_callsCache.length) { toast('Inga samtal att exportera','','info'); return; }
  const header = 'datum,fran,till,riktning,langd_sek,turer,avslut';
  const rows = _callsCache.map(c => [
    c.started_at, c.phone_from||'', c.phone_to||'',
    c.direction||'', c.duration_sec||0, c.turn_count||0, c.hangup_cause||''
  ].map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','));
  const csv  = [header,...rows].join('\\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'novai-samtal-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
  toast('Exporterat', _callsCache.length + ' samtal');
}

// ── Stats ───────────────────────────────────────────────────────────────────
async function loadStats() {
  const days = document.getElementById('stats-days').value;
  const tbody = document.getElementById('stats-body');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><span class="spinner" style="width:20px;height:20px"></span></td></tr>';
  const r = await api('/admin/stats?days=' + days);
  if (!r || r._err) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7"><span class="empty-icon">⚠️</span>Servern svarar inte</td></tr>'; return; }

  const t = r.totals;
  document.getElementById('st-calls').textContent = t.calls.toLocaleString('sv-SE');
  document.getElementById('st-time').textContent  = fmtDur(t.total_seconds);
  document.getElementById('st-cost').textContent  = '$' + t.total_cost_usd.toFixed(3);
  document.getElementById('st-avg').textContent   = '$' + (t.avg_cost_per_call||0).toFixed(4);

  // Chart
  const labels = r.daily.map(d => d.date).reverse();
  const data   = r.daily.map(d => d.calls).reverse();
  const ctx    = document.getElementById('calls-chart').getContext('2d');
  if (_callsChart) _callsChart.destroy();
  _callsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Samtal',
        data,
        borderColor: '#7c6dfa',
        backgroundColor: 'rgba(124,109,250,.1)',
        borderWidth: 2,
        pointBackgroundColor: '#7c6dfa',
        pointRadius: 3,
        tension: .4,
        fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f0f1a', borderColor: '#22223a', borderWidth: 1, titleColor: '#eeeef5', bodyColor: '#9494b8', padding: 10 } },
      scales: {
        x: { grid: { color: '#22223a' }, ticks: { color: '#6b6b90', font: { size: 10 } } },
        y: { grid: { color: '#22223a' }, ticks: { color: '#6b6b90', font: { size: 10 }, stepSize: 1 }, beginAtZero: true }
      }
    }
  });

  if (!r.daily.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7"><span class="empty-icon">📭</span>Inga samtal under perioden</td></tr>'; return; }
  tbody.innerHTML = r.daily.map(d => \`<tr>
    <td>\${d.date}</td>
    <td><strong>\${d.calls}</strong></td>
    <td>\${fmtDur(d.total_seconds)}</td>
    <td>\${d.avg_duration_sec ? d.avg_duration_sec + 's' : '—'}</td>
    <td>\${d.voicemail_count||0}</td>
    <td>\${d.completed_count||0}</td>
    <td style="font-family:monospace">$\${parseFloat(d.total_cost_usd||0).toFixed(4)}</td>
  </tr>\`).join('');
}

// ── Outbound ────────────────────────────────────────────────────────────────
async function makeCall(btn) {
  const to = document.getElementById('ob-to').value.trim();
  if (!to) { toast('Ange telefonnummer','','error'); return; }
  const msg = document.getElementById('ob-msg').value.trim();
  let vars = {};
  const varsRaw = document.getElementById('ob-vars').value.trim();
  if (varsRaw) { try { vars = JSON.parse(varsRaw); } catch { toast('Ogiltig JSON i variabler','','error'); return; } }
  const body = { to };
  if (msg) body.firstMessage = msg;
  if (Object.keys(vars).length) body.variables = vars;
  await withLoading(btn, async () => {
    const r = await api('/admin/calls/outbound', 'POST', body);
    if (r?._err) toast('Nätverksfel','','error');
    else if (r?.ok) {
      toast('Samtal startat', 'Ringer ' + to);
      ['ob-to','ob-msg','ob-vars'].forEach(id => document.getElementById(id).value = '');
    } else toast('Fel', r?.error||'Okänt', 'error');
  });
}

async function startBatch(btn) {
  const raw = document.getElementById('batch-numbers').value.trim();
  if (!raw) return;
  const numbers = raw.split(/[,\\n]+/).map(s => s.trim()).filter(Boolean).map(to => ({ to }));
  if (!numbers.length) return;
  if (!confirm(\`Starta kampanj och ring \${numbers.length} nummer?\\n\\nDetta startar riktiga telefonsamtal.\`)) return;
  const concurrency = parseInt(document.getElementById('batch-concurrency').value) || 3;
  const delayMs     = parseInt(document.getElementById('batch-delay').value) || 2000;
  await withLoading(btn, async () => {
    const r = await api('/admin/batch-calls', 'POST', { numbers, concurrency, delayMs });
    if (r?._err) toast('Nätverksfel','','error');
    else if (r?.ok) {
      toast('Kampanj startad', numbers.length + ' samtal med ' + concurrency + ' parallella');
      document.getElementById('batch-numbers').value = '';
    } else toast('Fel', r?.error, 'error');
  });
}

// ── Setup helpers ────────────────────────────────────────────────────────────
function copyField(id) {
  const el = document.getElementById(id);
  navigator.clipboard.writeText(el.value).then(() => toast('Kopierat!', el.value.slice(0,50)+(el.value.length>50?'...':''))).catch(() => {
    el.type = 'text'; el.select(); document.execCommand('copy'); el.type = id.includes('token') ? 'password' : 'text';
    toast('Kopierat!');
  });
}

function copyWebhookUrl() {
  const url = window.location.origin + '/webhooks/telnyx';
  navigator.clipboard.writeText(url).then(() => toast('Webhook URL kopierad', url));
}

function toggleTokenVis() {
  const inp = document.getElementById('cfg-token');
  const btn = document.getElementById('token-vis-btn');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈 Dölj'; }
  else { inp.type = 'password'; btn.textContent = '👁 Visa'; }
}

// ── Modal ────────────────────────────────────────────────────────────────────
function closeModal() { document.getElementById('modal').classList.remove('open'); }
document.getElementById('modal').addEventListener('click', e => { if (e.target === document.getElementById('modal')) closeModal(); });

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const btn = activePage.querySelector('.btn-primary');
    if (btn) btn.click();
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDur(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec/60), s = sec%60, h = Math.floor(m/60);
  return h > 0 ? h+'h '+(m%60)+'m' : m > 0 ? m+'m '+s+'s' : s+'s';
}

function causeBadge(cause) {
  const m = { normal_clearing:['gray','avslutat'], assistant_ended:['green','slutfört'], voicemail_detected:['yellow','voicemail'], max_duration:['blue','max tid'], idle_timeout:['red','timeout'], transferred:['accent','transfer'] };
  const [c,l] = m[cause] || ['gray', cause||'—'];
  return \`<span class="badge badge-\${c}">\${l}</span>\`;
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
<\/script>
</body>
</html>`;
