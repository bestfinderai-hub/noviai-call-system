"""
Kokoro TTS Inference Server — NovAI
POST /tts → mulaw 8kHz for Telnyx/NovAI

CPU: ~80-150ms/mening (Railway/Render)
GPU: ~15-40ms/mening  (Kaggle T4)

Env:
  KOKORO_VOICE = af_nova  (default: varm kvinna)
  KOKORO_LANG  = z        (default: multilingual — bäst för svenska)
  KOKORO_SPEED = 1.0
  PORT         = 8000

Röster:
  Kvinna:  af_nova (varm), af_sarah (klar), af_sky (mjuk), bf_emma (brittisk)
  Man:     am_adam (professionell), am_echo (djup), bm_george (brittisk)
  Svenska: testa KOKORO_LANG=a eller z — z ger bäst multilingual-resultat
"""

import os, re, logging, time, asyncio
from math import gcd
import numpy as np
import scipy.signal
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("kokoro")

app = FastAPI(title="Kokoro TTS", version="1.0.0")

VOICE = os.getenv("KOKORO_VOICE", "af_nova")
LANG  = os.getenv("KOKORO_LANG",  "z")
SPEED = float(os.getenv("KOKORO_SPEED", "1.0"))

_pipeline = None
_sem = asyncio.Semaphore(1)  # En syntes åt gången (GPU/CPU-säker)

# ─── ITU-T G.711 µ-law LUT (bit-identisk med audioop.lin2ulaw) ───────────────
_EXP_LUT = np.array([
    0,0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,
    4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
    5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
    5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
], dtype=np.int32)

_MULAW_CLIP    = 32635
_MULAW_BIAS_14 = 33


def _lin2ulaw(pcm16: np.ndarray) -> np.ndarray:
    """Vectorized ITU-T G.711 µ-law — bit-identisk med audioop.lin2ulaw(data, 2).
    audioop togs bort i Python 3.13 — detta numpy-impl matchar C-källan exakt."""
    s    = pcm16.astype(np.int32) >> 2
    mask = np.where(s >= 0, np.int32(0xFF), np.int32(0x7F))
    s_abs = np.abs(s)
    s_abs = np.minimum(s_abs, _MULAW_CLIP)
    s_abs = s_abs + _MULAW_BIAS_14
    exp   = _EXP_LUT[(s_abs >> 7) & 0xFF]
    mant  = (s_abs >> (exp + 3)) & 0x0F
    return (((exp << 4) | mant) ^ mask).astype(np.uint8)


def _wav_to_mulaw_8k(wav: np.ndarray, sr: int) -> bytes:
    """float32 PCM → ITU-T G.711 mulaw 8kHz (Telnyx PCMU format).

    Pipeline: polyphase resample → pre-emphasis → RMS-norm → lin2ulaw.
    Identisk med f5tts_server.py för konsistent ljudkvalitet."""
    if len(wav) == 0:
        raise ValueError("TTS returnerade tom audio")

    # Polyphase FIR resample med Kaiser anti-alias INNAN pre-emphasis
    if sr != 8000:
        g   = gcd(8000, sr)
        wav = scipy.signal.resample_poly(wav, 8000 // g, sr // g)

    # Pre-emphasis optimerat för 300-3400 Hz telefonband (ITU P.800)
    pre = 0.85
    wav = np.concatenate([[wav[0]], wav[1:] - pre * wav[:-1]])

    # RMS-normering till -18 dBFS (ITU-T P.56)
    rms = np.sqrt(np.mean(wav ** 2))
    if rms > 1e-6:
        gain = min(0.126 / rms, 10.0)
        wav  = wav * gain
    wav = np.clip(wav, -0.98, 0.98)

    pcm16 = (np.clip(wav, -1.0, 1.0) * 32767).astype(np.int16)
    return _lin2ulaw(pcm16).tobytes()


def _normalize_text(text: str) -> str:
    """Expandera förkortningar och siffror för naturlig prosodi."""
    # Bindestreck i telefonnummer → mellanslag
    text = re.sub(r'(\d{2,3})-(\d{2,3})', r'\1 \2', text)
    # Valuta och procent
    text = re.sub(r'(\d[\d\s]*)\s*kr\b', r'\1 kronor', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d[\d\s]*)\s*%',    r'\1 procent', text)
    abbr = {
        'osv.': 'och så vidare', 'etc.': 'et cetera',
        'ca.':  'cirka',         'ca ':  'cirka ',
        'bl.a.': 'bland annat',  'dvs.': 'det vill säga',
        'f.ö.':  'för övrigt',   'nr ':  'nummer ',
        ' st ':  ' stycken ',    ' st.': ' stycken',
        'm.m.':  'med mera',     'inkl.': 'inklusive',
        'exkl.': 'exklusive',
    }
    for k, v in abbr.items():
        text = text.replace(k, v)
    return text


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        from kokoro import KPipeline
        log.info(f"Laddar Kokoro pipeline (lang={LANG}, voice={VOICE})...")
        _pipeline = KPipeline(lang_code=LANG)
        log.info("Kokoro pipeline redo ✓")
    return _pipeline


class TTSRequest(BaseModel):
    text:  str
    voice: str   = None
    speed: float = None


@app.get("/health")
def health():
    try:
        import torch
        cuda = torch.cuda.is_available()
        device = "cuda" if cuda else "cpu"
    except ImportError:
        cuda   = False
        device = "cpu"
    return {
        "status": "ok",
        "voice":  VOICE,
        "lang":   LANG,
        "device": device,
        "cuda":   cuda,
    }


@app.post("/tts")
async def synthesize(req: TTSRequest):
    text = _normalize_text(req.text.strip())
    if not text:
        raise HTTPException(400, "text saknas")
    if len(text) > 500:
        raise HTTPException(400, "max 500 tecken per anrop")

    voice    = req.voice or VOICE
    speed    = req.speed or SPEED
    t0       = time.time()
    pipeline = _get_pipeline()

    async with _sem:
        loop = asyncio.get_running_loop()

        def _run_synthesis():
            chunks = []
            for _, _, audio in pipeline(text, voice=voice, speed=speed):
                if audio is not None and len(audio) > 0:
                    chunks.append(np.array(audio, dtype=np.float32))
            return np.concatenate(chunks) if chunks else np.array([], dtype=np.float32)

        wav = await loop.run_in_executor(None, _run_synthesis)

    if len(wav) == 0:
        raise HTTPException(500, "Kokoro returnerade tom audio — kontrollera voice/lang")

    # Kokoro output: 24kHz float32
    mulaw = _wav_to_mulaw_8k(wav, 24000)
    ms    = int((time.time() - t0) * 1000)
    log.info(f"TTS {ms}ms | {len(text)} tecken | {len(mulaw)}B | röst={voice}")

    return Response(content=mulaw, media_type="audio/basic")


@app.get("/voices")
def list_voices():
    """Tillgängliga röster med beskrivning."""
    return {
        "current": VOICE,
        "lang":    LANG,
        "voices": {
            "kvinna_varm":        "af_nova",
            "kvinna_klar":        "af_sarah",
            "kvinna_mjuk":        "af_sky",
            "kvinna_uttrycksfull":"af_heart",
            "kvinna_brittisk":    "bf_emma",
            "man_professionell":  "am_adam",
            "man_djup":           "am_echo",
            "man_brittisk":       "bm_george",
        },
        "tips": "För svenska: testa lang=z med af_nova eller af_sarah",
    }


@app.on_event("startup")
async def startup():
    try:
        pipeline = _get_pipeline()
        # Warmup: laddar modellvikter i cache, eliminerar cold-start latens
        log.info("Kör warmup-syntes...")
        list(pipeline("Hej, välkommen.", voice=VOICE, speed=1.0))
        log.info("Server redo och varm ✓")
    except Exception as e:
        log.warning(f"Startup warmup misslyckades (startar vid första anrop): {e}")
