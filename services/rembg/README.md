# rembg service

Minimal FastAPI microservice that removes image backgrounds using [`rembg`](https://github.com/danielgatis/rembg)
(pre-trained U^2-Net ONNX model, CPU-only — no GPU/CUDA required).

## Development (standalone)

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 7000
```

Note: the first run downloads the `u2net` model (~176MB) from the internet and caches it in
`~/.u2net`; subsequent runs are fast.

## Endpoints

- `POST /remove-background` — multipart form upload (field `file`), returns the resulting PNG (RGBA) bytes.
- `GET /health` — liveness check, always `200 {"status": "ok"}`.

## Production

In production this service runs via Docker Compose, using the `ai` profile added by another agent:

```bash
docker compose --profile ai up rembg
```
