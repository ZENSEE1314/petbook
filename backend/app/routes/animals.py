"""Animal catalog + guide entries."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, get_optional_user, require_admin
from ..models import Animal, GuideEntry, GuideMedia, User
from ..schemas import AnimalIn, AnimalOut, GuideEntryIn, GuideEntryOut, GuideMediaIn, GuideMediaOut

router = APIRouter(prefix="/animals", tags=["animals"])

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    slug = _SLUG_RE.sub("-", name.strip().lower()).strip("-")
    return slug or "animal"


def _to_out(animal: Animal, parent: Animal | None = None, child_count: int = 0) -> AnimalOut:
    return AnimalOut(
        id=animal.id,
        slug=animal.slug,
        name=animal.name,
        category=animal.category,
        short_description=animal.short_description,
        image_url=animal.image_url,
        parent_id=animal.parent_id,
        parent_slug=parent.slug if parent else None,
        parent_name=parent.name if parent else None,
        child_count=child_count,
        has_guide=animal.guide is not None and animal.guide.is_published,
    )


def _annotate(db: Session, animals: list[Animal]) -> list[AnimalOut]:
    """Bulk-load parent + child counts for an animal list."""
    parent_ids = {a.parent_id for a in animals if a.parent_id}
    parents = (
        {p.id: p for p in db.query(Animal).filter(Animal.id.in_(parent_ids)).all()}
        if parent_ids
        else {}
    )
    ids = [a.id for a in animals]
    counts: dict[int, int] = {}
    if ids:
        from sqlalchemy import func, select
        rows = db.execute(
            select(Animal.parent_id, func.count(Animal.id))
            .where(Animal.parent_id.in_(ids))
            .group_by(Animal.parent_id)
        ).all()
        counts = {row[0]: row[1] for row in rows}
    return [_to_out(a, parents.get(a.parent_id), counts.get(a.id, 0)) for a in animals]


@router.get("", response_model=list[AnimalOut])
def list_animals(
    db: Session = Depends(get_db),
    category: str | None = None,
    q: str | None = None,
    parent: str | None = None,        # slug of parent, or "null" for top-level only
    top_level: bool = False,           # shorthand for parent=null
) -> list[AnimalOut]:
    query = db.query(Animal)
    if category:
        query = query.filter(Animal.category == category)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(Animal.name.ilike(like))
    if parent == "null" or top_level:
        query = query.filter(Animal.parent_id.is_(None))
    elif parent:
        parent_row = db.query(Animal).filter(Animal.slug == parent).first()
        if not parent_row:
            return []
        query = query.filter(Animal.parent_id == parent_row.id)
    return _annotate(db, query.order_by(Animal.name).all())


@router.get("/{slug}", response_model=AnimalOut)
def get_animal(slug: str, db: Session = Depends(get_db)) -> AnimalOut:
    animal = db.query(Animal).filter(Animal.slug == slug).first()
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    parent = db.get(Animal, animal.parent_id) if animal.parent_id else None
    child_count = db.query(Animal).filter(Animal.parent_id == animal.id).count()
    return _to_out(animal, parent, child_count)


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


# ---------- Media (video / audio / image training tutorials) ----------


@router.get("/{slug}/media", response_model=list[GuideMediaOut])
def list_media(slug: str, db: Session = Depends(get_db)) -> list[GuideMedia]:
    animal = db.query(Animal).filter(Animal.slug == slug).first()
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    return (
        db.query(GuideMedia)
        .filter(GuideMedia.animal_id == animal.id)
        .order_by(GuideMedia.position, GuideMedia.created_at)
        .all()
    )


@router.post("/{animal_id}/media", response_model=GuideMediaOut, status_code=status.HTTP_201_CREATED)
def add_media(
    animal_id: int,
    data: GuideMediaIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> GuideMedia:
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    if data.kind not in {"video", "audio", "image"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "kind must be video, audio, or image")
    media = GuideMedia(animal_id=animal.id, **data.model_dump())
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


@router.patch("/media/{media_id}", response_model=GuideMediaOut)
def update_media(
    media_id: int,
    data: GuideMediaIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> GuideMedia:
    media = db.get(GuideMedia, media_id)
    if not media:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(media, field, value)
    db.commit()
    db.refresh(media)
    return media


@router.delete("/media/{media_id}")
def delete_media(
    media_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    media = db.get(GuideMedia, media_id)
    if not media:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")
    db.delete(media)
    db.commit()


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
