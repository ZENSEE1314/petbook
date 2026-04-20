"""Points endpoints — my ledger, level info, admin config, leaderboard."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_admin
from ..models import PointsConfig, PointsEvent, User
from ..points import generate_referral_code, get_config, level_info

router = APIRouter(prefix="/points", tags=["points"])


class PointsConfigOut(BaseModel):
    post_created: int
    post_liked: int
    comment_created: int
    listing_created: int
    listing_sold: int
    order_per_dollar: int
    referral_signup: int
    referral_joiner_bonus: int
    review_created: int
    answer_created: int
    answer_accepted: int
    level_thresholds: str

    class Config:
        from_attributes = True


class PointsConfigIn(BaseModel):
    post_created: int | None = Field(None, ge=0)
    post_liked: int | None = Field(None, ge=0)
    comment_created: int | None = Field(None, ge=0)
    listing_created: int | None = Field(None, ge=0)
    listing_sold: int | None = Field(None, ge=0)
    order_per_dollar: int | None = Field(None, ge=0)
    referral_signup: int | None = Field(None, ge=0)
    referral_joiner_bonus: int | None = Field(None, ge=0)
    review_created: int | None = Field(None, ge=0)
    answer_created: int | None = Field(None, ge=0)
    answer_accepted: int | None = Field(None, ge=0)
    level_thresholds: str | None = None  # JSON array


@router.get("/me")
def my_points(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Lazy-backfill: accounts created before the referral_code column was added
    # show up with a NULL code. Generate one on first visit so the profile page
    # always has something to share.
    if not user.referral_code:
        user.referral_code = generate_referral_code(db)
        db.commit()
    cfg = get_config(db)
    events = (
        db.query(PointsEvent)
        .filter(PointsEvent.user_id == user.id)
        .order_by(PointsEvent.created_at.desc())
        .limit(200)
        .all()
    )
    return {
        **level_info(user.points or 0, cfg.level_thresholds),
        "referral_code": user.referral_code,
        "events": [
            {
                "id": e.id,
                "kind": e.kind,
                "points": e.points,
                "ref_type": e.ref_type,
                "ref_id": e.ref_id,
                "note": e.note,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
    }


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    top = (
        db.query(User)
        .filter(User.is_active == True)  # noqa: E712
        .order_by(User.points.desc())
        .limit(50)
        .all()
    )
    cfg = get_config(db)
    return [
        {
            "id": u.id,
            "display_name": u.display_name or u.email.split("@")[0],
            "avatar_url": u.avatar_url,
            "points": u.points or 0,
            "level": level_info(u.points or 0, cfg.level_thresholds)["level"],
        }
        for u in top
    ]


@router.get("/config", response_model=PointsConfigOut)
def get_points_config(db: Session = Depends(get_db)) -> PointsConfig:
    return get_config(db)


@router.patch("/config", response_model=PointsConfigOut)
def update_points_config(
    data: PointsConfigIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> PointsConfig:
    row = get_config(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row
