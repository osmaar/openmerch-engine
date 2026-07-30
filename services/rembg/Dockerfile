FROM python:3.11-slim

# rembg's onnxruntime backend needs libgl/libglib at runtime (via opencv-python-headless).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# rembg downloads/caches its ONNX model weights to ~/.u2net at runtime (default: /root/.u2net,
# since the container runs as root). That directory is intentionally left untouched here — an
# external docker-compose volume is expected to be mounted there to persist the model across
# container restarts/rebuilds. Do NOT create, chown, or WORKDIR into /root/.u2net in this
# Dockerfile, since doing so could shadow or break that mounted volume.

EXPOSE 7000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7000"]
