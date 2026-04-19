"""Image, video and audio uploads — saves to the configured upload dir and returns a URL.

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
    prefix = "/uploads" if settings.upload_dir else "/static/uploads"
    return f"{prefix}/{filename}"


IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}
AUDIO_EXT = {".mp3", ".m4a", ".wav", ".ogg", ".oga"}
MEDIA_EXT = IMAGE_EXT | VIDEO_EXT | AUDIO_EXT

MAX_IMAGE_BYTES = 8 * 1024 * 1024       # 8 MB
MAX_MEDIA_BYTES = 100 * 1024 * 1024     # 100 MB for video/audio


def _kind_for(suffix: str) -> str | None:
    if suffix in IMAGE_EXT:
        return "image"
    if suffix in VIDEO_EXT:
        return "video"
    if suffix in AUDIO_EXT:
        return "audio"
    return None


async def _save(file: UploadFile, max_bytes: int, allowed: set[str]) -> dict[str, str]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported file type")
    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large")
    name = f"{secrets.token_urlsafe(12)}{suffix}"
    (upload_dir() / name).write_bytes(data)
    return {"url": public_url(name), "kind": _kind_for(suffix) or "image"}


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
) -> dict[str, str]:
    return await _save(file, MAX_IMAGE_BYTES, IMAGE_EXT)


@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Accepts image, video or audio up to 100 MB. Returns {url, kind}."""
    return await _save(file, MAX_MEDIA_BYTES, MEDIA_EXT)
