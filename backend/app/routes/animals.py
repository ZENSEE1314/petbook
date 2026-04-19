"""Animal catalog + guide entries."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, get_optional_user, require_admin
from ..models import Animal, GuideEntry, User
from ..schemas import AnimalIn, AnimalOut, GuideEntryIn, GuideEntryOut

router = APIRouter(prefix="/animals", tags=["animals"])

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    slug = _SLUG_RE.sub("-", name.strip().lower()).strip("-")
    return slug or "animal"


def _to_out(animal: Animal) -> AnimalOut:
    return AnimalOut(
        id=animal.id,
        slug=animal.slug,
        name=animal.name,
        category=animal.category,
        short_description=animal.short_description,
        image_url=animal.image_url,
        has_guide=animal.guide is not None and animal.guide.is_published,
    )


@router.get("", response_model=list[AnimalOut])
def list_animals(
    db: Session = Depends(get_db),
    category: str | None = None,
    q: str | None = None,
) -> list[AnimalOut]:
    query = db.query(Animal)
    if category:
        query = query.filter(Animal.category == category)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(Animal.name.ilike(like))
    return [_to_out(a) for a in query.order_by(Animal.name).all()]


@router.get("/{slug}", response_model=AnimalOut)
def get_animal(slug: str, db: Session = Depends(get_db)) -> AnimalOut:
    animal = db.query(Animal).filter(Animal.slug == slug).first()
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    return _to_out(animal)


@router.post("", response_model=AnimalOut, status_code=status.HTTP_201_CREATED)
def create_animal(
    data: AnimalIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> AnimalOut:
    slug = data.slug or _slugify(data.name)
    if db.query(Animal).filter(Animal.slug == slug).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Slug already exists")
    animal = Animal(
        slug=slug,
        name=data.name,
        category=data.category,
        short_description=data.short_description,
        image_url=data.image_url,
    )
    db.add(animal)
    db.commit()
    db.refresh(animal)
    return _to_out(animal)


@router.patch("/{animal_id}", response_model=AnimalOut)
def update_animal(
    animal_id: int,
    data: AnimalIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> AnimalOut:
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(animal, field, value)
    db.commit()
    db.refresh(animal)
    return _to_out(animal)


@router.delete("/{animal_id}")
def delete_animal(
    animal_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    db.delete(animal)
    db.commit()


# ---------- Guide entry ----------


@router.get("/{slug}/guide", response_model=GuideEntryOut)
def get_guide(
    slug: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> GuideEntry:
    animal = db.query(Animal).filter(Animal.slug == slug).first()
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    if not animal.guide:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No guide yet")

    # Admins see drafts too — otherwise they'd lose their work on refresh.
    if user and user.is_admin:
        return animal.guide

    if not animal.guide.is_published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Guide not published")
    if not user or not user.is_paid:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Paid membership required")
    return animal.guide


@router.put("/{animal_id}/guide", response_model=GuideEntryOut)
def upsert_guide(
    animal_id: int,
    data: GuideEntryIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> GuideEntry:
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    guide = animal.guide
    if not guide:
        guide = GuideEntry(animal_id=animal.id)
        db.add(guide)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(guide, field, value)
    db.commit()
    db.refresh(guide)
    return guide
