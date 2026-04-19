"""Public user profiles + per-user pet CRUD."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import Animal, User, UserPet
from ..points import get_config, level_for
from ..schemas import PublicUserOut, UserPetIn, UserPetOut

router = APIRouter(prefix="/users", tags=["users"])


def _pet_to_out(pet: UserPet, animal: Animal | None) -> UserPetOut:
    return UserPetOut(
        id=pet.id,
        owner_id=pet.owner_id,
        animal_id=pet.animal_id,
        animal_slug=animal.slug if animal else None,
        animal_name=animal.name if animal else None,
        name=pet.name,
        photo_url=pet.photo_url,
        bio=pet.bio,
        birth_date=pet.birth_date,
        created_at=pet.created_at,
    )


def _list_pets(user_id: int, db: Session) -> list[UserPetOut]:
    pets = (
        db.query(UserPet)
        .filter(UserPet.owner_id == user_id)
        .order_by(UserPet.created_at.desc())
        .all()
    )
    animal_ids = {p.animal_id for p in pets if p.animal_id is not None}
    animals = (
        {a.id: a for a in db.query(Animal).filter(Animal.id.in_(animal_ids)).all()}
        if animal_ids
        else {}
    )
    return [_pet_to_out(p, animals.get(p.animal_id) if p.animal_id else None) for p in pets]


# ---------- Owner-only ("me") routes — declared BEFORE /{user_id} so they match first ----------


@router.get("/me/pets", response_model=list[UserPetOut])
def my_pets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[UserPetOut]:
    return _list_pets(user.id, db)


@router.post("/me/pets", response_model=UserPetOut, status_code=status.HTTP_201_CREATED)
def create_pet(
    data: UserPetIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPetOut:
    pet = UserPet(owner_id=user.id, **data.model_dump())
    db.add(pet)
    db.commit()
    db.refresh(pet)
    animal = db.get(Animal, pet.animal_id) if pet.animal_id else None
    return _pet_to_out(pet, animal)


@router.patch("/me/pets/{pet_id}", response_model=UserPetOut)
def update_pet(
    pet_id: int,
    data: UserPetIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPetOut:
    pet = db.get(UserPet, pet_id)
    if not pet:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pet not found")
    if pet.owner_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your pet")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pet, field, value)
    db.commit()
    db.refresh(pet)
    animal = db.get(Animal, pet.animal_id) if pet.animal_id else None
    return _pet_to_out(pet, animal)


@router.delete("/me/pets/{pet_id}")
def delete_pet(
    pet_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    pet = db.get(UserPet, pet_id)
    if not pet:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pet not found")
    if pet.owner_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your pet")
    db.delete(pet)
    db.commit()


# ---------- Public routes ----------


@router.get("/{user_id}", response_model=PublicUserOut)
def get_user(user_id: int, db: Session = Depends(get_db)) -> PublicUserOut:
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    cfg = get_config(db)
    return PublicUserOut(
        id=user.id,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        points=user.points or 0,
        level=level_for(user.points or 0, cfg.level_thresholds),
        created_at=user.created_at,
    )


@router.get("/{user_id}/pets", response_model=list[UserPetOut])
def list_user_pets(user_id: int, db: Session = Depends(get_db)) -> list[UserPetOut]:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _list_pets(user_id, db)
