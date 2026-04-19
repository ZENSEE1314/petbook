"""Register / login / me endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..points import award, generate_referral_code, get_config
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut, UserUpdateIn
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
