# NovAI Telefonist — Self-hosted Voice AI (utan Vapi)

AI-telefonist för svenska företag. Ersätter Vapi.ai (~$0.07-0.12/min) med ~$0.01-0.02/min. 5-8x billigare, fullständig kontroll.

## Stack

| Lager | Provider | Latens |
|-------|----------|--------|
| Telefoni | Telnyx | — |
| STT | Groq Whisper turbo | ~50-80ms |
| LLM | Groq qwen/qwen3.8-27b | ~200-300ms |
| TTS | Edge TTS / ElevenLabs / Cartesia | ~75-200ms |

**Total latens p50: ~375-500ms**

---

## Snabbstart

### 1. Installera

```bash
npm install
```

### 2. Konfigurera `.env`

```env
TELNYX_API_KEY=KEY019...
TELNYX_PUBLIC_KEY=base64-från-telnyx-portal   # Webhooks → Public key
GROQ_API_KEY=gsk_...
SERVER_DOMAIN=din-server.railway.app
NOVA_ADMIN_TOKEN=generera-med: openssl rand -hex 32
AICHATT_DATABASE_URL=postgresql://...          # Neon DB
```

### 3. Starta

```bash
npm start       # produktion
npm run dev     # utveckling (auto-restart)
npm test        # kör alla tester (80 tester)
```

---

## Byt provider (utan restart)

```bash
# Via Admin API
curl -X POST https://din-server/admin/providers \
  -H "Authorization: Bearer TOKEN" \
  -d '{"tts": "elevenlabs", "stt": "deepgram"}'

# Via .env
TTS_PROVIDER=elevenlabs   # edge | elevenlabs | cartesia
STT_PROVIDER=groq         # groq | deepgram
```

| TTS | Latens | Pris |
|-----|--------|------|
| `edge` | ~75-200ms (throttlar gratis) | Gratis |
| `elevenlabs` | ~75ms stabilt | ~$3/1M tecken |
| `cartesia` | ~60ms stabilt | ~$0.05/1K tecken |

---

## Admin API

**Auth:** `Authorization: Bearer NOVA_ADMIN_TOKEN`

| Method | Path | Beskrivning |
|--------|------|-------------|
| `GET` | `/admin/config` | Nuvarande konfiguration |
| `POST` | `/admin/prompt` | Byt systemprompten live |
| `POST` | `/admin/greeting` | Byt hälsningsfras live |
| `POST` | `/admin/voice` | Byt röst / TTS-provider |
| `POST` | `/admin/providers` | Byt STT/LLM/TTS-provider |
| `POST` | `/admin/settings` | Byt samtalsbeteende (idle, firstMessage, VAD) |
| `GET` | `/admin/tools` | Lista konfigurerade verktyg |
| `POST` | `/admin/tools` | Uppdatera verktyg live |
| `GET` | `/admin/calls` | Senaste samtal (`?limit=20&phone=+46X`) |
| `GET` | `/admin/calls/:callId` | Fullständig rapport + analys |
| `POST` | `/admin/calls/:callId/transfer` | Vidarekoppla till människa |
| `POST` | `/admin/calls/outbound` | Ring upp (outbound call) |

---

## Outbound calling

```bash
curl -X POST /admin/calls/outbound \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "to": "+46701234567",
    "firstMessage": "Hej Anders, det är Sofia från NovAI...",
    "variables": { "name": "Anders", "company": "Qred" }
  }'
```

- `to` — E.164-nummer (obligatorisk)
- `firstMessage` — valfri öppningsrad (override `TTS_GREETING`)
- `variables` — injecteras i systemprompt: `{{name}}` → `"Anders"`

---

## Verktyg (Tools / Function Calling)

AI:n kan anropa externa HTTP-API:er under samtal. Fungerar med alla LLM:er.

### Konfigurera verktyg

```bash
# Via Admin API (live, utan restart)
curl -X POST /admin/tools \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "tools": [{
      "name": "checkCalendar",
      "description": "Kontrollera lediga tider i kalendern",
      "url": "https://din-api.com/calendar/check",
      "method": "POST",
      "parameters": {
        "type": "object",
        "properties": {
          "date": { "type": "string", "description": "Datum i YYYY-MM-DD format" }
        },
        "required": ["date"]
      }
    }]
  }'

# Via .env (startar med dessa)
NOVA_TOOLS=[{"name":"checkCalendar","description":"...","url":"...","parameters":{...}}]
```

### Inbyggda verktyg

| Verktyg | Beskrivning |
|---------|-------------|
| `endCall` | AI avslutar samtalet naturligt |
| `transferCall` | Kopplar vidare till människa (E.164) |

AI:n anropar verktyg automatiskt när det passar samtalet. Resultatet integreras i svaret.

---

## Post-call Analys

Körs automatiskt efter varje samtal. Sparas till DB + inkluderas i end-of-call webhook.

```env
# Strukturerad dataextraktion (JSON Schema)
NOVA_ANALYSIS_SCHEMA={"type":"object","properties":{"name":{"type":"string"},"intent":{"type":"string"},"email":{"type":"string"}}}

# Framgångsbedömning (rubrik → "success" | "failure" | "unknown")
NOVA_SUCCESS_RUBRIC=Kunden fick svar på sin fråga och var nöjd med hjälpen
```

Resultat i `GET /admin/calls/:callId`:
```json
{
  "summary": "Kunden ville boka ett möte. Sofia bokade tisdag 15 okt kl 10.",
  "structured_data": { "name": "Anders", "intent": "boka_mote" },
  "success_evaluation": "success"
}
```

---

## Samtalsbeteende

### First message mode

```env
FIRST_MESSAGE_MODE=assistant   # AI hälsar direkt (default)
FIRST_MESSAGE_MODE=user        # AI väntar på kunden  
FIRST_MESSAGE_MODE=model       # AI genererar hälsning med LLM
```

Via Admin API:
```bash
curl -X POST /admin/settings -d '{"firstMessageMode": "user"}'
```

### Idle timeout

Om kunden inte svarar efter att AI talat:

```env
IDLE_TIMEOUT_1_MS=10000    # 10s tystnad → fråga "Är du kvar?"
IDLE_TIMEOUT_2_MS=8000     # 8s till → lägg på
IDLE_MESSAGE_1=Är du kvar?
# IDLE_MESSAGE_2=            # tomt = lägg på direkt
```

### Variable injection

Personalisera systemprompt per samtal med `{{name}}`-mallar:

```
SYSTEM_PROMPT=Du ringer upp {{name}} på {{company}} angående deras faktura från {{date}}.
```

Variabler skickas med vid outbound-calls via `variables`-objektet.

---

## End-of-call rapport

Sparas automatiskt till Neon DB + POST till `NOVA_REPORT_WEBHOOK_URL`.

```json
{
  "type": "end-of-call-report",
  "call": { "id": "...", "phoneFrom": "+46701234567", "durationSeconds": 127, "turnCount": 8, "direction": "incoming" },
  "transcript": "Kund: Hej...\nSofia: Absolut...",
  "messages": [{"role": "user", "content": "..."}],
  "analysis": {
    "summary": "...",
    "structuredData": {},
    "successEvaluation": "success"
  }
}
```

---

## Säkerhet

- Webhook-verifiering: Ed25519 via `TELNYX_PUBLIC_KEY`
- Admin API: `crypto.timingSafeEqual` + rate limit 60/min
- SQL: parametriserade queries
- Placeholder-token blockerar deploy i production

---

## Kända begränsningar

| Begränsning | Plan |
|-------------|------|
| Edge TTS throttlar vid hög last | Byt till ElevenLabs/Cartesia |
| TTS-queue global (serialiserad per samtal) | v2: per-session instanser |
| Config ej persistent efter restart | v2: DB-backed config |
| Verktyg stöder ej streaming tool_calls | v2: native Groq function_calls |

---

## Filstruktur

```
src/
  server.js              — HTTP + WebSocket, startup
  call-session.js        — samtalstillstånd, idle, DTMF, tools, variabel-injektion
  webhooks.js            — Telnyx events (inbound + outbound + DTMF)
  db.js                  — PostgreSQL pool + schema
  providers/tts/         — edge, elevenlabs, cartesia
  providers/stt/         — groq, deepgram
  providers/llm/         — groq
  features/
    call-report.js       — DB + webhook-rapport (inkl. analys)
    voicemail.js         — voicemail/IVR-detektion
    tools.js             — verktygsregister + HTTP-executor
    analysis.js          — post-call LLM-analys
    outbound.js          — utgående samtal via Telnyx REST
  routes/admin.js        — Admin REST API
test/
  voicemail.test.js      — 18 tester
  admin.test.js          — 31 tester (inkl. settings, tools, outbound)
  providers.test.js      — 12 tester
  tools.test.js          — 15 tester
  analysis.test.js       — 7 tester
```
