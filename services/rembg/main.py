"""
Minimal FastAPI microservice for AI background removal using rembg (U^2-Net, ONNX, CPU-only).

Design notes:
- The rembg session (and its ONNX model) is created once at process startup, in a module-level
  variable, rather than lazily on the first request. This means the first real request to
  /remove-background does not pay the model-load cost (and, on a cold container with no cached
  weights yet, the ~176MB download). /health intentionally does NOT depend on the session being
  ready; it always returns 200 immediately so orchestrators (docker healthcheck, k8s liveness/
  readiness probes) can tell the process is alive even while the model is still loading/downloading
  in the background.
"""

import io
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image, UnidentifiedImageError
from rembg import new_session, remove

logger = logging.getLogger("rembg-service")
logging.basicConfig(level=logging.INFO)

MODEL_NAME = "u2net"

# Populated by _load_model_in_background() shortly after startup; None until then.
_session = None


def _load_model_in_background() -> None:
    global _session
    try:
        logger.info("Loading rembg model '%s'...", MODEL_NAME)
        _session = new_session(MODEL_NAME)
        logger.info("rembg model '%s' loaded.", MODEL_NAME)
    except Exception:
        logger.exception("Failed to load rembg model '%s'", MODEL_NAME)


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    # Load in a background thread so the server can start accepting /health checks immediately,
    # without blocking process startup on a (potentially large, first-run) model download.
    threading.Thread(target=_load_model_in_background, daemon=True).start()
    yield


app = FastAPI(title="rembg background removal service", lifespan=_lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/remove-background")
async def remove_background(file: UploadFile = File(...)):
    try:
        input_bytes = await file.read()
    except Exception as exc:
        logger.warning("Failed to read uploaded file: %s", exc)
        return JSONResponse(status_code=400, content={"error": "Could not read uploaded file"})

    if not input_bytes:
        return JSONResponse(status_code=400, content={"error": "Uploaded file is empty"})

    # Validate that the payload is actually a decodable image before handing it to rembg, so we
    # can return a clean 400 for garbage input instead of letting an rembg/onnxruntime internal
    # error bubble up as a 500 with a raw stack trace.
    try:
        Image.open(io.BytesIO(input_bytes)).verify()
    except UnidentifiedImageError:
        return JSONResponse(status_code=400, content={"error": "Uploaded file is not a valid image"})
    except Exception as exc:
        logger.warning("Image validation failed: %s", exc)
        return JSONResponse(status_code=400, content={"error": "Uploaded file is not a valid image"})

    session = _session
    try:
        if session is not None:
            output_bytes = remove(input_bytes, session=session)
        else:
            # Model still loading (e.g. right after container start) — fall back to a one-off
            # session rather than failing the request.
            output_bytes = remove(input_bytes)
    except Exception as exc:
        logger.exception("rembg failed to process a validated image")
        return JSONResponse(
            status_code=500,
            content={"error": "Background removal failed while processing the image"},
        )

    return Response(content=output_bytes, media_type="image/png")
