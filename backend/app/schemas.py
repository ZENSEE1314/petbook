"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    display_name: str | None = None
    referred_by_code: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=200)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=200)


class PublicUserOut(BaseModel):
    id: int
    display_name: str | None
    avatar_url: str | None
    bio: str | None
    points: int
    level: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserPetIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    animal_id: int | None = None
    photo_url: str | None = None
    bio: str | None = None
    birth_date: datetime | None = None


class UserPetOut(BaseModel):
    id: int
    owner_id: int
    animal_id: int | None
    animal_slug: str | None = None
    animal_name: str | None = None
    name: str
    photo_url: str | None
    bio: str | None
    birth_date: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    display_name: str | None
    avatar_url: str | None
    bio: str | None
    is_active: bool
    is_admin: bool
    is_paid: bool
    paid_until: datetime | None
    points: int = 0
    referral_code: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdateIn(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None


# ---------- Animals + Guide ----------


class AnimalIn(BaseModel):
    name: str
    slug: str | None = None
    category: str | None = None
    short_description: str | None = None
    image_url: str | None = None
    parent_id: int | None = None


class AnimalOut(BaseModel):
    id: int
    slug: str
    name: str
    category: str | None
    short_description: str | None
    image_url: str | None
    parent_id: int | None = None
    parent_slug: str | None = None
    parent_name: str | None = None
    child_count: int = 0
    has_guide: bool = False

    class Config:
        from_attributes = True


class GuideEntryIn(BaseModel):
    story: str | None = None
    origin: str | None = None
    temperament: str | None = None
    colors: str | None = None
    lifespan_years: str | None = None
    lifespan_wild: str | None = None
    lifespan_pet: str | None = None
    weight_range: str | None = None
    length_range: str | None = None
    adult_size: str | None = None
    healthy_markers: str | None = None
    diet: str | None = None
    training: str | None = None
    housing: str | None = None
    common_issues: str | None = None
    age_stages: str | None = None
    sexing: str | None = None
    breeding_guide: str | None = None
    breeding_frequency: str | None = None
    litter_size: str | None = None
    weight_range_male: str | None = None
    weight_range_female: str | None = None
    length_range_male: str | None = None
    length_range_female: str | None = None
    colors_male: str | None = None
    colors_female: str | None = None
    diet_male: str | None = None
    diet_female: str | None = None
    foods_to_avoid: str | None = None
    sickness_signs: str | None = None
    recommended_product_ids: str | None = None
    is_published: bool = False


class GuideEntryOut(GuideEntryIn):
    id: int
    animal_id: int
    updated_at: datetime

    class Config:
        from_attributes = True


class GuideMediaIn(BaseModel):
    kind: str  # "video" | "audio" | "image"
    url: str
    title: str | None = None
    caption: str | None = None
    poster_url: str | None = None
    position: int = 0


class GuideMediaOut(BaseModel):
    id: int
    animal_id: int
    kind: str
    url: str
    title: str | None
    caption: str | None
    poster_url: str | None
    position: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Social ----------


class PostIn(BaseModel):
    caption: str = Field(min_length=1, max_length=4000)
    image_url: str | None = None
    animal_id: int | None = None


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class AuthorMini(BaseModel):
    id: int
    display_name: str | None
    avatar_url: str | None

    class Config:
        from_attributes = True


class CommentOut(BaseModel):
    id: int
    author: AuthorMini
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    author: AuthorMini
    animal_id: int | None
    caption: str
    image_url: str | None
    like_count: int
    comment_count: int
    liked_by_me: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Shop ----------


class ProductIn(BaseModel):
    name: str
    slug: str | None = None
    category: str | None = None
    description: str | None = None
    price_cents: int = Field(ge=0)
    stock: int = Field(ge=0, default=0)
    image_url: str | None = None
    suitable_for: str | None = None
    ship_local_cents: int = Field(ge=0, default=0)
    ship_overseas_cents: int = Field(ge=0, default=0)
    is_active: bool = True


class ProductOut(BaseModel):
    id: int
    slug: str
    name: str
    category: str | None
    description: str | None
    price_cents: int
    stock: int
    image_url: str | None
    suitable_for: str | None
    ship_local_cents: int
    ship_overseas_cents: int
    is_active: bool

    class Config:
        from_attributes = True


class CartLineIn(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=99)


class CheckoutIn(BaseModel):
    items: list[CartLineIn]
    shipping_name: str
    shipping_address: str
    shipping_phone: str | None = None
    ship_region: str = "local"  # "local" or "overseas"


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    unit_price_cents: int
    quantity: int

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    user_id: int
    buyer_email: str | None = None
    buyer_display_name: str | None = None
    total_cents: int
    shipping_cents: int = 0
    ship_region: str = "local"
    status: str
    shipping_name: str | None
    shipping_address: str | None
    shipping_phone: str | None
    items: list[OrderItemOut]
    created_at: datetime

    class Config:
        from_attributes = True


class CheckoutOut(BaseModel):
    order_id: int
    checkout_url: str | None = None  # set when Stripe is configured, null for dev stub
    order: OrderOut


# ---------- Listings ----------


class ListingIn(BaseModel):
    title: str
    description: str | None = None
    animal_id: int | None = None
    age_months: int | None = None
    price_cents: int = Field(ge=0)
    location: str | None = None
    contact: str | None = None
    image_url: str | None = None


class ListingOut(BaseModel):
    id: int
    seller_id: int
    seller_display_name: str | None
    animal_id: int | None
    title: str
    description: str | None
    age_months: int | None
    price_cents: int
    location: str | None
    contact: str | None
    image_url: str | None
    status: str
    created_at: datetime


# ---------- Subscription ----------


class SiteSettingsOut(BaseModel):
    site_name: str
    tagline: str | None = None
    logo_url: str | None = None
    favicon_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    theme_color: str = "#f97316"

    class Config:
        from_attributes = True


class SiteSettingsIn(BaseModel):
    site_name: str | None = None
    tagline: str | None = None
    logo_url: str | None = None
    favicon_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    theme_color: str | None = None


class SubscribeOut(BaseModel):
    checkout_url: str | None = None
    paid_until: datetime | None = None
    provider: str
