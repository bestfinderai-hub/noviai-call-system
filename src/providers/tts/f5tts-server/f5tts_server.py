"""
F5-TTS Swedish Inference Server (Kaggle T4 GPU)
POST /tts → mulaw 8kHz for Telnyx/NovAI

Env:
  MODEL_DIR = /kaggle/working/model
  REF_AUDIO = /kaggle/working/reference.wav
  REF_TEXT  = exakt transkription av referensljudet
  PORT      = 8000
"""

import os, re, logging, time, asyncio
from math import gcd
import numpy as np
import scipy.signal
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("f5tts")

app = FastAPI(title="F5-TTS Swedish")

MODEL_DIR = os.getenv("MODEL_DIR", "/kaggle/working/model")
REF_AUDIO  = os.getenv("REF_AUDIO",  "/kaggle/working/reference.wav")
REF_TEXT   = os.getenv("REF_TEXT",   "Med kvällens vindar blandas han kallar på sin brud. Jo vackert tyst inföll Adolf den av de båda jäknarna som sjöng första stämman. Hör du då icke hur inspektorn gormar och svär.")

_tts = None
_gpu_sem = asyncio.Semaphore(1)

# ITU-T G.711 µ-law segment lookup table (from audioop C source, verified)
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

_MULAW_CLIP = 32635
_MULAW_BIAS_14 = 33  # audioop BIAS (0x84=132) >> 2, for 16-bit input


def _lin2ulaw(pcm16: np.ndarray) -> np.ndarray:
    """Vectorized ITU-T G.711 µ-law — bit-identical to audioop.lin2ulaw(data, 2).
    audioop was removed in Python 3.13; this numpy version matches the C source exactly.
    16-bit input: right-shift by 2 to 14-bit working space (audioop size=2 convention).
    Positive samples → bit7=1 in output; negative → bit7=0."""
    s = pcm16.astype(np.int32) >> 2           # 16-bit → 14-bit (audioop size=2)
    mask = np.where(s >= 0, np.int32(0xFF), np.int32(0x7F))
    s_abs = np.abs(s)
    s_abs = np.minimum(s_abs, _MULAW_CLIP)
    s_abs = s_abs + _MULAW_BIAS_14            # bias=33 in 14-bit space
    exp  = _EXP_LUT[(s_abs >> 7) & 0xFF]
    mant = (s_abs >> (exp + 3)) & 0x0F
    return (((exp << 4) | mant) ^ mask).astype(np.uint8)


def _normalize_text(text: str) -> str:
    """Expandera förkortningar och siffror för naturlig prosodi i F5-TTS."""
    # Bindestreck i telefonnummer → mellanslag (08-123 → 08 123)
    text = re.sub(r'(\d{2,3})-(\d{2,3})', r'\1 \2', text)
    # Valuta
    text = re.sub(r'(\d[\d\s]*)\s*kr\b', r'\1 kronor', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d[\d\s]*)\s*%', r'\1 procent', text)
    # Vanliga förkortningar
    abbr = {
        'osv.': 'och så vidare', 'etc.': 'et cetera',
        'ca.': 'cirka', 'ca ': 'cirka ', 'bl.a.': 'bland annat',
        'dvs.': 'det vill säga', 'f.ö.': 'för övrigt',
        'nr ': 'nummer ', ' st ': ' stycken ', ' st.': ' stycken',
        'm.m.': 'med mera', 'inkl.': 'inklusive', 'exkl.': 'exklusive',
    }
    for k, v in abbr.items():
        text = text.replace(k, v)
    return text


def _wav_to_mulaw_8k(wav: np.ndarray, sr: int) -> bytes:
    """float32 PCM → ITU-T G.711 mulaw 8kHz (Telnyx PCMU format)"""
    if len(wav) == 0:
        raise ValueError("TTS returnerade tom audio")

    # Polyphase FIR resample with Kaiser anti-aliasing window — BEFORE pre-emphasis
    # to avoid aliasing artifacts from boosted high-freq energy above Nyquist
    if sr != 8000:
        g = gcd(8000, sr)
        wav = scipy.signal.resample_poly(wav, 8000 // g, sr // g)

    # Pre-emphasis AFTER resampling, optimized for 300-3400Hz telephony band (ITU P.800)
    # 0.85 (not 0.97) avoids wasting dynamic range on freqs above Nyquist
    pre = 0.85
    wav = np.concatenate([[wav[0]], wav[1:] - pre * wav[:-1]])

    # RMS normalization to -18 dBFS (ITU-T P.56 telephony standard)
    # Peak normalization is wrong for telephony — a single click sets the ceiling
    rms = np.sqrt(np.mean(wav ** 2))
    if rms > 1e-6:
        target_rms = 0.126  # -18 dBFS
        gain = min(target_rms / rms, 10.0)
        wav = wav * gain
    wav = np.clip(wav, -0.98, 0.98)  # 2% headroom against µ-law hard clip

    # float32 → int16 → ITU-T G.711 µ-law
    pcm16 = (np.clip(wav, -1.0, 1.0) * 32767).astype(np.int16)
    return _lin2ulaw(pcm16).tobytes()


def _get_tts():
    global _tts
    if _tts is None:
        from f5_tts.api import F5TTS
        import torch
        log.info(f"Laddar EkhoCollective F5-TTS från {MODEL_DIR}...")
        _tts = F5TTS(
            ckpt_file=f"{MODEL_DIR}/model_last.pt",
            vocab_file=f"{MODEL_DIR}/vocab.txt",
        )
        # float16 for ~40% faster inference on T4 tensor cores
        if torch.cuda.is_available() and hasattr(_tts, 'model'):
            try:
                _tts.model = _tts.model.half()
                log.info("Modell laddad (float16/T4) ✓")
            except Exception as e:
                log.warning(f"float16 misslyckades, kör float32: {e}")
                log.info("Modell laddad (float32) ✓")
        else:
            log.info("Modell laddad ✓")
    return _tts


class TTSRequest(BaseModel):
    text: str


@app.get("/health")
def health():
    import torch
    return {"status": "ok", "cuda": torch.cuda.is_available(), "model": MODEL_DIR}


@app.post("/tts")
async def synthesize(req: TTSRequest):
    text = _normalize_text(req.text.strip())
    if not text:
        raise HTTPException(400, "text saknas")
    if len(text) > 500:
        raise HTTPException(400, "max 500 tecken")

    t0 = time.time()
    tts = _get_tts()

    async with _gpu_sem:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: tts.infer(
                ref_file=REF_AUDIO,
                ref_text=REF_TEXT,
                gen_text=text,
                speed=1.0,
                nfe_step=64,          # 32=poor, 64=good, 128=marginal +5% but 2x slower
                cfg_strength=1.8,     # 2.5 was over-guided → stiff prosody; 1.8 more natural
                remove_silence=False, # True causes robotic output (GitHub issue #159)
            )
        )

    # Handle both CUDA tensor and numpy array returns
    wav_raw = result[0]
    sr = result[1]
    if hasattr(wav_raw, 'cpu'):
        wav_np = wav_raw.detach().cpu().numpy()
    else:
        wav_np = np.array(wav_raw)
    wav_np = wav_np.squeeze()

    if len(wav_np) == 0:
        raise HTTPException(500, "TTS returnerade tom audio")

    mulaw = _wav_to_mulaw_8k(wav_np, sr)
    ms = int((time.time() - t0) * 1000)
    log.info(f"TTS {ms}ms | {len(text)} tecken | {len(mulaw)}B")

    return Response(content=mulaw, media_type="audio/basic")


@app.on_event("startup")
async def startup():
    try:
        _get_tts()
        log.info("Server redo ✓")
    except Exception as e:
        log.warning(f"Warmup misslyckades: {e} — laddar vid första anrop")
