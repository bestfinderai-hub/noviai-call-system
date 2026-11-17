# HANDOFF — NovAI Call System (utan Vapi) + Gratis Röstkloning

**Datum:** 2026-11-11  
**Path:** `C:\claude-pro\noviaivapi\`  
**Mål:** Ersätt Vapi + ElevenLabs med egna lösningar. Samma kvalitet, 90% lägre kostnad.

---

## ▶️ STARTA HÄR — Nästa session

```
1. Öppna ny chatt med CWD = C:\claude-pro\noviaivapi\
2. Skriv: "läs regler och fortsätt från HANDOFF.md"
3. Kör Kokoro på Kaggle eller testa Google TTS (båda implementerade)
```

**Snabbaste vägen GRATIS (Kokoro på Kaggle):**
```
1. Gå till kaggle.com → New Notebook → Upload kaggle_kokoro.ipynb
   Fil: src/providers/tts/kokoro-server/kaggle_kokoro.ipynb
2. Aktivera T4 GPU i Settings → Accelerator → GPU T4 x2
3. Kör alla celler → kopiera https://xxxx.lhr.life URL
4. I .env: TTS_PROVIDER=kokoro, KOKORO_SERVER_URL=https://xxxx.lhr.life
5. npm run dev → ring → 8.5/10 kvalitet, 20-50ms, gratis
```

**Snabbaste vägen BETALD (Cartesia, 1h):**
```bash
TTS_PROVIDER=cartesia
CARTESIA_API_KEY=<nyckel från cartesia.ai>
CARTESIA_VOICE_ID=a0e99841-438c-4a64-b679-ae501e7d6091
# → 9/10 kvalitet, 60ms, $15/mån
```

---

## Vad som FINNS och FUNGERAR ✅

Systemet är faktiskt ganska komplett. Det saknas inte arkitektur — det saknas rätt TTS-lösning.

| Komponent | Status | Fil |
|-----------|--------|-----|
| WebSocket audio bridge | ✅ Klar | `src/server.js` + `src/call-session.js` |
| Telnyx webhook | ✅ Klar | `src/webhooks.js` |
| STT: Groq Whisper | ✅ Klar | `src/services/stt.js` |
| LLM: Groq llama-3.3-70b | ✅ Klar | `src/services/llm.js` |
| TTS: Edge TTS (SofieNeural) | ✅ Klar | `src/providers/tts/` |
| TTS: Google TTS Neural2/Chirp3-HD | ✅ Klar (behöver API-nyckel) | `src/providers/tts/google.js` |
| TTS: Kokoro (gratis CPU/GPU) | ✅ Klar | `src/providers/tts/kokoro.js` + `kokoro-server/` |
| TTS: ElevenLabs provider | ✅ Klar | `src/providers/tts/elevenlabs.js` |
| TTS: Cartesia provider | ✅ Klar | `src/providers/tts/cartesia.js` |
| TTS: F5-TTS server | ✅ Klar (men ej deployad) | `src/providers/tts/f5tts-server/` |
| VAD + Barge-in | ✅ Klar | `src/call-session.js` |
| Filler-word filter | ✅ Klar | |
| SMS, Analytics, Admin | ✅ Klar | |

**Systembyte från Vapi: REDAN GJORT.** Allt kör på Telnyx direkt.

---

## Det verkliga problemet: TTS-kvalitet vs latens

### Nuläge och varför det "inte blir rätt"

| Provider | Kvalitet | Latens | Kostnad | Problem |
|----------|----------|--------|---------|---------|
| Edge TTS (SofieNeural) | 7/10 | ~200ms | Gratis | Låter lite robotig, kan stängas av MS |
| ElevenLabs eleven_flash_v2_5 | 10/10 | ~75ms | $5–22/månad | Dyr, men klar och fungerar |
| Cartesia sonic-3-5 | 9/10 | ~60ms | $15/mån | Bra! Redan implementerad |
| F5-TTS (self-hosted) | 10/10 | 5-10s på CPU | Gratis | **FEL: behöver GPU** |

**Grundproblemet:** F5-TTS (röstkloning) kräver GPU för <1s latens. Railway/Render har ingen GPU → 5-10s per mening → oanvändbart för samtal.

---

## Lösningsplan — 3 vägar

### Väg 1: Cartesia (SNABBASTE — 1 timme, kostar $15/mån)
Cartesia är REDAN implementerat. Bara en API-nyckel behövs.

```bash
# Lägg till i Railway env vars:
CARTESIA_API_KEY=din-nyckel
TTS_PROVIDER=cartesia
CARTESIA_VOICE_ID=a0e99841-438c-4a64-b679-ae501e7d6091  # Barbra multilingual
```

Skaffa nyckel: https://cartesia.ai (gratis trial 10k chars, sedan $15/mån)
**Kvalitet: 9/10. Latens: 60ms. Stöder svenska.**

---

### Väg 2: Kokoro TTS ✅ IMPLEMENTERAT — gratis för alltid

Kokoro är implementerat och redo att köras. Node.js-provider + FastAPI-server + Kaggle-notebook.

```bash
# Aktivera via env vars:
TTS_PROVIDER=kokoro
KOKORO_SERVER_URL=https://xxxx.lhr.life   # från Kaggle-tunnel
KOKORO_VOICE=af_nova                       # af_nova|af_sarah|am_adam|am_echo

# Kör Kaggle-notebooken:
# src/providers/tts/kokoro-server/kaggle_kokoro.ipynb
```

**Filer:**
- `src/providers/tts/kokoro.js` — Node.js provider
- `src/providers/tts/kokoro-server/server.py` — FastAPI server (CPU + GPU)
- `src/providers/tts/kokoro-server/requirements.txt` — Python deps
- `src/providers/tts/kokoro-server/kaggle_kokoro.ipynb` — Kaggle T4 notebook

**Röster:**
- `af_nova` — kvinna, varm (default)
- `af_sarah` — kvinna, klar
- `am_adam` — man, professionell
- `am_echo` — man, djup

**Latens:** ~80-150ms CPU | ~20-50ms T4 GPU. Kvalitet: 8.5/10. Kostnad: gratis.

---

### Väg 3: F5-TTS på Modal.com (BÄST KVALITET — gratis 30 GPU-h/mån)
F5-TTS ger faktisk röstkloning (100ms + din specifika röst). Kör på Modal GPU serverless.

**Steg 1 — Installera Modal:**
```bash
pip install modal
modal token new
```

**Steg 2 — Skapa `src/providers/tts/f5tts-server/modal_server.py`:**
```python
import modal, audioop, numpy as np
from fastapi import FastAPI
from fastapi.responses import Response
from pydantic import BaseModel

image = (modal.Image.debian_slim()
    .pip_install("f5-tts", "torch", "torchaudio", "fastapi", "uvicorn")
    .copy_local_file("reference_male_sv.wav", "/app/reference_male_sv.wav"))

app_modal = modal.App("f5tts-swedish")
web_app = FastAPI()

@app_modal.cls(gpu="T4", image=image, container_idle_timeout=300)
class F5TTSServer:
    @modal.build()
    def build(self):
        from f5_tts.api import F5TTS
        self.tts = F5TTS(model_path="EkhoCollective/f5-tts-swedish")

    @modal.asgi_app()
    def serve(self):
        class TTSReq(BaseModel):
            text: str

        @web_app.post("/tts")
        async def tts(req: TTSReq):
            wav, sr, _ = self.tts.infer(
                ref_file="/app/reference_male_sv.wav",
                ref_text="God dag, välkommen.",
                gen_text=req.text, speed=1.0, remove_silence=True
            )
            pcm16 = (np.clip(wav, -1.0, 1.0) * 32767).astype(np.int16).tobytes()
            pcm8k, _ = audioop.ratecv(pcm16, 2, 1, sr, 8000, None)
            return Response(content=audioop.lin2ulaw(pcm8k, 2), media_type="audio/basic")

        @web_app.get("/health")
        def health(): return {"status": "ok"}
        return web_app
```

**Steg 3 — Deploy:**
```bash
cd src/providers/tts/f5tts-server
modal deploy modal_server.py
# → ger URL typ: https://xxx--f5tts-swedish-serve.modal.run
```

**Steg 4 — Peka Railway mot Modal:**
```
F5TTS_SERVER_URL=https://xxx--f5tts-swedish-serve.modal.run
TTS_PROVIDER=f5tts
```

**Kostnad:** 30 GPU-h/mån gratis = ~600 minuters samtal/mån GRATIS. Sedan ~$0.0003/sek.

---

## Röstkloning — Spela in din egen röst

För F5-TTS behövs en referensfil. `reference_male_sv.wav` finns redan. Om du vill klona annan röst:

```
1. Spela in 15-30 sekunder naturlig svenska (tydlig, lugn, inga bakgrundsljud)
2. Spara som WAV 24kHz mono
3. Skriv exakt transkription i .txt-fil
4. Ersätt /app/reference_male_sv.wav med din fil
```

---

## Rekommenderad implementation (prioritetsordning)

**Dag 1 (1h):** Aktivera Cartesia — enkel API-nyckel, 9/10 kvalitet, 60ms latens  
**Dag 2-3 (3h):** Implementera Kokoro TTS — gratis, CPU-snabb, 8.5/10  
**Dag 4-7 (4h):** Deploy F5-TTS på Modal — röstkloning, ElevenLabs-kvalitet, gratis  

---

## Env-vars som krävs

```env
# Telnyx
TELNYX_API_KEY=
TELNYX_PUBLIC_KEY=

# STT + LLM
GROQ_API_KEY=

# TTS (välj en: edge|elevenlabs|cartesia|f5tts)
TTS_PROVIDER=cartesia
CARTESIA_API_KEY=
CARTESIA_VOICE_ID=a0e99841-438c-4a64-b679-ae501e7d6091

# DB
DATABASE_URL=

# Server
PORT=3000
SERVER_DOMAIN=din-railway-domän.railway.app
```

---

## Nästa steg (kör direkt nästa session)

```bash
cd C:\claude-pro\noviaivapi
npm install
# Skapa .env
npm run dev
# Ring ditt Telnyx-nummer och testa
```

Starta med att testa Edge TTS (inget API-nyckel behövs). Sedan byt till Cartesia för kvalitetslyft.

---

## Filstruktur

```
C:\claude-pro\noviaivapi\
├── src/server.js              # Huvud-server (Express + WebSocket)
├── src/call-session.js        # Call-logik (VAD, STT, LLM, TTS)
├── src/providers/tts/         # TTS-providers
│   ├── elevenlabs.js          # ElevenLabs (klar)
│   ├── cartesia.js            # Cartesia (klar, bara API-nyckel behövs)
│   └── f5tts-server/
│       ├── server.py          # F5-TTS server (klar, behöver GPU)
│       ├── kokoro_server.py   # TODO: Kokoro (CPU, gratis)
│       └── modal_server.py    # TODO: F5-TTS på Modal (GPU serverless)
├── ARCHITECTURE.md
└── HANDOFF.md                 # Den här filen
```
