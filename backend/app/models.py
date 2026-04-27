"""SQLAlchemy ORM models for Petbook."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120))
    avatar_url: Mapped[str | None] = mapped_column(String(400))
    bio: Mapped[str | None] = mapped_column(String(500))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Paid membership — unlocks pet guide + ability to list pets.
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), index=True)

    # Points / referrals (updated via PointsEvent ledger; this column is the running balance cache).
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    referral_code: Mapped[str | None] = mapped_column(String(16), unique=True, index=True)
    referred_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Animal(Base):
    """A species or family — e.g. 'Snake' (parent) → 'Ball Python' (child)."""

    __tablename__ = "animals"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str | None] = mapped_column(String(40), index=True)  # mammal, bird, reptile, ...
    short_description: Mapped[str | None] = mapped_column(String(400))
    image_url: Mapped[str | None] = mapped_column(String(400))
    # Self-referential — parent group (e.g. "Snake"). NULL means top-level.
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("animals.id", ondelete="SET NULL"), index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    guide: Mapped["GuideEntry | None"] = relationship(
        back_populates="animal", cascade="all, delete-orphan", uselist=False
    )


class GuideEntry(Base):
    """Care guide for a single species. Gated behind is_paid."""

    __tablename__ = "guide_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    animal_id: Mapped[int] = mapped_column(
        ForeignKey("animals.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Overview
    story: Mapped[str | None] = mapped_column(Text)                     # long-form intro, history, character
    origin: Mapped[str | None] = mapped_column(String(200))             # native region / breed origin
    temperament: Mapped[str | None] = mapped_column(Text)               # personality, social needs
    colors: Mapped[str | None] = mapped_column(Text)                    # common colour variations

    # Size & lifespan
    lifespan_years: Mapped[str | None] = mapped_column(String(60))      # general / fallback
    lifespan_wild: Mapped[str | None] = mapped_column(String(60))       # lifespan in the wild
    lifespan_pet: Mapped[str | None] = mapped_column(String(60))        # lifespan as a home pet
    weight_range: Mapped[str | None] = mapped_column(String(80))        # "2-4 kg"
    length_range: Mapped[str | None] = mapped_column(String(80))        # "30-40 cm"
    adult_size: Mapped[str | None] = mapped_column(String(200))         # freeform summary

    # Care
    healthy_markers: Mapped[str | None] = mapped_column(Text)           # signs of good health
    diet: Mapped[str | None] = mapped_column(Text)
    training: Mapped[str | None] = mapped_column(Text)
    housing: Mapped[str | None] = mapped_column(Text)                   # cage, enclosure, space needs
    common_issues: Mapped[str | None] = mapped_column(Text)

    # Birth-to-adult journey — JSON array: [{stage, age_range, size, feeding, milestones, notes}]
    age_stages: Mapped[str | None] = mapped_column(Text)

    # Breeding
    sexing: Mapped[str | None] = mapped_column(Text)              # how to tell male vs female
    breeding_guide: Mapped[str | None] = mapped_column(Text)      # pairing, environment, timing
    breeding_frequency: Mapped[str | None] = mapped_column(String(120))  # e.g. "2-3 times per year"
    litter_size: Mapped[str | None] = mapped_column(String(120))         # e.g. "3-6 babies per litter"

    # Male / female specific detail (fall back to the general fields above when blank)
    weight_range_male: Mapped[str | None] = mapped_column(String(120))
    weight_range_female: Mapped[str | None] = mapped_column(String(120))
    length_range_male: Mapped[str | None] = mapped_column(String(120))
    length_range_female: Mapped[str | None] = mapped_column(String(120))
    colors_male: Mapped[str | None] = mapped_column(Text)
    colors_female: Mapped[str | None] = mapped_column(Text)
    diet_male: Mapped[str | None] = mapped_column(Text)
    diet_female: Mapped[str | None] = mapped_column(Text)

    # Safety
    foods_to_avoid: Mapped[str | None] = mapped_column(Text)   # what NOT to feed
    sickness_signs: Mapped[str | None] = mapped_column(Text)   # warning signs of illness

    # Shop integration — JSON list of product ids that pair with this guide
    recommended_product_ids: Mapped[str | None] = mapped_column(Text)

    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    animal: Mapped[Animal] = relationship(back_populates="guide")


class GuideMedia(Base):
    """Video / audio / image attached to an animal's care guide (e.g. training tutorials)."""

    __tablename__ = "guide_media"

    id: Mapped[int] = mapped_column(primary_key=True)
    animal_id: Mapped[int] = mapped_column(
        ForeignKey("animals.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # video / audio / image
    url: Mapped[str] = mapped_column(String(400), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    caption: Mapped[str | None] = mapped_column(Text)
    poster_url: Mapped[str | None] = mapped_column(String(400))  # optional poster for video
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ---------- Social ----------


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    animal_id: Mapped[int | None] = mapped_column(
        ForeignKey("animals.id", ondelete="SET NULL"), index=True
    )
    caption: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(400))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    author: Mapped[User] = relationship(foreign_keys=[author_id])
    likes: Mapped[list["Like"]] = relationship(cascade="all, delete-orphan", back_populates="post")
    comments: Mapped[list["Comment"]] = relationship(
        cascade="all, delete-orphan", back_populates="post", order_by="Comment.created_at"
    )


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_like_post_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    post: Mapped[Post] = relationship(back_populates="likes")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(String(2000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    post: Mapped[Post] = relationship(back_populates="comments")


# ---------- Shop ----------


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(40), index=True)  # food, toy, cage, accessory
    description: Mapped[str | None] = mapped_column(Text)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(400))
    # Which animals this product is suitable for — JSON list of animal slugs.
    suitable_for: Mapped[str | None] = mapped_column(Text)
    # Per-product shipping fee — order shipping is the MAX across items in the cart,
    # using whichever column matches the buyer-selected region at checkout.
    ship_local_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ship_overseas_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)   # items + shipping
    shipping_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ship_region: Mapped[str] = mapped_column(String(20), default="local", nullable=False)  # local/overseas
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # pending/paid/ready_to_ship/shipped/delivered/cancelled
    shipping_name: Mapped[str | None] = mapped_column(String(120))
    shipping_address: Mapped[str | None] = mapped_column(Text)
    shipping_phone: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    items: Mapped[list["OrderItem"]] = relationship(
        cascade="all, delete-orphan", back_populates="order"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    order: Mapped[Order] = relationship(back_populates="items")


# ---------- Pet listings (marketplace) ----------


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    animal_id: Mapped[int | None] = mapped_column(
        ForeignKey("animals.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    age_months: Mapped[int | None] = mapped_column(Integer)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    location: Mapped[str | None] = mapped_column(String(160))
    contact: Mapped[str | None] = mapped_column(String(200))  # phone or email seller wants shared
    image_url: Mapped[str | None] = mapped_column(String(400))
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active/sold/removed
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


# ---------- Subscription payments ----------


class PasswordReset(Base):
    """Time-limited one-shot token used in the forgot-password flow."""

    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class UserPet(Base):
    """A pet that a user owns — name, species, photo, bio. Shown on their public profile."""

    __tablename__ = "user_pets"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    animal_id: Mapped[int | None] = mapped_column(
        ForeignKey("animals.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(400))
    bio: Mapped[str | None] = mapped_column(Text)
    birth_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PointsConfig(Base):
    """Singleton row (id=1). Admin-editable values used when awarding points."""

    __tablename__ = "points_config"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Per-action point awards. Admins can tune these live.
    post_created: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    post_liked: Mapped[int] = mapped_column(Integer, default=2, nullable=False)  # awarded to post author
    comment_created: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    listing_created: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    listing_sold: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    order_per_dollar: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # on paid
    referral_signup: Mapped[int] = mapped_column(Integer, default=50, nullable=False)  # to referrer
    referral_joiner_bonus: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    review_created: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    answer_created: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    answer_accepted: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    # JSON array of cumulative point thresholds per level. Level 1 starts at index 0.
    # e.g. [0, 50, 200, 500, 1500, 5000]
    level_thresholds: Mapped[str] = mapped_column(
        Text, default="[0,50,200,500,1500,5000,15000]", nullable=False
    )


class PointsEvent(Base):
    """Append-only ledger of point awards. user.points is the cached running total."""

    __tablename__ = "points_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    ref_type: Mapped[str | None] = mapped_column(String(20))  # post / order / listing / referral / review / answer
    ref_id: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class GuideReview(Base):
    """Stars + written remark on an animal's care guide."""

    __tablename__ = "guide_reviews"
    __table_args__ = (UniqueConstraint("animal_id", "user_id", name="uq_review_animal_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    animal_id: Mapped[int] = mapped_column(
        ForeignKey("animals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stars: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..5
    body: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class GuideQuestion(Base):
    """Forum question attached to an animal guide."""

    __tablename__ = "guide_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    animal_id: Mapped[int] = mapped_column(
        ForeignKey("animals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    accepted_answer_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class GuideAnswer(Base):
    """Answer to a GuideQuestion."""

    __tablename__ = "guide_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("guide_questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SiteSettings(Base):
    """Singleton row (id=1) holding admin-editable site-wide branding + SEO."""

    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    site_name: Mapped[str] = mapped_column(String(80), default="Petbook", nullable=False)
    tagline: Mapped[str | None] = mapped_column(String(200))
    logo_url: Mapped[str | None] = mapped_column(String(400))
    favicon_url: Mapped[str | None] = mapped_column(String(400))
    meta_title: Mapped[str | None] = mapped_column(String(200))
    meta_description: Mapped[str | None] = mapped_column(String(400))
    theme_color: Mapped[str] = mapped_column(String(16), default="#f97316", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SubscriptionPayment(Base):
    __tablename__ = "subscription_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    period_days: Mapped[int] = mapped_column(Integer, nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # stripe / stub
    provider_ref: Mapped[str | None] = mapped_column(String(120), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
