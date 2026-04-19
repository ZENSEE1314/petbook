"""Site-wide settings: name, logo, favicon, meta tags."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_admin
from ..models import SiteSettings, User
from ..schemas import SiteSettingsIn, SiteSettingsOut

router = APIRouter(prefix="/site", tags=["site"])


def _get_or_create(db: Session) -> SiteSettings:
    row = db.get(SiteSettings, 1)
    if not row:
        row = SiteSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/settings", response_model=SiteSettingsOut)
def get_settings(db: Session = Depends(get_db)) -> SiteSettings:
    return _get_or_create(db)


@router.patch("/settings", response_model=SiteSettingsOut)
def update_settings(
    data: SiteSettingsIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> SiteSettings:
    row = _get_or_create(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row
