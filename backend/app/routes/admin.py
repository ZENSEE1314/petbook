"""Admin-only endpoints — user management, AI-assisted animal tools."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..ai import generate_guide_draft, suggest_more_animals
from ..db import get_db
from ..deps import require_admin
from ..models import Animal, GuideEntry, Order, User
from ..schemas import GuideEntryOut, OrderOut, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


class UserPatch(BaseModel):
    is_active: bool | None = None
    is_admin: bool | None = None
    is_paid: bool | None = None


class SuggestIn(BaseModel):
    count: int = 5


# ---------- Users ----------


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[User]:
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserPatch,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete yourself")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    db.delete(user)
    db.commit()


# ---------- AI-assisted animal tools ----------


@router.post("/animals/{animal_id}/generate-guide", response_model=GuideEntryOut)
def ai_generate_guide(
    animal_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> GuideEntry:
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    draft = generate_guide_draft(animal.name)
    guide = animal.guide or GuideEntry(animal_id=animal.id)
    for field in ("lifespan_years", "adult_size", "healthy_markers", "diet",
                  "training", "housing", "common_issues", "age_stages"):
        if field in draft:
            setattr(guide, field, draft[field])
    if not animal.guide:
        db.add(guide)
    db.commit()
    db.refresh(guide)
    return guide


@router.post("/animals/suggest")
def ai_suggest_animals(
    data: SuggestIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[dict]:
    existing = [a.name for a in db.query(Animal).all()]
    return suggest_more_animals(count=data.count, exclude_names=existing)


# ---------- Orders oversight ----------


@router.get("/orders", response_model=list[OrderOut])
def all_orders(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[OrderOut]:
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    from .orders import _to_out  # local import to avoid circular at module load
    return [_to_out(o) for o in orders]
