# F5-TTS Swedish Inference Server
# Bygg: docker build -t f5tts-swedish .
# Kör:  docker run --gpus all -p 8000:8000 \
#         -e REF_AUDIO=/app/reference_male_sv.wav \
#         -v /path/to/model:/app/model \
#         f5tts-swedish
#
# RunPod: välj "RunPod Pytorch 2.1" template, port 8000, ladda upp denna container

FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /app

# System
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ladda ner modell vid bygge (cachas i imagen, ~1.5 GB)
RUN python -c "\
from huggingface_hub import snapshot_download; \
snapshot_download('EkhoCollective/f5-tts-swedish', local_dir='/app/model')"

# Kopiera server + referensljud
COPY server.py .
# OBS: referensljudfil måste finnas — antingen bundla eller montera via volym
# COPY reference_male_sv.wav .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:8000/health || exit 1

ENV MODEL_PATH=/app/model
ENV REF_AUDIO=/app/reference_male_sv.wav
ENV PORT=8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
