#!/usr/bin/env python3
"""
XTTS-v2 Inference Server — NovAI Swedish Voice Clone
POST /tts  → mulaw 8kHz audio (direkt till Telnyx)
GET  /health → {"status":"ok","model":"xtts-v2","voice":"lars_rolander"}
"""

import os, audioop
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import torch, numpy as np
from TTS.api import TTS

app = FastAPI()

REF_AUDIO = os.environ.get("REF_AUDIO", "/app/reference_male_sv.wav")
LANGUAGE   = os.environ.get("LANGUAGE", "sv")
PORT       = int(os.environ.get("PORT", 8000))

print("Laddar XTTS-v2 modell...")
device = "cuda" if torch.cuda.is_available() else "cpu"
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

# XTTS-v2 outputtar alltid 24000 Hz — verifiera en gång vid start
_SAMPLE_WAV_SR = 24000
try:
    _test = tts.tts(text="test", speaker_wav=REF_AUDIO, language=LANGUAGE)
    # tts.synthesizer.output_sample_rate är källsamplingsfrekvensen
    if hasattr(tts, "synthesizer") and hasattr(tts.synthesizer, "output_sample_rate"):
        _SAMPLE_WAV_SR = tts.synthesizer.output_sample_rate
except Exception:
    pass
print(f"XTTS-v2 klar på {device} | sample rate: {_SAMPLE_WAV_SR} Hz")

class TTSRequest(BaseModel):
    text: str

@app.get("/health")
def health():
    return {"status": "ok", "model": "xtts-v2", "voice": "lars_rolander",
            "device": device, "sample_rate": _SAMPLE_WAV_SR}

@app.post("/tts")
def generate_tts(req: TTSRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(400, "text saknas")

    try:
        wav = tts.tts(text=req.text, speaker_wav=REF_AUDIO, language=LANGUAGE)

        if not wav or len(wav) == 0:
            raise ValueError("XTTS returnerade tomt ljud")

        # float32 list → int16 bytes
        audio = np.array(wav, dtype=np.float32)
        audio = np.clip(audio, -1.0, 1.0)
        audio_int16 = (audio * 32767).astype(np.int16).tobytes()

        # Sampla om från käll-Hz → 8kHz (Telnyx mulaw)
        audio_8k, _ = audioop.ratecv(audio_int16, 2, 1, _SAMPLE_WAV_SR, 8000, None)

        # PCM int16 → mulaw
        mulaw = audioop.lin2ulaw(audio_8k, 2)

        return Response(content=mulaw, media_type="audio/basic")

    except Exception as e:
        raise HTTPException(500, f"TTS fel: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
