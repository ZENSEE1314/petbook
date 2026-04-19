# Deploying Petbook to Railway

One Railway service serves both the FastAPI API and the built React SPA. A Postgres
plugin handles the database; an optional volume persists uploaded images.

## 1. Create the project

1. Go to [railway.com/new](https://railway.com/new) → **Deploy from GitHub repo**.
2. Pick `ZENSEE1314/petbook`. Railway auto-detects Nixpacks and uses `nixpacks.toml`
   + `railway.json` from the repo root.
3. Wait for the first deploy to finish. It will fail until the database is attached —
   that's expected. Continue.

## 2. Add Postgres

1. In the project, click **+ Create** → **Database** → **Add PostgreSQL**.
2. Open your web service → **Variables** → **Add variable** → **Reference** →
   pick `Postgres.DATABASE_URL`.
3. Railway redeploys. On boot, FastAPI:
   - Creates all tables via SQLAlchemy `create_all`
   - Runs the seed (21 species + 6 demo products) because `AUTO_SEED=true`

## 3. Add required environment variables

On the web service → **Variables**, add:

| Variable | Value |
|---|---|
| `JWT_SECRET` | a long random string — `openssl rand -hex 32` |
| `FIRST_ADMIN_EMAIL` | the email you'll register with to get auto-admin rights |
| `CORS_ORIGINS` | your Railway domain (e.g. `https://petbook-production.up.railway.app`) — or `*` to allow all |

Optional:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | real LLM-generated guide drafts (otherwise a canned template) |
| `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` + `STRIPE_WEBHOOK_SECRET` | real Stripe Checkout (otherwise the "Upgrade" button flips `is_paid` instantly — dev stub) |
| `AUTO_SEED` | `false` to skip seeding (e.g. on a second deploy) |

## 4. Persist uploaded images (optional but recommended)

Railway container filesystems are ephemeral — uploaded images vanish on redeploy.

1. Web service → **Settings** → **Volumes** → **+ Volume**.
2. **Mount path**: `/data`.
3. **Variables** → add `UPLOAD_DIR=/data/uploads`.
4. Redeploy. Uploads now go to the volume and are served at `/uploads/...`.

Skip this step if you're fine losing uploads between deploys (acceptable for demo).

## 5. Get the URL and log in

1. Web service → **Settings** → **Networking** → **Generate Domain**.
2. Open the domain. Register with the email you set in `FIRST_ADMIN_EMAIL` — you'll
   be auto-promoted to admin.
3. Visit `/admin` to edit guides, generate drafts with the AI button, add products, etc.

## 6. Stripe webhook (only if using real Stripe)

1. In Stripe → **Developers → Webhooks → Add endpoint**
   → `https://<your-railway-domain>/api/subscription/stripe-webhook`.
2. Subscribe to `checkout.session.completed` and `invoice.paid`.
3. Copy the signing secret into Railway as `STRIPE_WEBHOOK_SECRET`.

## Troubleshooting

- **Build fails with "No module named psycopg2"**: make sure you pulled the latest
  `requirements.txt` — it includes `psycopg2-binary`.
- **`postgres://` URL rejected by SQLAlchemy**: handled automatically — the config
  normalizes `postgres://` → `postgresql+psycopg2://`.
- **Frontend 503 / "Frontend not built"**: the Nixpacks build step failed to copy
  `frontend/dist/`. Check build logs for npm errors.
- **Images disappear after redeploy**: attach a Railway volume and set `UPLOAD_DIR`.
- **`FIRST_ADMIN_EMAIL` not working**: admin is only assigned at *registration*.
  If you already registered, use Railway's shell to flip the flag:
  ```sql
  UPDATE users SET is_admin = true WHERE email = 'you@example.com';
  ```
