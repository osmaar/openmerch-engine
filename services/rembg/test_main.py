import io

from fastapi.testclient import TestClient
from PIL import Image

from main import app

client = TestClient(app)


def _make_test_png_bytes() -> bytes:
    """Build a small solid-color PNG in-memory, no external assets needed."""
    img = Image.new("RGB", (64, 64), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_remove_background_valid_image():
    png_bytes = _make_test_png_bytes()

    resp = client.post(
        "/remove-background",
        files={"file": ("test.png", png_bytes, "image/png")},
    )

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"

    # Confirm the response body is itself a valid, decodable PNG with an alpha channel.
    result_img = Image.open(io.BytesIO(resp.content))
    result_img.verify()
    result_img = Image.open(io.BytesIO(resp.content))  # re-open: verify() invalidates the handle
    assert result_img.format == "PNG"
    assert result_img.mode == "RGBA"


def test_remove_background_invalid_image():
    garbage_bytes = b"this is definitely not an image file"

    resp = client.post(
        "/remove-background",
        files={"file": ("garbage.bin", garbage_bytes, "application/octet-stream")},
    )

    assert resp.status_code in (400, 500)
    body = resp.json()
    assert "error" in body
