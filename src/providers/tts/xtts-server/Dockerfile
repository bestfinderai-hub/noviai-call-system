FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /app

RUN pip install --no-cache-dir \
    TTS==0.22.0 \
    fastapi \
    uvicorn \
    pydantic

# Ladda ner XTTS-v2 modell vid byggtid (cachas i imagen)
RUN python -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2')"

COPY reference_male_sv.wav /app/reference_male_sv.wav
COPY server.py /app/server.py

ENV REF_AUDIO=/app/reference_male_sv.wav
ENV LANGUAGE=sv
ENV PORT=8000

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "server.py"]
