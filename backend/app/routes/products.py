"""Shop — product catalog + admin CRUD."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_admin
from ..models import Product, User
from ..schemas import ProductIn, ProductOut

router = APIRouter(prefix="/products", tags=["products"])

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    return _SLUG_RE.sub("-", name.strip().lower()).strip("-") or "product"


@router.get("", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    category: str | None = None,
    q: str | None = None,
    animal_slug: str | None = None,
) -> list[Product]:
    query = db.query(Product).filter(Product.is_active == True)  # noqa: E712
    if category:
        query = query.filter(Product.category == category)
    if q:
        query = query.filter(Product.name.ilike(f"%{q}%"))
    results = query.order_by(Product.created_at.desc()).all()
    if animal_slug:
        results = [p for p in results if p.suitable_for and animal_slug in p.suitable_for]
    return results


@router.get("/{slug}", response_model=ProductOut)
def get_product(slug: str, db: Session = Depends(get_db)) -> Product:
    product = db.query(Product).filter(Product.slug == slug).first()
    if not product or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Product:
    slug = data.slug or _slugify(data.name)
    if db.query(Product).filter(Product.slug == slug).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Slug already exists")
    product = Product(**{**data.model_dump(), "slug": slug})
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    data: ProductIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    # Soft-delete — keeps order history intact.
    product.is_active = False
    db.commit()
