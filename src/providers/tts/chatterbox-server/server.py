"""
Chatterbox TTS Server — Swedish voice cloning för NovAI
POST /tts → mulaw 8kHz för Telnyx

Env-vars:
  REF_AUDIO    = /app/reference.wav  (10-30 sek manlig röst)
  PORT         = 8000
  DEVICE       = cuda (default) eller cpu
  API_KEY      = secret (om satt krävs Authorization: Bearer <key>)
"""

import os, logging, base64, tempfile, time, asyncio
import numpy as np
import scipy.signal
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("chatterbox")

app = FastAPI(title="Chatterbox TTS")

REF_AUDIO  = os.getenv("REF_AUDIO", "/app/reference.wav")
DEVICE     = os.getenv("DEVICE", "cuda")
API_KEY    = os.getenv("API_KEY", "")

# Serialize GPU calls — Chatterbox är inte thread-safe under syntes
_gpu_sem = asyncio.Semaphore(1)

_model = None
# Cache default referensljud vid startup (undviker disk-I/O per anrop)
_ref_audio_b64_cache: str | None = None


def _load_ref_cache():
    global _ref_audio_b64_cache
    if os.path.exists(REF_AUDIO):
        with open(REF_AUDIO, "rb") as f:
            _ref_audio_b64_cache = base64.b64encode(f.read()).decode()
        log.info(f"Referensljud cacheat från {REF_AUDIO}")
    else:
        log.warning(f"Referensljud saknas vid startup: {REF_AUDIO}")


def _get_model():
    global _model
    if _model is None:
        from chatterbox.tts import ChatterboxTTS
        log.info(f"Laddar Chatterbox på {DEVICE}...")
        _model = ChatterboxTTS.from_pretrained(device=DEVICE)
        log.info("Modell laddad")
    return _model


def _wav_to_mulaw_8k(wav: np.ndarray, sr: int) -> bytes:
    """Konvertera float32 PCM (−1..1) till mulaw 8kHz med scipy (audioop borttaget i Python 3.13+)."""
    if sr != 8000:
        n_samples = int(round(len(wav) * 8000 / sr))
        wav = scipy.signal.resample(wav, n_samples)
    pcm = np.clip(wav, -1.0, 1.0)
    pcm_abs = np.abs(pcm)
    mu = np.float32(255)
    # ITU-T G.711 µ-law encoding
    mulaw = np.sign(pcm) * np.log1p(mu * pcm_abs) / np.log1p(mu)
    # Skala till [0, 255] och invertera (standard PCM-mulaw-mapping)
    encoded = np.round((mulaw * 127.0) + 127.0).astype(np.uint8)
    return encoded.tobytes()


# --- Auth -------------------------------------------------------------------

_bearer = HTTPBearer(auto_error=False)


def _check_auth(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)):
    if not API_KEY:
        return  # Auth avstängd
    if creds is None or creds.credentials != API_KEY:
        raise HTTPException(401, "Ogiltig eller saknad API-nyckel")


# --- Endpoints --------------------------------------------------------------

class TTSRequest(BaseModel):
    text: str
    ref_audio_b64: str | None = Field(None, max_length=2_097_152)  # max ~1.5 MB WAV
    exaggeration: float = Field(0.5, ge=0.0, le=1.0)
    cfg_weight:   float = Field(0.5, ge=0.0, le=1.0)


@app.get("/health")
def health():
    import torch
    return {"status": "ok", "device": DEVICE, "cuda": torch.cuda.is_available()}


@app.post("/tts", dependencies=[Depends(_check_auth)])
async def synthesize(req: TTSRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "text saknas")
    if len(text) > 2000:
        raise HTTPException(400, "text för lång (max 2000 tecken)")

    t0 = time.time()

    # Välj referensljud: request-override eller cacheat default
    tmp = None
    if req.ref_audio_b64:
        try:
            raw = base64.b64decode(req.ref_audio_b64)
        except Exception:
            raise HTTPException(400, "Ogiltig ref_audio_b64 (ej giltig base64)")
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp.write(raw)
        tmp.close()
        ref_path = tmp.name
    else:
        if not os.path.exists(REF_AUDIO):
            raise HTTPException(500, "Referensljud saknas på servern")
        ref_path = REF_AUDIO

    try:
        model = _get_model()
        async with _gpu_sem:
            import torch
            wav = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: model.generate(
                    text,
                    audio_prompt_path=ref_path,
                    exaggeration=req.exaggeration,
                    cfg_weight=req.cfg_weight,
                )
            )
        wav_np = wav.squeeze(0).cpu().numpy()
        sr = model.sr
    except Exception as e:
        log.error(f"Chatterbox-fel: {e}")
        raise HTTPException(500, "TTS misslyckades — se server-loggar")
    finally:
        if tmp:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    mulaw = _wav_to_mulaw_8k(wav_np, sr)
    ms = int((time.time() - t0) * 1000)
    log.info(f"TTS {ms}ms | {len(text)} tecken | {len(mulaw)}B mulaw")

    return Response(content=mulaw, media_type="audio/basic")


@app.on_event("startup")
async def startup():
    _load_ref_cache()
    try:
        _get_model()
        log.info("Server redo")
    except Exception as e:
        log.warning(f"Pre-warmup misslyckades: {e}")
