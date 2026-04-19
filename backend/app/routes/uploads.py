"""Simple image uploads — saves to backend/app/static/uploads/ and returns a URL."""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..deps import get_current_user
from ..models import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
    (UPLOAD_DIR / name).write_bytes(data)
    return {"url": f"/static/uploads/{name}"}
