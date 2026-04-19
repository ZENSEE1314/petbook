"""Checkout + order history. Creates a Stripe Checkout Session when configured;
otherwise falls back to a dev stub that marks the order 'pending' with no payment."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user, require_admin
from ..models import Order, OrderItem, Product, User
from ..points import award, get_config
from ..schemas import CheckoutIn, CheckoutOut, OrderItemOut, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])


ALLOWED_STATUSES = {"pending", "paid", "ready_to_ship", "shipped", "delivered", "cancelled"}


def _to_out(order: Order, buyer: User | None = None) -> OrderOut:
    return OrderOut(
        id=order.id,
        user_id=order.user_id,
        buyer_email=buyer.email if buyer else None,
        buyer_display_name=buyer.display_name if buyer else None,
        total_cents=order.total_cents,
        status=order.status,
        shipping_name=order.shipping_name,
        shipping_address=order.shipping_address,
        shipping_phone=order.shipping_phone,
        items=[OrderItemOut.model_validate(i) for i in order.items],
        created_at=order.created_at,
    )


@router.post("/checkout", response_model=CheckoutOut, status_code=status.HTTP_201_CREATED)
def checkout(
    data: CheckoutIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CheckoutOut:
    if not data.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart is empty")
    region = data.ship_region if data.ship_region in {"local", "overseas"} else "local"

    order = Order(
        user_id=user.id,
        total_cents=0,
        ship_region=region,
        shipping_name=data.shipping_name,
        shipping_address=data.shipping_address,
        shipping_phone=data.shipping_phone,
    )
    db.add(order)
    db.flush()

    items_total = 0
    max_ship_cents = 0
    for line in data.items:
        product = db.get(Product, line.product_id)
        if not product or not product.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Product {line.product_id} unavailable")
        if product.stock < line.quantity:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Not enough stock for {product.name}")
        product.stock -= line.quantity
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                unit_price_cents=product.price_cents,
                quantity=line.quantity,
            )
        )
        items_total += product.price_cents * line.quantity
        per_item_ship = (
            product.ship_overseas_cents if region == "overseas" else product.ship_local_cents
        )
        if per_item_ship > max_ship_cents:
            max_ship_cents = per_item_ship

    order.shipping_cents = max_ship_cents
    order.total_cents = items_total + max_ship_cents
    db.commit()
    db.refresh(order)

    checkout_url = _create_stripe_order_session(order, user, request)
    return CheckoutOut(order_id=order.id, checkout_url=checkout_url, order=_to_out(order, user))


def _create_stripe_order_session(order: Order, user: User, request: Request) -> str | None:
    if not settings.stripe_secret_key:
        return None
    try:
        import stripe  # type: ignore
    except ImportError:
        return None

    stripe.api_key = settings.stripe_secret_key
    base_url = str(request.base_url).rstrip("/")
    line_items = [
        {
            "price_data": {
                "currency": "usd",
                "product_data": {"name": item.product_name},
                "unit_amount": item.unit_price_cents,
            },
            "quantity": item.quantity,
        }
        for item in order.items
    ]
    if order.shipping_cents > 0:
        line_items.append(
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"Shipping ({order.ship_region})"},
                    "unit_amount": order.shipping_cents,
                },
                "quantity": 1,
            }
        )
    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=line_items,
        customer_email=user.email,
        metadata={"order_id": str(order.id)},
        success_url=f"{base_url}/orders/{order.id}?paid=1",
        cancel_url=f"{base_url}/cart?cancelled=1",
    )
    return session.url


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
    return [_to_out(o, user) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrderOut:
    order = db.get(Order, order_id)
    if not order or (order.user_id != user.id and not user.is_admin):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    buyer = db.get(User, order.user_id)
    return _to_out(order, buyer)


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: int,
    new_status: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> OrderOut:
    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Status must be one of {sorted(ALLOWED_STATUSES)}")
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    was_paid = order.status == "paid"
    order.status = new_status
    db.commit()
    db.refresh(order)
    buyer = db.get(User, order.user_id)
    # Award points the first time an order transitions to paid (admin-flip or webhook).
    if new_status == "paid" and not was_paid:
        cfg = get_config(db)
        dollars = order.total_cents // 100
        award(db, buyer, "order_paid", dollars * cfg.order_per_dollar,
              ref_type="order", ref_id=order.id,
              note=f"${dollars} order")
    return _to_out(order, buyer)
