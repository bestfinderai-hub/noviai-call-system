FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

RUN pip install --no-cache-dir \
    chatterbox-tts==0.1.3 \
    fastapi==0.115.6 \
    "uvicorn[standard]==0.32.1" \
    pydantic==2.10.4 \
    numpy==1.26.4 \
    scipy==1.14.1

# Non-root user för säkerhet
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Kopiera referensljud (spela in 10-30 sek manlig röst, spara som reference.wav)
COPY --chown=appuser:appuser reference.wav /app/reference.wav
COPY --chown=appuser:appuser server.py /app/server.py

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
