"""
F5-TTS Swedish — Modal serverless GPU endpoint
Stabil HTTPS-URL, T4 GPU, gratis $30/mån (~50h T4)

Deploy:
  cd src/providers/tts/f5tts-server
  modal deploy modal_f5tts.py

URL efter deploy (visas i terminalen):
  https://DITT-NAMN--f5tts-swedish-serve.modal.run

Sätt i .env:
  TTS_PROVIDER=f5tts
  F5TTS_SERVER_URL=https://DITT-NAMN--f5tts-swedish-serve.modal.run
  F5TTS_TIMEOUT_MS=15000
"""

import re
import time
import logging
import asyncio
from math import gcd

import modal
import numpy as np

# ── Volume för modellvikter (~600MB, laddas ner en gång och cachas) ───────────
volume   = modal.Volume.from_name("f5tts-swedish-weights", create_if_missing=True)
MODEL_DIR = "/weights/ekho-f5tts-sv"


def _download_model():
    """Körs en gång vid image-build — laddar ner EkhoCollective F5-TTS."""
    import os
    from huggingface_hub import snapshot_download
    os.makedirs(MODEL_DIR, exist_ok=True)
    snapshot_download(
        repo_id="EkhoCollective/f5-tts-swedish",
        local_dir=MODEL_DIR,
        ignore_patterns=["*.md", "logs/", "samples/"],
    )
    print(f"Modell nedladdad till {MODEL_DIR} ✓")


# ── Modal image (byggs en gång, cachas) ───────────────────────────────────────
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "f5-tts>=0.9.0",
        "torch",
        "torchaudio",
        "fastapi>=0.111.0",
        "uvicorn[standard]>=0.30.0",
        "pydantic>=2.0",
        "numpy>=1.26",
        "scipy",
        "huggingface_hub",
    )
    .run_function(_download_model, volumes={"/weights": volume})
    .add_local_file("reference_male_sv_10s.wav", "/app/reference.wav")
)

app = modal.App("f5tts-swedish")

# ── ITU-T G.711 µ-law (bit-identisk med audioop.lin2ulaw, Python 3.13-safe) ──

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

REF_AUDIO = "/app/reference.wav"
REF_TEXT  = (
    "Med kvällens vindar blandas, han kallar på sin brud. Jo, vackert, tyst, inföll Adolf. "
    "Den av de båda jäknarna som sjöng första stämman. Hör du då icke hur inspektorn gormar och svär."
)


def _lin2ulaw(pcm16: np.ndarray) -> np.ndarray:
    s    = pcm16.astype(np.int32) >> 2
    mask = np.where(s >= 0, np.int32(0xFF), np.int32(0x7F))
    s    = np.minimum(np.abs(s), 32635) + 33
    exp  = _EXP_LUT[(s >> 7) & 0xFF]
    mant = (s >> (exp + 3)) & 0x0F
    return (((exp << 4) | mant) ^ mask).astype(np.uint8)


def _wav_to_mulaw_8k(wav: np.ndarray, sr: int) -> bytes:
    import scipy.signal
    if sr != 8000:
        g   = gcd(8000, sr)
        wav = scipy.signal.resample_poly(wav, 8000 // g, sr // g)
    wav = np.concatenate([[wav[0]], wav[1:] - 0.85 * wav[:-1]])
    rms = np.sqrt(np.mean(wav ** 2))
    if rms > 1e-6:
        wav = wav * min(0.126 / rms, 10.0)
    pcm16 = (np.clip(wav, -0.98, 0.98) * 32767).astype(np.int16)
    return _lin2ulaw(pcm16).tobytes()


def _normalize_text(text: str) -> str:
    text = re.sub(r'(\d{2,3})-(\d{2,3})', r'\1 \2', text)
    text = re.sub(r'(\d[\d\s]*)\s*kr\b', r'\1 kronor', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d[\d\s]*)\s*%',    r'\1 procent', text)
    for k, v in {
        'osv.': 'och så vidare', 'etc.': 'et cetera', 'ca.': 'cirka',
        'bl.a.': 'bland annat',  'dvs.': 'det vill säga', 'm.m.': 'med mera',
    }.items():
        text = text.replace(k, v)
    return text


# ── Modal klass ───────────────────────────────────────────────────────────────

@app.cls(
    gpu="T4",
    image=image,
    volumes={"/weights": volume},
    min_containers=1,       # alltid varm = 0 cold-start under samtal
    scaledown_window=600,   # skala ner efter 10 min inaktivitet
    timeout=60,
)
class F5TTSServer:

    @modal.enter()
    def load_model(self):
        """Laddar modell i GPU-minnet när container startar."""
        import torch
        from f5_tts.api import F5TTS

        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
        self.log = logging.getLogger("f5tts-modal")

        self.log.info(f"Laddar F5-TTS från {MODEL_DIR}...")
        self.tts = F5TTS(
            ckpt_file=f"{MODEL_DIR}/model_last.pt",
            vocab_file=f"{MODEL_DIR}/vocab.txt",
        )
        if torch.cuda.is_available() and hasattr(self.tts, 'model'):
            try:
                self.tts.model = self.tts.model.half()
                self.log.info("Modell laddad (float16/T4) ✓")
            except Exception as e:
                self.log.warning(f"float16 misslyckades: {e}")

        self._sem = asyncio.Semaphore(1)
        self.log.info("Server redo ✓")

    @modal.asgi_app()
    def serve(self):
        from fastapi import FastAPI, HTTPException
        from fastapi.responses import Response
        from pydantic import BaseModel

        web = FastAPI(title="F5-TTS Swedish")

        class TTSRequest(BaseModel):
            text: str

        @web.get("/health")
        def health():
            import torch
            return {"status": "ok", "cuda": torch.cuda.is_available()}

        @web.post("/tts")
        async def synthesize(req: TTSRequest):
            text = _normalize_text(req.text.strip())
            if not text:
                raise HTTPException(400, "text saknas")
            if len(text) > 500:
                raise HTTPException(400, "max 500 tecken")

            t0 = time.time()
            async with self._sem:
                loop   = asyncio.get_running_loop()
                result = await loop.run_in_executor(None, lambda: self.tts.infer(
                    ref_file=REF_AUDIO, ref_text=REF_TEXT,
                    gen_text=text, speed=1.0,
                    nfe_step=64, cfg_strength=1.8, remove_silence=False,
                ))

            wav = result[0]
            sr  = result[1]
            wav = wav.detach().cpu().numpy() if hasattr(wav, 'cpu') else np.array(wav)
            wav = wav.squeeze()

            if len(wav) == 0:
                raise HTTPException(500, "TTS returnerade tom audio")

            mulaw = _wav_to_mulaw_8k(wav, sr)
            self.log.info(f"TTS {int((time.time()-t0)*1000)}ms | {len(text)}t | {len(mulaw)}B")
            return Response(content=mulaw, media_type="audio/basic")

        return web
