"""FastAPI entrypoint — wires up routers, static files, CORS, and DB bootstrapping."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db import Base, engine
from .routes import admin, animals, auth, listings, orders, posts, products, subscription, uploads

app = FastAPI(title="Petbook API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup. For production, switch to Alembic migrations.
Base.metadata.create_all(engine)

STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
(STATIC_DIR / "uploads").mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

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
):
    app.include_router(router, prefix=API_PREFIX)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
