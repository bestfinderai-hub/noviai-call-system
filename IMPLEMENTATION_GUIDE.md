# Implementeringsguide — Steg för Steg

**Tid:** 2–3 veckor  
**Stack:** Node.js + Telnyx + Groq + msedge-tts + ffmpeg

---

## Steg 1: Projektstruktur (Dag 1)

```bash
mkdir noviai-telefonist
cd noviai-telefonist
npm init -y
npm install telnyx groq-sdk msedge-tts fluent-ffmpeg ws express dotenv
```

**Mappstruktur:**
```
noviai-telefonist/
├── src/
│   ├── server.js           ← Express + WebSocket server
│   ├── webhooks.js         ← Telnyx event-hantering
│   ├── call-session.js     ← Samtalslogik per session
│   └── services/
│       ├── stt.js          ← Groq Whisper
│       ├── llm.js          ← Groq LLM
│       ├── tts.js          ← Edge TTS
│       └── audio.js        ← PCM/mulaw-konvertering
├── .env
└── package.json
```

---

## Steg 2: Telnyx-konfiguration (Dag 1)

1. Logga in på Telnyx Dashboard → **Call Control**
2. Skapa ny **Call Control App**:
   - Name: "NovAI Telefonist"
   - Webhook URL: `https://din-server.railway.app/webhooks/telnyx`
3. Under **Phone Numbers** → +46851791777:
   - Connection: välj din nya Call Control App
4. Spara `app_id` i `.env`

---

## Steg 3: Bygg WebSocket Audio Server (Dag 2–4)

Se kod i `ARCHITECTURE.md` → Modul 1 (WebSocket Audio Server) + Modul 2 (CallSession).

**Test-kommando:**
```bash
node src/server.js
# Bör visa: "Server startar på port 3000"
# WebSocket på: ws://localhost:3000/audio-stream/test
```

---

## Steg 4: Groq STT-integration (Dag 5–6)

Kopiera från `C:\claude-pro\aichatt\app\api\stt\route.ts` — logiken är identisk men i Node.js.

**Test:**
```javascript
const fs = require('fs');
const wav = fs.readFileSync('test-audio.wav');
const text = await groqSTT(wav);
console.log('Transcript:', text); // Ska ge svensk text
```

---

## Steg 5: LLM + TTS (Dag 7–8)

**Edge TTS test:**
```javascript
const mp3 = await edgeTTS('Hej, det här är NovAI, hur kan jag hjälpa dig?');
require('fs').writeFileSync('test-output.mp3', mp3);
// Lyssna på test-output.mp3
```

---

## Steg 6: Audio-konvertering (Dag 9–10)

ffmpeg måste vara installerat:
```bash
# Windows
winget install ffmpeg
# Verifiera
ffmpeg -version
```

**Test hela pipeline:**
```javascript
// Simulera ett Telnyx mulaw-chunk
const testMulaw = readTestMulawFile();
const wav = await convertMulawToPCM([testMulaw]);
const text = await groqSTT(wav);
const response = await groqLLM(text, []);
const mp3 = await edgeTTS(response);
const mulawOut = await convertMP3ToMulaw(mp3);
console.log('Pipeline OK, output:', mulawOut.length, 'bytes');
```

---

## Steg 7: End-to-End test (Dag 11–12)

1. Starta server lokalt: `node src/server.js`
2. Använd **ngrok** för publik URL: `ngrok http 3000`
3. Sätt Telnyx webhook till ngrok-URL
4. Ring +46851791777 med din mobil
5. Kontrollera loggar

**Förväntade loggar:**
```
[webhook] call.initiated → callControlId: xxx
[webhook] Answering call...
[webhook] Starting audio stream...
[audio] PCM received: 320 bytes
[stt] Transcript: "Hej, jag vill boka en tid"
[llm] Response: "Hej! Självklart, vilket datum passar dig?"
[tts] MP3 generated: 24576 bytes
[audio] Sending mulaw to Telnyx...
```

---

## Steg 8: Deploy till Railway (Dag 13–14)

```bash
# Installera Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up

# Sätt miljövariabler
railway variables set TELNYX_API_KEY=...
railway variables set GROQ_API_KEY=...
# (osv för alla vars i .env)
```

**Uppdatera Telnyx webhook** till Railway-URL.

---

## Steg 9: Integrera Peter Bot-moduler (Vecka 3)

Kopiera in från `C:\claude-pro\Vapi-assistant`:

```javascript
// I call-session.js — lägg till efter processTurn():
const { analyzeCall } = require('../../Vapi-assistant/analytics/call-coach');
const { trackSentiment } = require('../../Vapi-assistant/tools/sentiment-tracker');
const { logToSheets } = require('../../Vapi-assistant/tools/google-sheets');

// Vid samtalets slut (call.hangup):
const analysis = await analyzeCall(this.conversationHistory);
await trackSentiment(analysis);
await logToSheets({
  callId: this.callId,
  duration: this.duration,
  sentiment: analysis.sentiment,
  transcript: this.conversationHistory
});
```

---

## Steg 10: Parallellkör med VAPI (Vecka 4)

Konfigurera routing:
- 50% av samtal → VAPI (befintlig)
- 50% av samtal → Eget system

Jämför:
- Latens (mät varje svar)
- Transkriptionsträffsäkerhet
- Kundnöjdhet (avsluta samtal tidigt = missnöje)

---

## Felsökning

### Problem: Hög latens (>3 sek)
- Kontrollera att Whisper-chunking fungerar (inte väntar på hela samtalet)
- Kolla att LLM max_tokens=150 (inte 4096)
- Prova Groq llama-3.1-8b istället för 70b (snabbare, lite sämre)

### Problem: Telnyx skickar inte ljud
- Kontrollera att `stream_url` är `wss://` (inte `ws://`)
- Verifiera att WebSocket-servern är publik (ngrok/Railway)
- Kontrollera Telnyx-loggarna i dashboard

### Problem: Edge TTS fungerar inte
- Edge TTS kräver internetanslutning (ansluter till Microsoft)
- Fallback: Google Cloud TTS (kräver API-nyckel, se `.env`)

### Problem: mulaw-konvertering misslyckas
- Verifiera att ffmpeg är installerat: `ffmpeg -version`
- Kolla att inputformat är korrekt: `-f mulaw -ar 8000`
