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
/* SMS thread chat */
.sms-thread{display:flex;flex-direction:column;gap:8px;padding:4px 0}
.sms-bubble-wrap{display:flex;flex-direction:column;max-width:78%}
.sms-bubble-wrap.out{align-self:flex-end;align-items:flex-end}
.sms-bubble-wrap.in{align-self:flex-start;align-items:flex-start}
.sms-bubble{padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.sms-bubble-wrap.out .sms-bubble{background:var(--accent);color:#fff;border-bottom-right-radius:4px}
.sms-bubble-wrap.in  .sms-bubble{background:var(--surface2);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px}
.sms-bubble-time{font-size:10px;color:var(--muted);margin-top:3px;padding:0 2px}
.sms-contact-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:16px}
.sms-contact-avatar{width:38px;height:38px;border-radius:50%;background:var(--accent-bg);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.sms-contact-name{font-weight:700;font-size:14px}
.sms-contact-phone{font-size:11px;color:var(--muted);font-family:monospace}
.sms-contact-co{font-size:11px;color:var(--muted2)}
/* phone number link in table */
.phone-link{color:var(--accent2);cursor:pointer;text-decoration:underline;text-underline-offset:2px;font-family:monospace}
.phone-link:hover{color:var(--accent)}
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
    <div class="nav-section">SMS</div>
    <div class="nav-item" onclick="nav('sms',this)"><span class="nav-icon">💬</span> Skicka SMS</div>

    <div class="nav-item" onclick="nav('smslog',this)"><span class="nav-icon">📋</span> SMS Logg <span class="nav-badge" id="sms-badge" style="display:none">0</span></div>
    <div class="nav-item" onclick="nav('smssetup',this)"><span class="nav-icon">📱</span> Android Setup</div>
    <div class="nav-section">Verktyg</div>
    <div class="nav-item" onclick="nav('live',this)"><span class="nav-icon">🔴</span> Live Monitor <span class="nav-badge green" id="live-badge" style="display:none">0</span></div>
    <div class="nav-item" onclick="nav('ttstest',this)"><span class="nav-icon">🎧</span> TTS Test</div>
    <div class="nav-item" onclick="nav('webhooklog',this)"><span class="nav-icon">📡</span> Webhook Log</div>
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
        <div class="card-title"><span class="card-title-icon">🎧</span> Testa rösten live</div>
        <div class="field"><textarea id="tts-preview-text" style="min-height:80px" placeholder="Skriv valfri text och tryck Spela — du hör exakt hur rösten låter">Hej, det här är Peter på Bestfinder. Hur kan jag hjälpa dig idag?</textarea></div>
        <div class="btn-row">
          <button class="btn btn-success" onclick="previewTts(this)">▶ Spela upp</button>
          <span id="tts-preview-status" style="font-size:12px;color:var(--muted)"></span>
        </div>
        <audio id="tts-audio" style="margin-top:12px;width:100%;display:none" controls></audio>
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
          <thead><tr><th>Tid</th><th>Från</th><th>Riktning</th><th>Längd</th><th>Turer</th><th>Avslut</th><th>Lead</th><th></th></tr></thead>
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

    <!-- ═══ LIVE MONITOR ═════════════════════════════════════════════════════════ -->
    <div class="page" id="page-live">
      <div class="page-header">
        <div class="page-title"><h2>Live Monitor</h2><p>Aktiva samtal och realtidstranskript</p></div>
        <div class="page-actions"><button class="btn btn-ghost btn-sm" onclick="clearLiveLog()">Rensa log</button></div>
      </div>
      <div class="grid2" style="margin-bottom:16px">
        <div class="card">
          <div class="card-title"><span class="card-title-icon">📞</span> Aktiva samtal <span id="active-count" style="color:var(--green);margin-left:8px">0</span></div>
          <div id="active-calls-list" style="min-height:60px;color:var(--muted);font-size:13px">Inga aktiva samtal</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="card-title-icon">📊</span> SSE-status</div>
          <div id="sse-status" style="font-size:13px;color:var(--muted)">Ansluter...</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">💬</span> Realtidstranskript</div>
        <div id="live-transcript" style="min-height:200px;max-height:400px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:4px 0">
          <div style="color:var(--muted);font-size:13px;text-align:center;padding:40px 0">Väntar på samtal...</div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title"><span class="card-title-icon">🔔</span> Händelseflöde</div>
        <div id="event-feed" style="min-height:120px;max-height:280px;overflow-y:auto;font-family:monospace;font-size:11px;line-height:1.8;color:var(--muted2)">
          <div>— väntar på händelser —</div>
        </div>
      </div>
    </div>

    <!-- ═══ TTS TEST ══════════════════════════════════════════════════════════════ -->
    <div class="page" id="page-ttstest">
      <div class="page-header">
        <div class="page-title"><h2>TTS Test</h2><p>Hör exakt hur rösten låter — testa olika fraser och röster</p></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🎙️</span> Testa röst</div>
        <div class="grid2">
          <div class="field"><label>Röst</label>
            <select id="tt-voice">
              <option value="">— Aktuell serverröst —</option>
              <option value="sv-SE-SofieNeural">sv-SE-SofieNeural (kvinna)</option>
              <option value="sv-SE-MattiasNeural">sv-SE-MattiasNeural (man)</option>
            </select>
          </div>
          <div class="field"><label>Snabbfraser</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px">
              <button class="btn btn-ghost btn-sm" onclick="setTtText('Hej, det här är Peter på Bestfinder. Hur kan jag hjälpa dig idag?')">Hälsning</button>
              <button class="btn btn-ghost btn-sm" onclick="setTtText('Okej, jag förstår det. Kan du berätta lite mer om er situation?')">Lyssna</button>
              <button class="btn btn-ghost btn-sm" onclick="setTtText('Absolut, det förstår jag. Tack så mycket för din tid, ha en fin dag!')">Avslut</button>
            </div>
          </div>
        </div>
        <div class="field"><label>Text att syntetisera</label>
          <textarea id="tt-text" style="min-height:100px">Hej, det här är Peter på Bestfinder. Vi hjälper företag hitta rätt finansieringslösning, och jag undrar om ni har sett er över alternativa möjligheter det senaste halvåret?</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-success" onclick="runTtsTest(this)">▶ Syntetisera och spela</button>
          <span id="tt-status" style="font-size:12px;color:var(--muted)"></span>
        </div>
        <audio id="tt-audio" style="margin-top:16px;width:100%;display:none" controls></audio>
      </div>
      <div class="card">
        <div class="card-title"><span class="card-title-icon">📋</span> Testhistorik</div>
        <div id="tt-history" style="min-height:60px;color:var(--muted);font-size:13px">Ingen historik ännu</div>
      </div>
    </div>

    <!-- ═══ WEBHOOK LOG ═══════════════════════════════════════════════════════════ -->
    <div class="page" id="page-webhooklog">
      <div class="page-header">
        <div class="page-title"><h2>Webhook Log</h2><p>Inkommande Telnyx-händelser — realtid</p></div>
        <div class="page-actions"><button class="btn btn-ghost btn-sm" onclick="loadWebhookLog()">↻ Ladda</button></div>
      </div>
      <div class="card">
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap" id="wh-filter-btns">
          <button class="btn btn-ghost btn-sm wh-filter active" data-type="" onclick="whFilter(this,'')">Alla</button>
          <button class="btn btn-ghost btn-sm wh-filter" data-type="call.initiated" onclick="whFilter(this,'call.initiated')">initiated</button>
          <button class="btn btn-ghost btn-sm wh-filter" data-type="call.answered" onclick="whFilter(this,'call.answered')">answered</button>
          <button class="btn btn-ghost btn-sm wh-filter" data-type="call.hangup" onclick="whFilter(this,'call.hangup')">hangup</button>
          <button class="btn btn-ghost btn-sm wh-filter" data-type="webhook" onclick="whFilter(this,'webhook')">övriga</button>
        </div>
        <div id="wh-list" style="font-family:monospace;font-size:12px;line-height:1.9;max-height:500px;overflow-y:auto;color:var(--muted2)">
          Laddar...
        </div>
      </div>
    </div>

    <!-- ═══ SMS SEND ════════════════════════════════════════════════════════ -->
    <div class="page" id="page-sms">
      <div class="page-header">
        <div class="page-title"><h2>Skicka SMS</h2><p>Android gateway (gratis) med Telnyx som fallback</p></div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="loadSmsDevice()">↻ Enhetsstatus</button>
        </div>
      </div>

      <div class="grid2">
        <div class="stat-card" id="sms-device-card">
          <div class="stat-header"><span class="stat-label">Android Gateway</span><span class="stat-icon">📱</span></div>
          <div class="stat-value" id="sms-device-status" style="font-size:18px">–</div>
          <div class="stat-sub" id="sms-device-info">Laddar...</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-label">Idag skickade</span><span class="stat-icon">📤</span></div>
          <div class="stat-value green" id="sms-today-count">–</div>
          <div class="stat-sub" id="sms-today-sub">Android / Telnyx</div>
        </div>
      </div>

      <!-- Mode toggle -->
      <div style="display:flex;gap:0;margin-top:20px;margin-bottom:0;border:1px solid var(--border2);border-radius:10px;overflow:hidden;width:fit-content">
        <button id="sms-tab-single" class="btn btn-primary" style="border-radius:0;border:none;padding:9px 20px;font-size:13px" onclick="setSmsMode('single')">✉️ Enskilt nummer</button>
        <button id="sms-tab-bulk"   class="btn btn-ghost"   style="border-radius:0;border:none;border-left:1px solid var(--border2);padding:9px 20px;font-size:13px" onclick="setSmsMode('bulk')">📋 Lista / CSV-upload</button>
      </div>

      <!-- ── Enskilt nummer ── -->
      <div id="sms-mode-single">
        <div class="card" style="margin-top:16px">
          <div class="card-title"><span class="card-title-icon">✉️</span> Nytt SMS</div>
          <div class="grid2">
            <div class="field">
              <label>Till (E.164 format)</label>
              <input type="text" id="sms-to" placeholder="+46701234567">
            </div>
            <div class="field">
              <label>Provider</label>
              <select id="sms-provider">
                <option value="auto">Auto (Android → Telnyx fallback)</option>
                <option value="android">Android Gateway (gratis)</option>
                <option value="telnyx">Telnyx (~0.04 kr/SMS)</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>Meddelande</label>
            <textarea id="sms-message" style="min-height:100px" placeholder="Skriv ditt SMS här..." oninput="updateSmsCounter()"></textarea>
            <div class="char-counter" id="sms-chars">0 / 160 tecken · 1 SMS</div>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" onclick="sendSms(this)">💬 Skicka SMS</button>
            <span class="save-msg" id="sms-send-status"></span>
          </div>
        </div>
      </div>

      <!-- ── Lista / CSV ── -->
      <div id="sms-mode-bulk" style="display:none">
        <div class="card" style="margin-top:16px">
          <div class="card-title"><span class="card-title-icon">📋</span> Mottagarlista</div>
          <div class="field-hint" style="margin-bottom:12px">
            Klistra in nummer (ett per rad eller kommaseparerat) <strong>eller</strong> ladda upp en CSV-fil med en kolumn som heter <code>phone</code>, <code>number</code> eller <code>nummer</code>.
          </div>
          <div class="btn-row" style="margin-bottom:12px;margin-top:0">
            <label class="btn btn-ghost btn-sm" style="cursor:pointer">
              📂 Ladda upp CSV
              <input type="file" id="bulk-csv-input" accept=".csv,.txt" style="display:none" onchange="parseBulkCsv(this)">
            </label>
            <button class="btn btn-ghost btn-sm" onclick="clearBulkList()">✕ Rensa lista</button>
            <span id="bulk-count-label" style="font-size:12px;color:var(--muted2);margin-left:4px"></span>
          </div>
          <textarea id="bulk-numbers" placeholder="+46701234567&#10;+46709876543&#10;+46731112233" style="min-height:160px;font-family:monospace;font-size:12px" oninput="updateBulkCount()"></textarea>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="card-title"><span class="card-title-icon">✉️</span> Meddelande &amp; inställningar</div>
          <div class="grid2">
            <div class="field">
              <label>Provider</label>
              <select id="bulk-provider">
                <option value="auto">Auto (Android → Telnyx fallback)</option>
                <option value="android">Android Gateway (gratis)</option>
                <option value="telnyx">Telnyx (~0.04 kr/SMS)</option>
              </select>
            </div>
            <div class="field">
              <label>Fördröjning mellan SMS (ms)</label>
              <input type="number" id="bulk-delay" value="500" min="0" max="10000">
              <div class="field-hint">500 ms rekommenderas för Android</div>
            </div>
          </div>
          <div class="field">
            <label>Meddelande</label>
            <textarea id="bulk-message" style="min-height:120px" placeholder="Skriv ditt SMS här..." oninput="updateBulkCounter()"></textarea>
            <div class="char-counter" id="bulk-chars">0 tecken · 1 SMS per mottagare</div>
          </div>
          <div id="bulk-preview" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;display:none">
            <strong style="color:var(--accent)">Förhandsgranskning</strong><br>
            <span id="bulk-preview-text" style="color:var(--muted2)"></span>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" onclick="startBulkSms(this)" id="bulk-send-btn">📢 Starta utskick</button>
            <span class="save-msg" id="bulk-status"></span>
          </div>
        </div>

        <div class="card" id="bulk-result-card" style="margin-top:16px;display:none">
          <div class="card-title"><span class="card-title-icon">📊</span> Resultat</div>
          <div class="grid3" id="bulk-result-stats"></div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;border-color:rgba(74,222,128,.2)">
        <div class="card-title"><span class="card-title-icon">🚫</span> Opt-out lista <span class="badge badge-gray" id="optout-count" style="margin-left:6px">–</span></div>
        <div class="field-hint" style="margin-bottom:12px">Nummer som svarat STOPP eller manuellt blockerats. SMS skickas aldrig till dessa.</div>
        <div id="optout-list" style="font-size:12px;color:var(--muted);margin-bottom:12px">Laddar...</div>
        <div class="input-with-btn">
          <input type="text" id="optout-add-phone" placeholder="+46701234567" style="font-size:12px">
          <button class="btn btn-danger btn-sm" onclick="addOptOut()">Blockera</button>
        </div>
      </div>
    </div>

    <!-- page-smsbulk redirect (nav() hanterar inte längre smsbulk) -->

    <!-- ═══ ANDROID SETUP ══════════════════════════════════════════════════════ -->
    <div class="page" id="page-smssetup">
      <div class="page-header">
        <div class="page-title"><h2>Android Setup</h2><p>Konfigurera gratis SMS-gateway via Android-telefon</p></div>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-title-icon">1️⃣</span> Installera appen</div>
        <p style="color:var(--muted2);font-size:13px;line-height:1.7;margin-bottom:12px">
          Ladda ner <strong>android-sms-gateway</strong> (capcom6) — öppen källkod, 6000+ GitHub-stjärnor.
        </p>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px;font-size:13px">
          <div style="margin-bottom:8px">📥 <strong>APK:</strong> <span style="color:var(--accent);font-family:monospace">github.com/capcom6/android-sms-gateway/releases</span></div>
          <div style="margin-bottom:8px">📖 <strong>Docs:</strong> <span style="font-family:monospace;color:var(--muted2)">docs.sms-gate.app</span></div>
          <div>✅ Kräver Android 6.0+, ett aktivt SIM-kort med SMS-behörighet</div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-title"><span class="card-title-icon">2️⃣</span> Starta Local Server i appen</div>
        <ol style="color:var(--muted2);font-size:13px;line-height:2;padding-left:18px">
          <li>Öppna appen på telefonen</li>
          <li>Tryck på <strong>Local Server</strong> → aktivera</li>
          <li>Notera IP-adressen och porten (t.ex. <code>192.168.1.100:8080</code>)</li>
          <li>Sätt ett lösenord under <strong>Security</strong></li>
          <li>Under <strong>Webhooks</strong> → lägg till din server-URL för inkommande SMS</li>
        </ol>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-title"><span class="card-title-icon">3️⃣</span> Lägg till i .env</div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;font-family:monospace;font-size:12px;color:var(--muted2);line-height:2">
          <span style="color:var(--muted)"># Lägg till dessa i din .env-fil</span><br>
          <span style="color:var(--green)">ANDROID_GATEWAY_URL</span>=http://192.168.1.100:8080<br>
          <span style="color:var(--green)">ANDROID_GATEWAY_USER</span>=user<br>
          <span style="color:var(--green)">ANDROID_GATEWAY_PASS</span>=ditt-lösenord<br>
          <span style="color:var(--green)">ANDROID_WEBHOOK_SECRET</span>=välj-en-hemlig-sträng<br>
          <span style="color:var(--green)">SMS_PROVIDER</span>=auto
        </div>
        <div class="field-hint" style="margin-top:10px">
          <strong>Utanför hemmanätverk?</strong> Skapa konto på <code>sms-gate.app</code> och använd <code>https://api.sms-gate.app</code> som URL istället.
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-title"><span class="card-title-icon">4️⃣</span> Testa anslutningen</div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="testAndroidConnection(this)">🔌 Testa nu</button>
          <span id="android-test-result" style="font-size:13px;margin-left:8px"></span>
        </div>
        <div id="android-test-detail" style="margin-top:12px;font-size:12px;color:var(--muted2);font-family:monospace;display:none"></div>
      </div>
    </div>

    <!-- ═══ SMS LOG ══════════════════════════════════════════════════════════ -->
    <div class="page" id="page-smslog">
      <div class="page-header">
        <div class="page-title"><h2>SMS Logg</h2><p>Skickade och mottagna SMS</p></div>
      </div>

      <div class="grid4" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Skickade totalt</span></div><div class="stat-value accent" id="sms-stat-out">–</div></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Mottagna totalt</span></div><div class="stat-value blue" id="sms-stat-in">–</div></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Via Android</span></div><div class="stat-value green" id="sms-stat-android">–</div></div>
        <div class="stat-card"><div class="stat-header"><span class="stat-label">Misslyckade</span></div><div class="stat-value" id="sms-stat-failed" style="color:var(--red)">–</div></div>
      </div>

      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <select id="smslog-dir" onchange="loadSmsLog()" style="width:160px">
            <option value="">Alla riktningar</option>
            <option value="out">Skickade</option>
            <option value="in">Mottagna</option>
          </select>
          <input type="text" id="smslog-phone" placeholder="🔍 Filtrera nummer..." style="width:200px">
          <button class="btn btn-ghost btn-sm" onclick="loadSmsLog()">↻ Ladda</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tid</th><th>Riktning</th><th>Nummer</th><th>Meddelande</th><th>Status</th><th>Provider</th></tr></thead>
          <tbody id="smslog-body"><tr class="loading-row"><td colspan="6">Klicka Ladda för att hämta SMS</td></tr></tbody>
        </table>
      </div>
    </div>

  </div><!-- /#main -->
</div><!-- /#app -->

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

<!-- SMS Thread Modal -->
<div class="modal-overlay" id="sms-thread-modal" onclick="if(event.target===this)closeSmsThread()">
  <div class="modal" style="max-width:560px">
    <div class="modal-header">
      <div><h3 id="sms-thread-title">Konversation</h3><div class="modal-meta" id="sms-thread-meta"></div></div>
      <button class="modal-close" onclick="closeSmsThread()">✕ Stäng</button>
    </div>
    <div class="modal-body">
      <div id="sms-thread-contact"></div>
      <div class="sms-thread" id="sms-thread-body">
        <div style="text-align:center;color:var(--muted);padding:32px"><span class="spinner"></span></div>
      </div>
      <div id="sms-thread-more" style="display:none;text-align:center;margin-top:12px">
        <button class="btn btn-ghost btn-sm" onclick="loadMoreThread()">↑ Ladda fler</button>
      </div>
    </div>
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
  if (id === 'live' || id === 'webhooklog') {
    startSse();
    if (id === 'webhooklog') loadWebhookLog();
  }
  if (id === 'sms')      { loadSmsDevice(); loadSmsStats(); loadOptOut(); }
  if (id === 'smslog')   { loadSmsStats(); loadSmsLog(); }
  if (id === 'smssetup') { loadSmsDevice(); }
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
  startSse();
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
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8"><span class="empty-icon">⚠️</span>Kunde inte hämta samtal</td></tr>';
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
    const dt = new Date(c.started_at);
    const dtStr = dt.toLocaleDateString('sv-SE') + ' ' + dt.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
    const dir = c.direction === 'incoming' ? '<span class="badge badge-blue">↙ in</span>' : '<span class="badge badge-accent">↗ ut</span>';
    const leadMenu = \`<select onchange="setLead('\${esc(c.call_id)}',this.value)" style="font-size:11px;padding:3px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text)">
      <option value="">—</option>
      <option value="interested" \${c.lead_status==='interested'?'selected':''}>⭐ Intresserad</option>
      <option value="not_interested" \${c.lead_status==='not_interested'?'selected':''}>✗ Ej intresserad</option>
      <option value="callback" \${c.lead_status==='callback'?'selected':''}>📅 Callback</option>
      <option value="qualified" \${c.lead_status==='qualified'?'selected':''}>✓ Kvalificerad</option>
    </select>\`;
    return \`<tr>
      <td style="white-space:nowrap;font-size:12px">\${dtStr}</td>
      <td style="font-family:monospace;font-size:12px">\${esc(c.phone_from||'—')}</td>
      <td>\${dir}</td>
      <td>\${c.duration_sec!=null?fmtDur(c.duration_sec):'—'}</td>
      <td>\${c.turn_count??'—'}</td>
      <td>\${causeBadge(c.hangup_cause)}</td>
      <td>\${leadMenu}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="openTranscript('\${esc(c.call_id)}')">📋</button></td>
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

// ── Calls: lead status + sentiment ─────────────────────────────────────────

function leadBadge(status) {
  const m = { interested:'green,⭐ Intresserad', not_interested:'red,✗ Ej intresserad', callback:'yellow,📅 Callback', qualified:'accent,✓ Kvalificerad' };
  const [c,l] = (m[status]||'').split(',');
  if (!c) return '<span style="color:var(--muted);font-size:11px">—</span>';
  return \`<span class="badge badge-\${c}">\${l}</span>\`;
}

async function setLead(callId, status) {
  const r = await api('/admin/calls/' + encodeURIComponent(callId) + '/lead', 'PATCH', { status });
  if (r?.ok) { toast('Lead uppdaterat', status); loadCalls(); }
  else toast('Fel', r?.error||'', 'error');
}


// ── SSE Live Monitor ────────────────────────────────────────────────────────

let _sse = null;
let _liveTranscripts = {}; // callId → [{role,text}]
let _activeCallsMap = {};

async function startSse() {
  if (_sse) return;
  // Fetch a short-lived SSE token — admin token never goes in URL/logs
  const tokenRes = await api('/admin/sse-token');
  if (!tokenRes?.token) {
    document.getElementById('sse-status').innerHTML = '<span style="color:var(--red)">● Token-fel</span>';
    return;
  }
  _sse = new EventSource(BASE + '/admin/events?t=' + encodeURIComponent(tokenRes.token));

  _sse.onopen = () => {
    document.getElementById('sse-status').innerHTML = '<span style="color:var(--green)">● Ansluten</span>';
  };

  _sse.onerror = () => {
    document.getElementById('sse-status').innerHTML = '<span style="color:var(--red)">● Frånkopplad — försöker igen...</span>';
    _sse = null; // allow reconnect on next nav
  };

  _sse.onmessage = (e) => {
    let evt; try { evt = JSON.parse(e.data); } catch { return; }
    appendEventFeed(evt);

    if (evt.type === 'call.started') {
      _activeCallsMap[evt.data.callId] = { ...evt.data, startTs: evt.ts };
      _liveTranscripts[evt.data.callId] = [];
      renderActiveCalls();
      const badge = document.getElementById('live-badge');
      badge.textContent = Object.keys(_activeCallsMap).length;
      badge.style.display = '';
    }
    if (evt.type === 'call.transcript') {
      const cid = evt.data.callId;
      if (!_liveTranscripts[cid]) _liveTranscripts[cid] = [];
      _liveTranscripts[cid].push({ role: evt.data.role, text: evt.data.text });
      renderLiveTranscript();
    }
    if (evt.type === 'call.ended') {
      delete _activeCallsMap[evt.data.callId];
      delete _liveTranscripts[evt.data.callId];
      renderActiveCalls();
      const cnt = Object.keys(_activeCallsMap).length;
      const badge = document.getElementById('live-badge');
      badge.textContent = cnt;
      if (!cnt) badge.style.display = 'none';
    }
    if (evt.type === 'sms_in') {
      const from = evt.data?.from || 'okänt nummer';
      const msg  = evt.data?.message || '';
      toast('📩 Inkommande SMS', \`\${from}: \${msg.slice(0, 60)}\${msg.length > 60 ? '…' : ''}\`, 'info');
      // bump badge
      const smsBadge = document.getElementById('sms-badge');
      smsBadge.textContent = (parseInt(smsBadge.textContent || '0') + 1).toString();
      smsBadge.style.display = '';
      // live-prepend row if SMS log is open
      const tbody = document.getElementById('smslog-body');
      if (tbody && document.getElementById('page-smslog')?.classList.contains('active')) {
        const ts = new Date(evt.data?.ts || Date.now()).toLocaleString('sv-SE', { hour12: false }).slice(0, 16);
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${ts}</td><td>← In</td><td><span class="phone-link" onclick="openSmsThread('\${esc(from)}')">\${esc(from)}</span></td><td>\${esc(msg.slice(0,60))}\${msg.length>60?'…':''}</td><td><span class="badge badge-green">received</span></td><td><span class="badge badge-green">Android</span></td>\`;
        if (tbody.querySelector('.empty-row, .loading-row')) tbody.innerHTML = '';
        tbody.prepend(tr);
      }
    }
  };
}

function appendEventFeed(evt) {
  const feed = document.getElementById('event-feed');
  if (!feed) return;
  const ts = new Date(evt.ts).toLocaleTimeString('sv-SE');
  const color = evt.type.startsWith('call.') ? 'var(--accent2)' : evt.type === 'sms_in' ? 'var(--green)' : 'var(--muted)';
  const line = document.createElement('div');
  const extra = evt.type === 'sms_in'
    ? \` <span style="color:var(--blue)">\${esc(evt.data?.from||'')}</span> <span style="color:var(--muted)">\${esc((evt.data?.message||'').slice(0,40))}</span>\`
    : \`\${evt.data?.callId ? ' <span style="color:var(--muted)">…'+esc(evt.data.callId.slice(-6))+'</span>' : ''}\${evt.data?.from?' <span style="color:var(--blue)">'+esc(evt.data.from)+'</span>':''}\`;
  line.innerHTML = \`<span style="color:var(--muted)">\${ts}</span> <span style="color:\${color}">\${esc(evt.type)}</span>\${extra}\`;
  if (feed.firstChild?.textContent === '— väntar på händelser —') feed.innerHTML = '';
  feed.appendChild(line);
  feed.scrollTop = feed.scrollHeight;
  // Keep max 100 lines
  while (feed.children.length > 100) feed.removeChild(feed.firstChild);
}

function renderActiveCalls() {
  const el = document.getElementById('active-calls-list');
  const cnt = document.getElementById('active-count');
  const calls = Object.values(_activeCallsMap);
  cnt.textContent = calls.length;
  if (!calls.length) { el.innerHTML = '<div style="color:var(--muted);padding:12px 0">Inga aktiva samtal</div>'; return; }
  el.innerHTML = calls.map(c => {
    const age = Math.round((Date.now() - c.startTs) / 1000);
    return \`<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--green);font-size:18px">●</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">\${esc(c.from||'okänt nummer')}</div>
        <div style="font-size:11px;color:var(--muted)">\${c.direction||'inkommande'} · \${fmtDur(age)}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="hangupCall('\${esc(c.callId)}')">Lägg på</button>
    </div>\`;
  }).join('');
}

function renderLiveTranscript() {
  const el = document.getElementById('live-transcript');
  if (!el) return;
  const allTurns = Object.values(_liveTranscripts).flat().slice(-30);
  if (!allTurns.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:40px 0">Väntar på samtal...</div>'; return; }
  el.innerHTML = allTurns.map(t => {
    const isUser = t.role === 'user';
    return \`<div class="msg \${isUser?'user':'assistant'}"><div class="msg-role">\${isUser?'👤 Kund':'🤖 AI'}</div>\${esc(t.text)}</div>\`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function hangupCall(callId) {
  if (!confirm('Lägg på samtalet?')) return;
  const r = await api('/admin/calls/' + encodeURIComponent(callId) + '/hangup', 'POST');
  if (r?.ok) toast('Samtal avslutat', '');
  else toast('Fel', r?.error||'', 'error');
}

function clearLiveLog() {
  document.getElementById('live-transcript').innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:40px 0">Väntar på samtal...</div>';
  document.getElementById('event-feed').innerHTML = '<div>— rensad —</div>';
}

// ── TTS Test ─────────────────────────────────────────────────────────────────

let _ttHistory = [];

function setTtText(text) {
  document.getElementById('tt-text').value = text;
  document.getElementById('tts-preview-text').value = text;
}

async function previewTts(btn) {
  const text = document.getElementById('tts-preview-text').value.trim();
  if (!text) return;
  await _doTtsTest(text, '', 'tts-audio', 'tts-preview-status', btn);
}

async function runTtsTest(btn) {
  const text  = document.getElementById('tt-text').value.trim();
  const voice = document.getElementById('tt-voice').value;
  if (!text) return;
  await _doTtsTest(text, voice, 'tt-audio', 'tt-status', btn);
}

async function _doTtsTest(text, voice, audioElId, statusElId, btn) {
  const statusEl = document.getElementById(statusElId);
  const origHtml = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Syntetiserar...';
  statusEl.textContent = '';

  const body = { text };
  if (voice) body.voice = voice;

  const r = await api('/admin/tts-test', 'POST', body);
  btn.disabled = false; btn.innerHTML = origHtml;

  if (!r || r._err || r.error) {
    statusEl.style.color = 'var(--red)';
    statusEl.textContent = '✗ ' + (r?.error || 'Nätverksfel');
    return;
  }

  const audioEl = document.getElementById(audioElId);
  audioEl.src = 'data:audio/mp3;base64,' + r.audio;
  audioEl.style.display = 'block';
  audioEl.play();

  statusEl.style.color = 'var(--green)';
  statusEl.textContent = '✓ ' + r.voice + ' · ' + r.bytes + ' B';

  // Add to history
  _ttHistory.unshift({ text: text.slice(0,60), voice: r.voice, ts: new Date().toLocaleTimeString('sv-SE') });
  if (_ttHistory.length > 10) _ttHistory.pop();
  const hEl = document.getElementById('tt-history');
  if (hEl) hEl.innerHTML = _ttHistory.map(h =>
    \`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--muted)">\${h.ts}</span> <span style="color:var(--accent2)">\${esc(h.voice)}</span> "\${esc(h.text)}\${h.text.length>=60?'...':''}"</div>\`
  ).join('');
}

// ── Webhook Log ───────────────────────────────────────────────────────────────

let _whData = [];
let _whFilterType = '';

async function loadWebhookLog() {
  const r = await api('/admin/webhook-log');
  if (!r || r._err) return;
  _whData = (r.events || []).reverse();
  renderWebhookLog();
}

function whFilter(btn, type) {
  _whFilterType = type;
  document.querySelectorAll('.wh-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWebhookLog();
}

function renderWebhookLog() {
  const el = document.getElementById('wh-list');
  if (!el) return;
  const filtered = _whFilterType
    ? _whData.filter(e => e.data?.event_type === _whFilterType)
    : _whData;

  if (!filtered.length) { el.innerHTML = '<div style="color:var(--muted);padding:20px 0">Inga händelser</div>'; return; }

  const typeColors = {
    'call.initiated': 'var(--green)', 'call.answered': 'var(--blue)',
    'call.hangup': 'var(--red)', 'call.streaming.started': 'var(--accent2)',
  };
  el.innerHTML = filtered.map(e => {
    const ts = new Date(e.ts).toLocaleTimeString('sv-SE');
    const evType = e.data?.event_type || e.type;
    const col = typeColors[evType] || 'var(--muted2)';
    const from = e.data?.from ? ' · ' + esc(e.data.from) : '';
    const cid = e.data?.callId ? ' <span style="color:var(--muted)">…' + esc(e.data.callId.slice(-6)) + '</span>' : '';
    return \`<div style="padding:2px 0"><span style="color:var(--muted)">\${ts}</span> <span style="color:\${col}">\${esc(evType)}</span>\${cid}\${from}</div>\`;
  }).join('');
}

// ── SMS ────────────────────────────────────────────────────────────────────────

function updateSmsCounter() {
  const msg = document.getElementById('sms-message').value;
  const len = msg.length;
  const hasNonGsm = msg.split('').some(c => { const cp = c.codePointAt(0); return cp > 127 && !'€£¥èéùìòÇØøÅåÆæßÉÄÖÑÜ§äöñüà'.includes(c); });
  const segSize  = hasNonGsm ? 70 : 160;
  const concatSz = hasNonGsm ? 67 : 153;
  const segments = len === 0 ? 1 : (len <= segSize ? 1 : Math.ceil(len / concatSz));
  const el = document.getElementById('sms-chars');
  el.textContent = \`\${len} tecken · \${segments} SMS\${hasNonGsm ? ' ⚠ Unicode (emoji/tecken) — max 70/segment' : ''}\`;
  el.className = 'char-counter' + (len > segSize ? ' warn' : '') + (len > 1600 ? ' over' : '');
}

async function sendSms(btn) {
  const to  = document.getElementById('sms-to').value.trim();
  const msg = document.getElementById('sms-message').value.trim();
  const prov = document.getElementById('sms-provider').value;
  if (!to || !msg) { toast('Fyll i nummer och meddelande', '', 'error'); return; }

  await withLoading(btn, async () => {
    const res = await api('/sms/send', 'POST', { to, message: msg, provider: prov });
    if (!res || res._err || !res.ok) {
      showMsg('sms-send-status', res?.error || 'Fel', false);
      toast('SMS misslyckades', res?.error || '', 'error');
    } else {
      showMsg('sms-send-status', \`Skickat via \${res.provider || prov}\`);
      toast('SMS skickat!', \`→ \${to}\`);
      document.getElementById('sms-message').value = '';
      updateSmsCounter();
      loadSmsStats();
    }
  });
}

async function loadSmsDevice() {
  const res = await api('/sms/device');
  const statusEl = document.getElementById('sms-device-status');
  const infoEl   = document.getElementById('sms-device-info');
  if (!res || res._err) {
    statusEl.innerHTML = '<span style="color:var(--red)">● Offline</span>';
    infoEl.textContent = 'Kan inte nå Android gateway';
    return;
  }
  const d = res.device;
  if (!d) {
    statusEl.innerHTML = '<span style="color:var(--yellow)">● Ej konfigurerad</span>';
    infoEl.textContent = 'Sätt ANDROID_GATEWAY_URL i .env';
    return;
  }
  if (d.online) {
    statusEl.innerHTML = '<span style="color:var(--green)">● Online</span>';
    const battery = d.battery != null ? \` · 🔋 \${d.battery}%\` : '';
    infoEl.textContent = (d.name || 'Android') + battery;
  } else {
    statusEl.innerHTML = '<span style="color:var(--red)">● Offline</span>';
    infoEl.textContent = d.status ? \`HTTP \${d.status}\` : 'Ej nåbar';
  }
}

async function loadSmsStats() {
  const res = await api('/sms/stats');
  if (!res?.ok) return;
  const s = res.stats;
  document.getElementById('sms-today-count').textContent = s.today_out || '0';
  document.getElementById('sms-today-sub').textContent   = \`Android: \${s.via_android||0} · Telnyx: \${s.via_telnyx||0}\`;
  document.getElementById('sms-stat-out').textContent     = s.total_out   || '0';
  document.getElementById('sms-stat-in').textContent      = s.total_in    || '0';
  document.getElementById('sms-stat-android').textContent = s.via_android || '0';
  document.getElementById('sms-stat-failed').textContent  = s.total_failed|| '0';

  const badge = document.getElementById('sms-badge');
  if (s.today_out > 0) { badge.textContent = s.today_out; badge.style.display = ''; }
}

async function loadSmsLog() {
  const dir   = document.getElementById('smslog-dir').value;
  const phone = document.getElementById('smslog-phone').value.trim();
  const tbody = document.getElementById('smslog-body');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="6"><span class="spinner"></span></td></tr>';

  let url = '/sms/logs?limit=50';
  if (dir)   url += \`&direction=\${encodeURIComponent(dir)}\`;
  if (phone) url += \`&phone=\${encodeURIComponent(phone)}\`;

  const res = await api(url);
  if (!res?.ok || !res.sms?.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6"><span class="empty-icon">💬</span>Inga SMS ännu</td></tr>';
    return;
  }

  const statusBadge = s => {
    if (s === 'sent' || s === 'delivered' || s === 'received') return \`<span class="badge badge-green">\${s}</span>\`;
    if (s === 'failed') return \`<span class="badge badge-red">\${s}</span>\`;
    return \`<span class="badge badge-gray">\${s}</span>\`;
  };

  tbody.innerHTML = res.sms.map(r => {
    const ts    = new Date(r.created_at).toLocaleString('sv-SE', { hour12: false }).slice(0, 16);
    const dir   = r.direction === 'in' ? '← In' : '→ Ut';
    const raw   = r.direction === 'in' ? (r.phone_from||'') : (r.phone_to||'');
    const num   = raw ? \`<span class="phone-link" onclick="openSmsThread('\${esc(raw)}')">\${esc(raw)}</span>\` : '?';
    const msg   = esc((r.message||'').slice(0, 60)) + (r.message?.length > 60 ? '…' : '');
    const prov  = r.provider === 'android' ? '<span class="badge badge-green">Android</span>' : r.provider === 'telnyx' ? '<span class="badge badge-blue">Telnyx</span>' : '<span class="badge badge-gray">–</span>';
    return \`<tr><td>\${ts}</td><td>\${dir}</td><td>\${num}</td><td>\${msg}</td><td>\${statusBadge(r.status)}</td><td>\${prov}</td></tr>\`;
  }).join('');
}

async function loadOptOut() {
  const res = await api('/sms/opted-out');
  const listEl  = document.getElementById('optout-list');
  const countEl = document.getElementById('optout-count');
  if (!res?.ok) { listEl.textContent = 'Kunde inte hämta opt-out lista'; return; }
  const blocked = res.blocked || [];
  countEl.textContent = blocked.length;
  if (!blocked.length) { listEl.textContent = 'Inga blockerade nummer.'; return; }
  listEl.innerHTML = blocked.map(b =>
    \`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:monospace;flex:1">\${esc(b.phone)}</span>
      <span style="color:var(--muted);font-size:11px">\${esc(b.reason)}</span>
      <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px" onclick="removeOptOut('\${esc(b.phone)}')">↩ Ta bort</button>
    </div>\`
  ).join('');
}

async function addOptOut() {
  const phone = document.getElementById('optout-add-phone').value.trim();
  if (!phone) return;
  const res = await api('/sms/opted-out', 'POST', { phone, reason: 'manual' });
  if (res?.ok) { document.getElementById('optout-add-phone').value = ''; toast('Nummer blockerat', phone); loadOptOut(); }
  else toast('Fel', res?.error || '', 'error');
}

async function removeOptOut(phone) {
  const res = await api('/sms/opted-out/' + encodeURIComponent(phone), 'DELETE');
  if (res?.ok) { toast('Opt-out borttagen', phone); loadOptOut(); }
  else toast('Fel', res?.error || '', 'error');
}

// ── SMS Thread ─────────────────────────────────────────────────────────────────

let _threadPhone   = '';
let _threadOffset  = 0;
const THREAD_LIMIT = 50;

async function openSmsThread(phone) {
  _threadPhone  = phone;
  _threadOffset = 0;
  document.getElementById('sms-thread-title').textContent = phone;
  document.getElementById('sms-thread-meta').textContent  = '';
  document.getElementById('sms-thread-contact').innerHTML = '';
  document.getElementById('sms-thread-body').innerHTML    = '<div style="text-align:center;color:var(--muted);padding:32px"><span class="spinner"></span></div>';
  document.getElementById('sms-thread-more').style.display = 'none';
  document.getElementById('sms-thread-modal').classList.add('open');

  // CRM lookup + messages in parallel
  const [crmRes, msgRes] = await Promise.all([
    api('/sms/crm?phone=' + encodeURIComponent(phone)),
    api(\`/sms/logs?phone=\${encodeURIComponent(phone)}&limit=\${THREAD_LIMIT}&offset=0\`),
  ]);

  if (crmRes?.ok && crmRes.contact) {
    const c = crmRes.contact;
    document.getElementById('sms-thread-title').textContent = c.name || phone;
    document.getElementById('sms-thread-meta').textContent  = phone;
    document.getElementById('sms-thread-contact').innerHTML = \`
      <div class="sms-contact-bar">
        <div class="sms-contact-avatar">👤</div>
        <div>
          <div class="sms-contact-name">\${esc(c.name || phone)}</div>
          \${c.company ? \`<div class="sms-contact-co">\${esc(c.company)}</div>\` : ''}
          <div class="sms-contact-phone">\${esc(phone)}</div>
        </div>
        \${c.email ? \`<div style="margin-left:auto;font-size:11px;color:var(--muted2)">\${esc(c.email)}</div>\` : ''}
      </div>\`;
  }

  _threadOffset = renderThreadMessages(msgRes?.sms || [], true);
  if ((msgRes?.sms || []).length === THREAD_LIMIT) {
    document.getElementById('sms-thread-more').style.display = '';
  }
}

async function loadMoreThread() {
  const res = await api(\`/sms/logs?phone=\${encodeURIComponent(_threadPhone)}&limit=\${THREAD_LIMIT}&offset=\${_threadOffset}\`);
  const msgs = res?.sms || [];
  _threadOffset += renderThreadMessages(msgs, false);
  if (msgs.length < THREAD_LIMIT) document.getElementById('sms-thread-more').style.display = 'none';
}

function renderThreadMessages(msgs, replace) {
  const body = document.getElementById('sms-thread-body');
  if (!msgs.length) {
    if (replace) body.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px">Inga meddelanden</div>';
    return 0;
  }
  // msgs comes newest-first; show oldest-first in thread
  const sorted = [...msgs].reverse();
  const html = sorted.map(r => {
    const isOut = r.direction === 'out';
    const ts    = new Date(r.created_at).toLocaleString('sv-SE', { hour12: false }).slice(0, 16);
    const prov  = r.provider ? \`<span style="font-size:9px;color:var(--muted)"> · \${esc(r.provider)}</span>\` : '';
    return \`<div class="sms-bubble-wrap \${isOut ? 'out' : 'in'}">
      <div class="sms-bubble">\${esc(r.message || '')}</div>
      <div class="sms-bubble-time">\${ts}\${prov}</div>
    </div>\`;
  }).join('');

  if (replace) {
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;
  } else {
    body.insertAdjacentHTML('afterbegin', html);
  }
  return msgs.length;
}

function closeSmsThread() {
  document.getElementById('sms-thread-modal').classList.remove('open');
}

// ── Bulk SMS ──────────────────────────────────────────────────────────────────

function setSmsMode(mode) {
  const isBulk = mode === 'bulk';
  document.getElementById('sms-mode-single').style.display = isBulk ? 'none' : '';
  document.getElementById('sms-mode-bulk').style.display   = isBulk ? '' : 'none';
  document.getElementById('sms-tab-single').className = 'btn btn-' + (isBulk ? 'ghost' : 'primary');
  document.getElementById('sms-tab-bulk').className   = 'btn btn-' + (isBulk ? 'primary' : 'ghost');
  document.getElementById('sms-tab-single').style.cssText = 'border-radius:0;border:none;padding:9px 20px;font-size:13px';
  document.getElementById('sms-tab-bulk').style.cssText   = 'border-radius:0;border:none;border-left:1px solid var(--border2);padding:9px 20px;font-size:13px';
  if (isBulk) updateBulkCount();
}

function parseBulkNumbers(raw) {
  return [...new Set(
    raw.split(/[\\n,;]+/)
      .map(s => s.trim().replace(/\\s/g, ''))
      .filter(s => /^\\+\\d{7,15}$/.test(s))
  )];
}

function updateBulkCount() {
  const nums = parseBulkNumbers(document.getElementById('bulk-numbers').value);
  const label = document.getElementById('bulk-count-label');
  label.textContent = nums.length ? \`\${nums.length} giltiga nummer\` : '';
  updateBulkPreview();
}

function updateBulkCounter() {
  const msg = document.getElementById('bulk-message').value;
  const len = msg.length;
  const hasNonGsm = msg.split('').some(c => { const cp = c.codePointAt(0); return cp > 127 && !'€£¥èéùìòÇØøÅåÆæßÉÄÖÑÜ§äöñüà'.includes(c); });
  const segSize = hasNonGsm ? 70 : 160;
  const concatSz = hasNonGsm ? 67 : 153;
  const segs = len === 0 ? 1 : (len <= segSize ? 1 : Math.ceil(len / concatSz));
  const el = document.getElementById('bulk-chars');
  el.textContent = \`\${len} tecken · \${segs} SMS per mottagare\${hasNonGsm ? ' ⚠ Unicode' : ''}\`;
  el.className = 'char-counter' + (len > segSize ? ' warn' : '') + (len > 1600 ? ' over' : '');
  updateBulkPreview();
}

function updateBulkPreview() {
  const nums = parseBulkNumbers(document.getElementById('bulk-numbers').value);
  const msg  = document.getElementById('bulk-message').value;
  const prev = document.getElementById('bulk-preview');
  const txt  = document.getElementById('bulk-preview-text');
  if (!nums.length || !msg.trim()) { prev.style.display = 'none'; return; }
  const len = msg.length;
  const segs = len <= 160 ? 1 : Math.ceil(len / 153);
  txt.textContent = \`\${nums.length} mottagare × \${segs} SMS = \${nums.length * segs} SMS totalt\`;
  prev.style.display = '';
}

function clearBulkList() {
  document.getElementById('bulk-numbers').value = '';
  document.getElementById('bulk-count-label').textContent = '';
  document.getElementById('bulk-preview').style.display = 'none';
}

function parseBulkCsv(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.split(/\\r?\\n/);
    let col = 0;
    const header = lines[0].split(/[,;\\t]/);
    const phoneCol = header.findIndex(h => /phone|number|tel|mobil|nummer/i.test(h.trim()));
    if (phoneCol >= 0) col = phoneCol;
    const numbers = lines.slice(phoneCol >= 0 ? 1 : 0)
      .map(l => l.split(/[,;\\t]/)[col]?.trim().replace(/['"/]/g,'') || '')
      .filter(Boolean);
    const existing = document.getElementById('bulk-numbers').value.trim();
    document.getElementById('bulk-numbers').value = (existing ? existing + '\\n' : '') + numbers.join('\\n');
    updateBulkCount();
    toast('CSV importerad', \`\${numbers.length} rader inlästa\`);
  };
  reader.readAsText(file);
  input.value = '';
}

async function startBulkSms(btn) {
  const raw     = document.getElementById('bulk-numbers').value;
  const message = document.getElementById('bulk-message').value.trim();
  const provider = document.getElementById('bulk-provider').value;
  const delayMs  = parseInt(document.getElementById('bulk-delay').value) || 500;
  const numbers  = parseBulkNumbers(raw);

  if (!numbers.length) { toast('Inga giltiga nummer', 'Klistra in E.164-nummer (+46...)', 'error'); return; }
  if (!message)        { toast('Skriv ett meddelande', '', 'error'); return; }
  if (!confirm(\`Skicka SMS till \${numbers.length} mottagare?\\n\\nMeddelande: \${message.slice(0,80)}\${message.length>80?'…':''}\`)) return;

  document.getElementById('bulk-result-card').style.display = 'none';

  await withLoading(btn, async () => {
    const res = await api('/sms/bulk', 'POST', { numbers, message, provider, delayMs });
    if (!res || res._err) { toast('Nätverksfel', '', 'error'); return; }
    if (!res.ok)          { toast('Fel', res.error, 'error'); return; }

    const inv = res.invalid?.length ? \` · \${res.invalid.length} ogiltiga\` : '';
    toast('Kampanj startad', \`\${res.total} SMS köas\${inv}\`);
    showMsg('bulk-status', \`\${res.total} SMS skickas...\`, true);

    const card = document.getElementById('bulk-result-card');
    document.getElementById('bulk-result-stats').innerHTML = \`
      <div class="stat-card"><div class="stat-header"><span class="stat-label">Totalt köade</span></div><div class="stat-value accent">\${res.total}</div></div>
      <div class="stat-card"><div class="stat-header"><span class="stat-label">Ogiltiga nummer</span></div><div class="stat-value" style="color:var(--yellow)">\${res.invalid?.length||0}</div></div>
      <div class="stat-card"><div class="stat-header"><span class="stat-label">Fördröjning</span></div><div class="stat-value" style="color:var(--muted2)">\${delayMs}ms</div></div>
    \`;
    card.style.display = '';
  });
}

// ── Android Connection Test ────────────────────────────────────────────────────

async function testAndroidConnection(btn) {
  const resultEl = document.getElementById('android-test-result');
  const detailEl = document.getElementById('android-test-detail');
  resultEl.textContent = '🔄 Testar...';
  resultEl.style.color = 'var(--muted2)';
  detailEl.style.display = 'none';
  btn.disabled = true;
  try {
    const res = await api('/sms/device');
    btn.disabled = false;
    if (!res || res._err) {
      resultEl.textContent = '✗ Nätverksfel';
      resultEl.style.color = 'var(--red)';
      return;
    }
    const d = res.device;
    if (!d) {
      resultEl.textContent = '✗ ANDROID_GATEWAY_URL inte satt i .env';
      resultEl.style.color = 'var(--red)';
      return;
    }
    if (!d.online) {
      resultEl.textContent = '✗ Telefon ej nåbar';
      resultEl.style.color = 'var(--red)';
      detailEl.textContent = d.status ? \`HTTP \${d.status}\` : 'Timeout eller nätverksfel';
      detailEl.style.display = '';
      return;
    }
    resultEl.textContent = '✓ Ansluten!';
    resultEl.style.color = 'var(--green)';
    const info = [
      d.model ? \`Modell: \${d.model}\` : '',
      d.battery != null ? \`Batteri: \${d.battery}%\` : '',
      d.android ? \`Android \${d.android}\` : '',
    ].filter(Boolean).join(' · ');
    if (info) { detailEl.textContent = info; detailEl.style.display = ''; }
  } catch {
    btn.disabled = false;
    resultEl.textContent = '✗ Fel vid anslutning';
    resultEl.style.color = 'var(--red)';
  }
}

<\/script>
</body>
</html>`;
