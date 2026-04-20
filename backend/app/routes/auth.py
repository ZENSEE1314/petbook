"""Register / login / me endpoints."""

from __future__ import annotations

import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import PasswordReset, User
from ..points import award, generate_referral_code, get_config
from ..schemas import (
    ChangePasswordIn, ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn,
    TokenOut, UserOut, UserUpdateIn,
)
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut)
def register(data: RegisterIn, db: Session = Depends(get_db)) -> TokenOut:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    is_admin = data.email.lower() == settings.first_admin_email.lower()

    referrer: User | None = None
    if data.referred_by_code:
        referrer = (
            db.query(User).filter(User.referral_code == data.referred_by_code.strip().upper()).first()
        )

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        display_name=data.display_name or data.email.split("@")[0],
        is_admin=is_admin,
        referral_code=generate_referral_code(db),
        referred_by_id=referrer.id if referrer else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if referrer:
        cfg = get_config(db)
        award(db, referrer, "referral_signup", cfg.referral_signup,
              ref_type="referral", ref_id=user.id,
              note=f"{user.display_name or user.email} signed up with your code")
        award(db, user, "referral_joiner_bonus", cfg.referral_joiner_bonus,
              ref_type="referral", ref_id=referrer.id,
              note=f"Welcome bonus for joining via {referrer.display_name or referrer.email}")

    return TokenOut(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


def _send_reset_email(to_email: str, url: str) -> bool:
    if not settings.smtp_host or not settings.smtp_from:
        return False
    msg = EmailMessage()
    msg["Subject"] = "Reset your Petbook password"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(
        f"Hi,\n\nClick the link below to reset your Petbook password. The link expires in 1 hour.\n\n{url}\n\nIf you didn't request this, you can safely ignore this email."
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
            s.starttls()
            if settings.smtp_user:
                s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[reset-email] SMTP send failed: {exc}")
        return False


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordIn, db: Session = Depends(get_db)) -> dict:
    """Always responds 200 to prevent email enumeration. If the email exists we
    create a 1-hour token, email it when SMTP is configured, and log the link
    to stdout as a fallback so admins can forward it manually."""
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        token = secrets.token_urlsafe(32)
        reset = PasswordReset(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(reset)
        db.commit()
        base = settings.public_site_url.rstrip("/") or "https://web-production-8835b.up.railway.app"
        url = f"{base}/reset-password?token={token}"
        sent = _send_reset_email(user.email, url)
        print(f"[reset-link] user={user.email} sent={sent} url={url}")
    return {"ok": True, "message": "If the email exists, a reset link is on its way."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordIn, db: Session = Depends(get_db)) -> dict:
    reset = db.query(PasswordReset).filter(PasswordReset.token == data.token).first()
    if not reset or reset.used_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or already-used token")
    if reset.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reset link has expired")
    user = db.get(User, reset.user_id)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User no longer exists")
    user.password_hash = hash_password(data.new_password)
    reset.used_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: ChangePasswordIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is wrong")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
