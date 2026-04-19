"""FastAPI entrypoint — wires routers, static files, CORS, serves the frontend build."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text

from .config import settings
from .db import Base, SessionLocal, engine
from .models import Animal
from .routes import admin, animals, auth, listings, orders, posts, products, site, subscription, uploads

# Columns added to guide_entries after the first deploy. Running `ALTER TABLE ... ADD COLUMN
# IF NOT EXISTS` on startup lets existing Postgres rows pick up the richer guide schema
# without needing Alembic for this MVP.
_SCHEMA_ADDITIONS: list[tuple[str, str, str]] = [
    # Richer pet guide
    ("guide_entries", "story", "TEXT"),
    ("guide_entries", "origin", "VARCHAR(200)"),
    ("guide_entries", "temperament", "TEXT"),
    ("guide_entries", "colors", "TEXT"),
    ("guide_entries", "weight_range", "VARCHAR(80)"),
    ("guide_entries", "length_range", "VARCHAR(80)"),
    # Per-product shipping fee
    ("products", "ship_local_cents", "INTEGER NOT NULL DEFAULT 0"),
    ("products", "ship_overseas_cents", "INTEGER NOT NULL DEFAULT 0"),
    # Order shipping breakdown
    ("orders", "shipping_cents", "INTEGER NOT NULL DEFAULT 0"),
    ("orders", "ship_region", "VARCHAR(20) NOT NULL DEFAULT 'local'"),
    # Breeding guide fields
    ("guide_entries", "sexing", "TEXT"),
    ("guide_entries", "breeding_guide", "TEXT"),
    ("guide_entries", "breeding_frequency", "VARCHAR(120)"),
    ("guide_entries", "litter_size", "VARCHAR(120)"),
]


def _inline_migrations() -> None:
    if not engine.url.get_backend_name().startswith("postgres"):
        return
    with engine.begin() as conn:
        for table, col, ddl in _SCHEMA_ADDITIONS:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {ddl}"))

app = FastAPI(title="Petbook API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Auto-create tables. In prod, graduate to Alembic migrations.
    Base.metadata.create_all(engine)

    # Fill in columns added after the original schema.
    _inline_migrations()

    # One-time seed when the animals table is empty. Keeps "fresh deploy" usable.
    if settings.auto_seed:
        with SessionLocal() as db:
            if db.query(Animal).count() == 0:
                from . import seed
                seed.run()


# ---------- Static files ----------

BACKEND_DIR = Path(__file__).resolve().parent
STATIC_DIR = BACKEND_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)
(STATIC_DIR / "uploads").mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# When UPLOAD_DIR points at a volume, expose it at /uploads.
if settings.upload_dir:
    upload_root = Path(settings.upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=upload_root), name="uploads")


# ---------- API routes ----------

API_PREFIX = "/api"
for router in (
    auth.router,
    animals.router,
    posts.router,
    products.router,
    orders.router,
    listings.router,
    subscription.router,
    admin.router,
    uploads.router,
    site.router,
):
    app.include_router(router, prefix=API_PREFIX)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------- Frontend (Vite build) ----------

WEB_DIR = STATIC_DIR / "web"
WEB_INDEX = WEB_DIR / "index.html"

if WEB_DIR.exists() and (WEB_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIR / "assets"), name="web-assets")


@app.get("/{full_path:path}", include_in_schema=False)
def spa_catch_all(request: Request, full_path: str) -> Response:
    """Serve the Vite SPA for any non-API path. Returns 404 for /api/* and /static/*."""
    if full_path.startswith(("api/", "static/", "uploads/", "assets/")):
        raise HTTPException(status_code=404)

    # Prefer exact file matches in the built frontend (favicon.svg, robots.txt, etc.).
    if full_path:
        candidate = WEB_DIR / full_path
        if candidate.is_file():
            return FileResponse(candidate)

    if WEB_INDEX.exists():
        # Don't cache the shell — assets are hashed, but index.html must always be fresh.
        return FileResponse(WEB_INDEX, headers={"Cache-Control": "no-store"})

    return Response(
        "Frontend not built. Run `cd frontend && npm run build` and copy dist to backend/app/static/web/.",
        status_code=503,
    )
