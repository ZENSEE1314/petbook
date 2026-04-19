"""FastAPI dependencies for the authenticated user and role gates."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .db import get_db
from .models import User
from .security import decode_token


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    _refresh_paid_status(user, db)
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    if not authorization:
        return None
    try:
        return get_current_user(authorization, db)
    except HTTPException:
        return None


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


def require_paid(user: User = Depends(get_current_user)) -> User:
    if not user.is_paid:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Paid membership required")
    return user


def _refresh_paid_status(user: User, db: Session) -> None:
    """Flip is_paid back to False when paid_until has lapsed."""
    if user.is_paid and user.paid_until and user.paid_until < datetime.now(timezone.utc):
        user.is_paid = False
        db.commit()
