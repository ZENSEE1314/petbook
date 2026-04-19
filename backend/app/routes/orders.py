"""Checkout + order history. No real payment in MVP — status starts as 'pending'."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_admin
from ..models import Order, OrderItem, Product, User
from ..schemas import CheckoutIn, OrderItemOut, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])


def _to_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        user_id=order.user_id,
        total_cents=order.total_cents,
        status=order.status,
        shipping_name=order.shipping_name,
        shipping_address=order.shipping_address,
        shipping_phone=order.shipping_phone,
        items=[OrderItemOut.model_validate(i) for i in order.items],
        created_at=order.created_at,
    )


@router.post("/checkout", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def checkout(
    data: CheckoutIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrderOut:
    if not data.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart is empty")

    order = Order(
        user_id=user.id,
        total_cents=0,
        shipping_name=data.shipping_name,
        shipping_address=data.shipping_address,
        shipping_phone=data.shipping_phone,
    )
    db.add(order)
    db.flush()  # get order.id

    total = 0
    for line in data.items:
        product = db.get(Product, line.product_id)
        if not product or not product.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Product {line.product_id} unavailable")
        if product.stock < line.quantity:
            raise HTTPException(
                status.HTTP_409_CONFLICT, f"Not enough stock for {product.name}"
            )
        product.stock -= line.quantity
        item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            unit_price_cents=product.price_cents,
            quantity=line.quantity,
        )
        db.add(item)
        total += product.price_cents * line.quantity

    order.total_cents = total
    db.commit()
    db.refresh(order)
    return _to_out(order)


@router.get("", response_model=list[OrderOut])
def my_orders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[OrderOut]:
    orders = (
        db.query(Order)
        .filter(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_to_out(o) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrderOut:
    order = db.get(Order, order_id)
    if not order or (order.user_id != user.id and not user.is_admin):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return _to_out(order)


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: int,
    new_status: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> OrderOut:
    if new_status not in {"pending", "paid", "shipped", "cancelled"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid status")
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    order.status = new_status
    db.commit()
    db.refresh(order)
    return _to_out(order)
