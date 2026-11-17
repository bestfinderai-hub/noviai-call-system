# AI-Telefonist Arkitektur — Utan VAPI

**Version:** 1.0  
**Datum:** 2026-09-28  
**Stack:** Telnyx + Groq Whisper + Groq LLM + Edge TTS SofieNeural

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    INKOMMANDE SAMTAL                            │
│                                                                  │
│  Kund ringer → +46851791777 (Telnyx)                           │
│       ↓                                                          │
│  Telnyx webhook → POST /webhooks/telnyx                         │
│       ↓                                                          │
│  Server svarar: answer() + stream_start()                       │
│       ↓                                                          │
│  Telnyx öppnar WebSocket ws://din-server/audio-stream           │
│       ↓                                                          │
│  ┌──────────────────────────────────────────────────┐          │
│  │         MEDIA-BRIDGE (det som saknas idag)        │          │
│  │                                                    │          │
│  │  PCM-ljud (in) → Groq Whisper → Text              │          │
│  │       ↓                                            │          │
│  │  Text → LLM (Groq llama-3.1-70b) → Svar           │          │
│  │       ↓                                            │          │
│  │  Svar → Edge TTS SofieNeural → MP3                 │          │
│  │       ↓                                            │          │
│  │  MP3 → PCM 8kHz → WebSocket (ut)                  │          │
│  └──────────────────────────────────────────────────┘          │
│       ↓                                                          │
│  Kunden hör AI-svaret                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Telnyx Audio Streaming API

### Starta streaming
```javascript
// När call.initiated webhook tas emot:
await telnyx.calls.answer(callControlId);
await telnyx.calls.streamingStart(callControlId, {
  stream_url: 'wss://din-server.railway.app/audio-stream',
  stream_track: 'both_tracks',
  enable_dialogflow: false
});
```

### WebSocket format
```
Inkommande (från Telnyx):
{
  "event": "media",
  "media": {
    "track": "inbound",
    "chunk": "base64-encoded-PCM-8kHz-mulaw"
  }
}

Utgående (till Telnyx):
{
  "event": "media",
  "media": {
    "payload": "base64-encoded-PCM-8kHz-mulaw"
  }
}
```

**Telnyx skickar:** mulaw 8kHz (G.711 u-law)  
**Whisper kräver:** PCM 16kHz wav  
**Konvertering behövs:** mulaw 8kHz → PCM 16kHz (ffmpeg eller sox)

---

## Moduler

### 1. WebSocket Audio Server (`src/audio-server.js`)
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  const callId = req.url.split('/').pop();
  const session = new CallSession(callId);
  
  ws.on('message', async (data) => {
    const msg = JSON.parse(data);
    if (msg.event === 'media' && msg.media.track === 'inbound') {
      await session.processAudio(msg.media.payload);
    }
  });
  
  session.on('response', (audioBase64) => {
    ws.send(JSON.stringify({
      event: 'media',
      media: { payload: audioBase64 }
    }));
  });
});
```

### 2. CallSession (`src/call-session.js`)
```javascript
class CallSession extends EventEmitter {
  constructor(callId) {
    this.callId = callId;
    this.audioBuffer = [];
    this.silenceTimer = null;
    this.conversationHistory = [];
    this.vad = new VADMonitor(); // Från Peter Bot
  }
  
  async processAudio(base64Payload) {
    // 1. Lägg till i buffer
    this.audioBuffer.push(base64Payload);
    
    // 2. Tystnad-detektion (VAD)
    if (this.vad.detectSilence(base64Payload)) {
      await this.processTurn();
    }
  }
  
  async processTurn() {
    // 3. Konvertera: mulaw 8kHz → PCM 16kHz wav
    const wavBuffer = convertMulawToPCM(this.audioBuffer);
    this.audioBuffer = [];
    
    // 4. STT: Groq Whisper
    const transcript = await groqSTT(wavBuffer);
    
    // 5. LLM: Groq
    const response = await groqLLM(transcript, this.conversationHistory);
    this.conversationHistory.push({user: transcript, ai: response});
    
    // 6. TTS: Edge TTS SofieNeural
    const mp3 = await edgeTTS(response);
    
    // 7. Konvertera: MP3 → mulaw 8kHz
    const mulawPayload = convertMP3ToMulaw(mp3);
    
    // 8. Skicka tillbaka
    this.emit('response', mulawPayload);
  }
}
```

### 3. Groq STT (`src/services/stt.js`)
```javascript
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function groqSTT(wavBuffer) {
  const transcription = await groq.audio.transcriptions.create({
    file: new File([wavBuffer], 'audio.wav', { type: 'audio/wav' }),
    model: 'whisper-large-v3',
    language: 'sv',
    response_format: 'json',
    temperature: 0
  });
  return transcription.text;
}
```

### 4. Groq LLM (`src/services/llm.js`)
```javascript
async function groqLLM(userText, history, systemPrompt) {
  const messages = [
    { role: 'system', content: systemPrompt || NOVIAI_SYSTEM_PROMPT },
    ...history.map(h => [
      { role: 'user', content: h.user },
      { role: 'assistant', content: h.ai }
    ]).flat(),
    { role: 'user', content: userText }
  ];
  
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 150, // Kort svar → lägre latens
    temperature: 0.7
  });
  
  return response.choices[0].message.content;
}
```

### 5. Edge TTS (`src/services/tts.js`)
```javascript
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

async function edgeTTS(text) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata('sv-SE-SofieNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  
  return new Promise((resolve, reject) => {
    const chunks = [];
    const readable = tts.toStream(text);
    readable.on('data', chunk => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}
```

### 6. Audio-konvertering (`src/services/audio-converter.js`)
```javascript
const ffmpeg = require('fluent-ffmpeg');

// mulaw 8kHz → PCM 16kHz wav (för Whisper)
function convertMulawToPCM(mulawChunks) {
  // Slå ihop chunks
  const combined = Buffer.concat(mulawChunks.map(b => Buffer.from(b, 'base64')));
  // ffmpeg konvertering
  return new Promise((resolve) => {
    const output = [];
    ffmpeg()
      .input(toStream(combined))
      .inputOptions(['-f mulaw', '-ar 8000', '-ac 1'])
      .outputOptions(['-f wav', '-ar 16000', '-ac 1'])
      .pipe()
      .on('data', chunk => output.push(chunk))
      .on('end', () => resolve(Buffer.concat(output)));
  });
}

// MP3 → mulaw 8kHz (för Telnyx)
function convertMP3ToMulaw(mp3Buffer) {
  return new Promise((resolve) => {
    const output = [];
    ffmpeg()
      .input(toStream(mp3Buffer))
      .inputOptions(['-f mp3'])
      .outputOptions(['-f mulaw', '-ar 8000', '-ac 1'])
      .pipe()
      .on('data', chunk => output.push(chunk))
      .on('end', () => resolve(Buffer.concat(output).toString('base64')));
  });
}
```

---

## Telnyx Webhook-server (`src/webhooks.js`)

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// Telnyx skickar events hit
app.post('/webhooks/telnyx', async (req, res) => {
  const { event_type, payload } = req.body.data;
  const callControlId = payload.call_control_id;
  
  switch (event_type) {
    case 'call.initiated':
      // Svara på samtalet
      await answerCall(callControlId);
      // Starta audio streaming
      await startStreaming(callControlId);
      break;
      
    case 'call.answered':
      // Spela välkomstmeddelande
      await playWelcome(callControlId);
      break;
      
    case 'call.hangup':
      // Spara samtal, skicka till analytics
      await endSession(callControlId);
      break;
  }
  
  res.json({ status: 'ok' });
});

async function answerCall(callControlId) {
  await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
}

async function startStreaming(callControlId) {
  await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/streaming_start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      stream_url: `wss://${process.env.SERVER_DOMAIN}/audio-stream/${callControlId}`,
      stream_track: 'inbound_track'
    })
  });
}
```

---

## Deployment

```
Railway (rekommenderas) eller Render
- 512 MB RAM (tillräckligt för Whisper + ffmpeg)
- Node.js 20
- Alltid påslagen (behövs för inkommande samtal)
- ~$5–10/månad
```

### Miljövariabler (se `.env`)

---

## Latens-optimering

| Steg | Mål | Teknik |
|---|---|---|
| STT (Whisper) | <1s | Chunked processing, inte vänta på tystnad |
| LLM | <500ms | max_tokens=150, streaming |
| TTS | <300ms | Edge TTS är snabb |
| Audio-konv | <100ms | Buffer i minnet, ingen disk |
| **Totalt** | **<2s** | |

**VAD-tuning:** 300ms tystnad = kunden klar att prata (från Peter Bot VADMonitor)

---

## System-prompt för NovAI AI-Telefonist

```
Du är NovAI AI-Telefonist — en vänlig, professionell telefonist för svenska småföretag.

REGLER:
- Prata naturlig svenska, kort och tydligt (max 2-3 meningar per svar)
- Om kunden vill boka tid: fråga om datum och tid
- Om kunden ringer fel: be dem ringa [företagets nummer]
- Säg aldrig att du är en AI om kunden inte frågar direkt
- Använd naturliga pauser (...) och bekräftelser (mm, ja, okej)

STANDARD-HÄLSNING:
"NovAI, det här är Sofia, hur kan jag hjälpa dig?"
```

---

## Referensfiler

| Fil | Plats | Användning |
|---|---|---|
| VADMonitor | `C:\claude-pro\Vapi-assistant\voice-engine\vad-monitor.js` | Tystnad-detektion |
| Call analytics | `C:\claude-pro\Vapi-assistant\analytics\call-coach.js` | Post-call analys |
| Sentiment | `C:\claude-pro\Vapi-assistant\tools\sentiment-tracker.js` | Sentiment per samtal |
| Google Sheets | `C:\claude-pro\Vapi-assistant\tools\google-sheets.js` | CRM-loggning |
| Telnyx dialer | `C:\claude-pro\Twilio-koppling\Kod.js` | Utgående samtal |
| AiChatt STT | `C:\claude-pro\aichatt\app\api\stt\route.ts` | Groq Whisper referens |
| AiChatt TTS | `C:\claude-pro\aichatt\app\api\tts\route.ts` | Google TTS referens |
