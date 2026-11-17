"""
F5-TTS Swedish Inference Server
Exponerar POST /tts → mulaw 8kHz för Telnyx

Miljövariabler:
  MODEL_PATH   = EkhoCollective/f5-tts-swedish (default) eller /app/model
  REF_AUDIO    = /app/reference_male_sv.wav
  REF_TEXT     = referenstext som matchar ljudfilen
  PORT         = 8000
"""

import os, logging, io
import numpy as np
import audioop
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("f5tts")

app = FastAPI(title="F5-TTS Swedish")

MODEL_PATH = os.getenv("MODEL_PATH", "EkhoCollective/f5-tts-swedish")
REF_AUDIO  = os.getenv("REF_AUDIO",  "/app/reference_male_sv.wav")
REF_TEXT   = os.getenv("REF_TEXT",   "God dag, välkommen. Hur kan jag hjälpa dig idag?")

_tts = None

def _get_tts():
    global _tts
    if _tts is None:
        from f5_tts.api import F5TTS
        log.info(f"Laddar modell: {MODEL_PATH}")
        _tts = F5TTS(model_path=MODEL_PATH, device="cuda" if _has_cuda() else "cpu")
        log.info("Modell laddad")
    return _tts

def _has_cuda():
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False

def _wav_to_mulaw_8k(wav: np.ndarray, sr: int) -> bytes:
    # float32 → int16
    pcm = np.clip(wav, -1.0, 1.0)
    pcm16 = (pcm * 32767).astype(np.int16).tobytes()
    # Resampla till 8kHz via audioop
    if sr != 8000:
        pcm16, _ = audioop.ratecv(pcm16, 2, 1, sr, 8000, None)
    # PCM16 → mulaw
    return audioop.lin2ulaw(pcm16, 2)


class TTSRequest(BaseModel):
    text: str
    ref_audio: str | None = None
    ref_text:  str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_PATH, "cuda": _has_cuda()}


@app.post("/tts")
async def synthesize(req: TTSRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "text saknas")
    if len(text) > 2000:
        raise HTTPException(400, "text för lång (max 2000 tecken)")

    ref_file = req.ref_audio or REF_AUDIO
    ref_text = req.ref_text  or REF_TEXT

    if not os.path.exists(ref_file):
        raise HTTPException(500, f"Referensljud saknas: {ref_file}")

    import time
    t0 = time.time()

    try:
        tts = _get_tts()
        wav, sr, _ = tts.infer(
            ref_file=ref_file,
            ref_text=ref_text,
            gen_text=text,
            speed=1.0,
            remove_silence=True,
        )
    except Exception as e:
        log.error(f"TTS-fel: {e}")
        raise HTTPException(500, f"TTS misslyckades: {e}")

    mulaw = _wav_to_mulaw_8k(wav, sr)
    ms = int((time.time() - t0) * 1000)
    log.info(f"TTS {ms}ms | {len(text)} tecken | {len(mulaw)} bytes mulaw")

    return Response(content=mulaw, media_type="audio/basic")


@app.on_event("startup")
async def startup():
    try:
        _get_tts()
        log.info("Server redo")
    except Exception as e:
        log.warning(f"Pre-warmup misslyckades: {e} — laddar vid första anrop")
