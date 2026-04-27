"""Admin-only endpoints — user management, AI-assisted animal tools."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
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


@router.delete("/users/{user_id}")
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


@router.post("/animals/{animal_id}/generate-guide")
def ai_generate_guide(
    animal_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    result = generate_guide_draft(animal.name)
    guide = animal.guide or GuideEntry(animal_id=animal.id)
    for field in (
        "story", "origin", "temperament", "colors",
        "lifespan_years", "weight_range", "length_range", "adult_size",
        "healthy_markers", "diet", "training", "housing", "common_issues", "age_stages",
        "sexing", "breeding_guide", "breeding_frequency", "litter_size",
        "weight_range_male", "weight_range_female",
        "length_range_male", "length_range_female",
        "colors_male", "colors_female",
        "diet_male", "diet_female",
        "foods_to_avoid", "sickness_signs",
        "lifespan_wild", "lifespan_pet",
    ):
        if field in result.data:
            setattr(guide, field, result.data[field])
    if not animal.guide:
        db.add(guide)
    db.commit()
    db.refresh(guide)

    # Response includes the guide plus a meta block so the admin UI can show which
    # backend filled it and surface the failure reason if Ollama/Anthropic fell back.
    body = GuideEntryOut.model_validate(guide).model_dump(mode="json")
    body["_ai"] = {"source": result.source, "error": result.error}
    return JSONResponse(body)


@router.post("/animals/auto-group")
def auto_group_animals(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    """Create one top-level parent per existing category and re-parent every
    standalone animal under it. Idempotent: re-running won't duplicate parents.
    Doesn't touch animals that already have a parent or animals that are
    themselves parents."""

    # Title-case display names for each known category code.
    category_labels: dict[str, str] = {
        "mammal": "Mammals",
        "bird": "Birds",
        "reptile": "Reptiles",
        "amphibian": "Amphibians",
        "fish": "Fish",
        "invertebrate": "Invertebrates",
    }

    created_parents: dict[str, Animal] = {}
    moved = 0

    # Animals that already have children (i.e. are parents) — never touch them.
    parents_q = db.query(Animal.parent_id).filter(Animal.parent_id.isnot(None)).distinct()
    parent_ids_in_use = {row[0] for row in parents_q.all()}

    candidates = (
        db.query(Animal)
        .filter(Animal.parent_id.is_(None))
        .filter(~Animal.id.in_(parent_ids_in_use))
        .filter(Animal.category.isnot(None))
        .all()
    )

    for animal in candidates:
        cat = (animal.category or "").lower()
        label = category_labels.get(cat, cat.title())
        slug = f"{cat}s" if not cat.endswith("s") else cat

        # Don't make a parent for a single-item category — feels silly.
        same_cat = [a for a in candidates if (a.category or "").lower() == cat]
        if len(same_cat) < 2:
            continue

        parent = created_parents.get(cat)
        if parent is None:
            parent = db.query(Animal).filter(Animal.slug == slug).first()
            if not parent:
                parent = Animal(
                    slug=slug,
                    name=label,
                    category=cat,
                    short_description=f"All {label.lower()} kept as pets.",
                )
                db.add(parent)
                db.flush()
            created_parents[cat] = parent

        if animal.id == parent.id:
            continue
        animal.parent_id = parent.id
        moved += 1

    db.commit()
    return {
        "ok": True,
        "moved": moved,
        "groups": [
            {"slug": p.slug, "name": p.name, "category": p.category}
            for p in created_parents.values()
        ],
    }


@router.post("/animals/suggest")
def ai_suggest_animals(
    data: SuggestIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    existing = [a.name for a in db.query(Animal).all()]
    result = suggest_more_animals(count=data.count, exclude_names=existing)
    return {"source": result.source, "error": result.error, "animals": result.data}


# ---------- Orders oversight ----------


@router.get("/orders", response_model=list[OrderOut])
def all_orders(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[OrderOut]:
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    from .orders import _to_out  # local import to avoid circular at module load
    buyer_ids = {o.user_id for o in orders}
    buyers = {u.id: u for u in db.query(User).filter(User.id.in_(buyer_ids)).all()} if buyer_ids else {}
    return [_to_out(o, buyers.get(o.user_id)) for o in orders]
