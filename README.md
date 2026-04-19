# Petbook

A social network + care guide + marketplace for pet owners.

## What's in it

- **Social feed**: post pet photos, like, comment. Free for all registered users.
- **Pet guide** (paid, $10/yr): detailed care guides per species — diet, training, housing, health markers by age & size. Products referenced in the guide link straight to the shop.
- **Shop**: food, toys, cages, accessories. Open to everyone, no subscription required.
- **Pet listings**: rehome/sell pets. Browsing is free; only paid members can list.
- **Admin**: manage users, add/edit animals and guide entries, generate a guide draft via LLM, manage products.

## Stack

- **Backend**: FastAPI + SQLAlchemy + SQLite (swap to Postgres in prod)
- **Frontend**: React + Vite + TypeScript + Tailwind
- **Auth**: JWT, bcrypt password hashes
- **Payments**: Stripe (stubbed in dev — see `backend/app/routes/subscription.py`)
- **AI guide drafts**: Anthropic Messages API if `ANTHROPIC_API_KEY` is set, otherwise a canned template that admin edits

## Run locally

```bash
# Backend
cd backend
python -m venv .venv && source .venv/Scripts/activate   # Git Bash on Windows
pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:8000`. The Vite dev server proxies `/api` to the backend.

## First admin

On first run, the user registered with the email in `FIRST_ADMIN_EMAIL` (env var) is promoted to admin automatically. Default is `admin@petbook.local`.

## Seeding

```bash
cd backend
python -m app.seed
```

Seeds 21 common species (dog, cat, hamster, parrot, sugar glider, etc.) with stub guide entries ready for admin editing. In production this runs automatically on the first boot — see `AUTO_SEED`.

## Deploying

See [DEPLOY.md](./DEPLOY.md) for step-by-step Railway setup (Postgres, volume for uploads, env vars).
