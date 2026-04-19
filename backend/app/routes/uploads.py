"""Simple image uploads — saves to the configured upload dir and returns a URL.

By default we write to `backend/app/static/uploads` (served at `/static/uploads/...`).
In production, set `UPLOAD_DIR` to a path on a persistent volume (e.g. `/data/uploads`).
When `UPLOAD_DIR` is set, we serve the files at `/uploads/...` instead.
"""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..config import settings
from ..deps import get_current_user
from ..models import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

DEFAULT_DIR = Path(__file__).resolve().parent.parent / "static" / "uploads"


def upload_dir() -> Path:
    path = Path(settings.upload_dir) if settings.upload_dir else DEFAULT_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def public_url(filename: str) -> str:
    # Served at /uploads/... when a volume is mounted, /static/uploads/... otherwise.
    prefix = "/uploads" if settings.upload_dir else "/static/uploads"
    return f"{prefix}/{filename}"


ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_BYTES = 8 * 1024 * 1024  # 8 MB


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
) -> dict[str, str]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported file type")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large")

    name = f"{secrets.token_urlsafe(12)}{suffix}"
    (upload_dir() / name).write_bytes(data)
    return {"url": public_url(name)}
