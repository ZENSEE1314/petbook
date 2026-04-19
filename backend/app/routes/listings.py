"""Pet marketplace listings. Browsing is open; creating requires paid membership."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_paid
from ..models import Listing, User
from ..schemas import ListingIn, ListingOut

router = APIRouter(prefix="/listings", tags=["listings"])


def _to_out(listing: Listing, seller: User | None) -> ListingOut:
    return ListingOut(
        id=listing.id,
        seller_id=listing.seller_id,
        seller_display_name=seller.display_name if seller else None,
        animal_id=listing.animal_id,
        title=listing.title,
        description=listing.description,
        age_months=listing.age_months,
        price_cents=listing.price_cents,
        location=listing.location,
        contact=listing.contact,
        image_url=listing.image_url,
        status=listing.status,
        created_at=listing.created_at,
    )


@router.get("", response_model=list[ListingOut])
def list_listings(
    db: Session = Depends(get_db),
    animal_id: int | None = None,
    q: str | None = None,
) -> list[ListingOut]:
    query = db.query(Listing).filter(Listing.status == "active")
    if animal_id is not None:
        query = query.filter(Listing.animal_id == animal_id)
    if q:
        query = query.filter(Listing.title.ilike(f"%{q}%"))
    listings = query.order_by(Listing.created_at.desc()).all()
    seller_ids = {l.seller_id for l in listings}
    sellers = {u.id: u for u in db.query(User).filter(User.id.in_(seller_ids)).all()} if seller_ids else {}
    return [_to_out(l, sellers.get(l.seller_id)) for l in listings]


@router.get("/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: int, db: Session = Depends(get_db)) -> ListingOut:
    listing = db.get(Listing, listing_id)
    if not listing or listing.status == "removed":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    seller = db.get(User, listing.seller_id)
    return _to_out(listing, seller)


@router.post("", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(
    data: ListingIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_paid),
) -> ListingOut:
    listing = Listing(seller_id=user.id, **data.model_dump())
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return _to_out(listing, user)


@router.patch("/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int,
    data: ListingIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ListingOut:
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    if listing.seller_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your listing")
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(listing, field, value)
    db.commit()
    db.refresh(listing)
    seller = db.get(User, listing.seller_id)
    return _to_out(listing, seller)


@router.post("/{listing_id}/mark-sold", response_model=ListingOut)
def mark_sold(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ListingOut:
    listing = db.get(Listing, listing_id)
    if not listing or (listing.seller_id != user.id and not user.is_admin):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    listing.status = "sold"
    db.commit()
    db.refresh(listing)
    return _to_out(listing, db.get(User, listing.seller_id))


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    if listing.seller_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your listing")
    listing.status = "removed"
    db.commit()
