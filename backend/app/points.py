"""Points ledger helper.

Call award(db, user, kind, amount, ref_type, ref_id, note) to credit points.
The User.points cache is updated in the same transaction as the PointsEvent
insert so the running balance never drifts.
"""

from __future__ import annotations

import json
import secrets

from sqlalchemy.orm import Session

from .models import PointsConfig, PointsEvent, User


def generate_referral_code(db: Session, length: int = 8) -> str:
    while True:
        code = secrets.token_urlsafe(length)[:length].upper()
        exists = db.query(User).filter(User.referral_code == code).first()
        if not exists:
            return code


def get_config(db: Session) -> PointsConfig:
    row = db.get(PointsConfig, 1)
    if not row:
        row = PointsConfig(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def award(
    db: Session,
    user: User | None,
    kind: str,
    amount: int,
    *,
    ref_type: str | None = None,
    ref_id: int | None = None,
    note: str | None = None,
) -> PointsEvent | None:
    """Credit points to `user`. Silently no-ops when user is None or amount ≤ 0."""
    if user is None or amount <= 0:
        return None
    event = PointsEvent(
        user_id=user.id,
        kind=kind,
        points=amount,
        ref_type=ref_type,
        ref_id=ref_id,
        note=note,
    )
    db.add(event)
    user.points = (user.points or 0) + amount
    db.commit()
    db.refresh(event)
    return event


def level_for(points: int, thresholds_json: str) -> int:
    try:
        thresholds = json.loads(thresholds_json)
    except json.JSONDecodeError:
        thresholds = [0, 50, 200, 500, 1500, 5000, 15000]
    level = 1
    for i, t in enumerate(thresholds):
        if points >= t:
            level = i + 1
    return level


def level_info(points: int, thresholds_json: str) -> dict:
    try:
        thresholds: list[int] = json.loads(thresholds_json)
    except json.JSONDecodeError:
        thresholds = [0, 50, 200, 500, 1500, 5000, 15000]
    level = level_for(points, thresholds_json)
    current_floor = thresholds[level - 1] if level - 1 < len(thresholds) else thresholds[-1]
    next_floor = thresholds[level] if level < len(thresholds) else None
    return {
        "level": level,
        "points": points,
        "current_floor": current_floor,
        "next_floor": next_floor,
        "progress": (
            0
            if next_floor is None or next_floor == current_floor
            else max(0, min(1, (points - current_floor) / (next_floor - current_floor)))
        ),
    }
