"""Guide reviews — stars + optional written remark, one per user per animal."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import Animal, GuideReview, User
from ..points import award, get_config

router = APIRouter(prefix="/animals", tags=["reviews"])


class ReviewIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    body: str | None = None


class ReviewOut(BaseModel):
    id: int
    animal_id: int
    user_id: int
    author_name: str | None
    stars: int
    body: str | None
    created_at: str


class ReviewSummary(BaseModel):
    average: float
    count: int
    my_review_id: int | None = None


def _to_out(r: GuideReview, author: User | None) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        animal_id=r.animal_id,
        user_id=r.user_id,
        author_name=(author.display_name if author else None) or (author.email if author else None),
        stars=r.stars,
        body=r.body,
        created_at=r.created_at.isoformat(),
    )


@router.get("/{slug}/reviews")
def list_reviews(
    slug: str,
    db: Session = Depends(get_db),
    current: User | None = Depends(
        lambda: None  # no auth required — public. Currents used for my_review_id below.
    ),
):
    animal = db.query(Animal).filter(Animal.slug == slug).first()
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    rows = (
        db.query(GuideReview)
        .filter(GuideReview.animal_id == animal.id)
        .order_by(GuideReview.created_at.desc())
        .all()
    )
    authors = {u.id: u for u in db.query(User).filter(User.id.in_({r.user_id for r in rows})).all()} if rows else {}
    avg = db.query(func.avg(GuideReview.stars)).filter(GuideReview.animal_id == animal.id).scalar() or 0
    return {
        "summary": {"average": round(float(avg), 2), "count": len(rows)},
        "reviews": [_to_out(r, authors.get(r.user_id)) for r in rows],
    }


@router.post("/{animal_id}/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    animal_id: int,
    data: ReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReviewOut:
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    existing = (
        db.query(GuideReview)
        .filter(GuideReview.animal_id == animal_id, GuideReview.user_id == user.id)
        .first()
    )
    if existing:
        existing.stars = data.stars
        existing.body = data.body
        db.commit()
        db.refresh(existing)
        return _to_out(existing, user)

    review = GuideReview(
        animal_id=animal_id, user_id=user.id, stars=data.stars, body=data.body
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    cfg = get_config(db)
    award(db, user, "review_created", cfg.review_created, ref_type="review", ref_id=review.id,
          note=f"Review for {animal.name}")
    return _to_out(review, user)


@router.delete("/reviews/{review_id}")
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    review = db.get(GuideReview, review_id)
    if not review:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.user_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your review")
    db.delete(review)
    db.commit()
