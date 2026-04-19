"""Paid membership.

If STRIPE_SECRET_KEY + STRIPE_PRICE_ID are set, returns a real Checkout Session URL.
Otherwise we use a dev stub that flips is_paid immediately — handy for local testing.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import SubscriptionPayment, User
from ..schemas import SubscribeOut

router = APIRouter(prefix="/subscription", tags=["subscription"])


def _grant_membership(user: User, db: Session, provider: str, provider_ref: str | None) -> None:
    now = datetime.now(timezone.utc)
    base = user.paid_until if user.is_paid and user.paid_until and user.paid_until > now else now
    user.paid_until = base + timedelta(days=settings.subscription_period_days)
    user.is_paid = True
    db.add(
        SubscriptionPayment(
            user_id=user.id,
            amount_cents=settings.subscription_price_cents,
            period_days=settings.subscription_period_days,
            provider=provider,
            provider_ref=provider_ref,
        )
    )
    db.commit()


@router.post("/subscribe", response_model=SubscribeOut)
def subscribe(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubscribeOut:
    # Dev stub — no Stripe configured
    if not (settings.stripe_secret_key and settings.stripe_price_id):
        _grant_membership(user, db, provider="stub", provider_ref=None)
        return SubscribeOut(
            checkout_url=None,
            paid_until=user.paid_until,
            provider="stub",
        )

    # Real Stripe Checkout
    try:
        import stripe  # type: ignore
    except ImportError:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "stripe not installed")
    stripe.api_key = settings.stripe_secret_key

    base_url = str(request.base_url).rstrip("/")
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        customer_email=user.email,
        client_reference_id=str(user.id),
        success_url=f"{base_url}/api/subscription/stripe-return?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base_url}/subscribe?cancelled=1",
    )
    return SubscribeOut(checkout_url=session.url, paid_until=None, provider="stripe")


@router.post("/stripe-webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    if not settings.stripe_webhook_secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Webhook not configured")
    try:
        import stripe  # type: ignore
    except ImportError:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "stripe not installed")

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid signature: {exc}")

    if event["type"] in ("checkout.session.completed", "invoice.paid"):
        obj = event["data"]["object"]
        user_id_raw = obj.get("client_reference_id") or obj.get("metadata", {}).get("user_id")
        if user_id_raw:
            user = db.get(User, int(user_id_raw))
            if user:
                _grant_membership(user, db, provider="stripe", provider_ref=obj.get("id"))
    return {"received": True}
