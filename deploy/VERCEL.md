# Deploy all Phygital services on Vercel (3 separate projects)

Mirror the Render `render.yaml` layout with **three Vercel projects** from the same GitHub repo.

| Render service | Vercel project | Root Directory |
|----------------|----------------|----------------|
| `phygital8thwall-api` | `phygital-api` | `server` |
| `phygital8thwall-client` | `phygital-client` | `client` |
| `phygital8thwall-ar` | `phygital-ar` | `ar-engine` |

---

## Before you start

1. GitHub repo connected to Vercel.
2. MongoDB Atlas, AWS S3, Stripe, Google OAuth credentials (same as Render).
3. Copy secrets from `deploy/env/server.env.render.local` for the API project.

### Vercel limits (API)

| Feature | On Vercel |
|---------|-----------|
| Express API | Yes (serverless via `server/api/index.js`) |
| `/health`, `/api/*`, `/r/:slug` | Yes |
| Background workers (`scanWorker`, `cardRenderWorker`) | **No** — leave `REDIS_URL` unset |
| Puppeteer card PNG export | **Limited** — may fail on serverless; keep Render for heavy print jobs or use Pro + long timeout |
| Function timeout | 10s (Hobby) / 60s (Pro) — set in `server/vercel.json` |

---

## Step 1 — Deploy API (`phygital-api`)

1. [vercel.com/new](https://vercel.com/new) → import repo.
2. **Project name:** `phygital-api`
3. **Root Directory:** `server` ← **required** (Edit → select `server`, not repo root)
4. Framework: **Other** — Vercel auto-detects `server/index.js` as Express (no `api/` folder needed)
5. **Environment variables** — paste from `deploy/env/server.env.vercel.example` + your real secrets from Render.
   - Do **not** set `VERCEL_URL` — Vercel sets it automatically.
   - Set `CLIENT_URL` and `API_PUBLIC_URL` after you know all URLs (step 4).
6. **Deploy** → note URL: `https://phygital-api.vercel.app`
7. Test: `https://phygital-api.vercel.app/health` → `{ "status": "ok" }`

### Google OAuth (API)

Authorized redirect URI:

`https://phygital-api.vercel.app/api/auth/google/callback`

### Stripe webhook (API)

Dashboard → Webhooks → endpoint:

`https://phygital-api.vercel.app/api/billing/webhook`

---

## Step 2 — Deploy AR engine (`phygital-ar`)

1. New project → same repo.
2. **Project name:** `phygital-ar`
3. **Root Directory:** `ar-engine`
4. **Environment variables:**

   | Variable | Value |
   |----------|--------|
   | `VITE_API_URL` | `https://phygital-api.vercel.app/api` |

5. **Deploy** → note URL: `https://phygital-ar.vercel.app`

---

## Step 3 — Deploy client (`phygital-client`)

1. New project → same repo.
2. **Project name:** `phygital-client`
3. **Root Directory:** `client`
4. **Environment variables** — from `deploy/env/client.env.vercel.example`:

   | Variable | Value |
   |----------|--------|
   | `VITE_API_URL` | `https://phygital-api.vercel.app/api` |
   | `VITE_APP_URL` | `https://phygital-client.vercel.app` |
   | `VITE_AR_ENGINE_URL` | `https://phygital-ar.vercel.app` |
   | `VITE_APP_NAME` | `Phygital` |
   | `VITE_STRIPE_PUBLISHABLE_KEY` | (from Render, if used) |

5. **Deploy** → note URL: `https://phygital-client.vercel.app`

---

## Step 4 — Wire URLs together (redeploy all 3)

Update env vars with **final** URLs, then **Redeploy** each project:

| Project | Update |
|---------|--------|
| **phygital-api** | `CLIENT_URL=https://phygital-client.vercel.app` |
| **phygital-api** | `API_PUBLIC_URL=https://phygital-api.vercel.app` |
| **phygital-client** | `VITE_*` URLs match the table above |
| **phygital-ar** | `VITE_API_URL=https://phygital-api.vercel.app/api` |

### Google Cloud (client origin)

Authorized JavaScript origins:

- `https://phygital-client.vercel.app`

---

## Step 5 — Verify

- [ ] `https://phygital-api.vercel.app/health`
- [ ] `https://phygital-client.vercel.app` — home page
- [ ] Login / register
- [ ] Dashboard campaigns
- [ ] `https://phygital-client.vercel.app/ar/<id>` — surface AR + `/xr/xr.js`
- [ ] Image-target AR → `https://phygital-ar.vercel.app/ar/<id>`
- [ ] Short links: `https://phygital-api.vercel.app/r/<slug>`

---

## Custom domains (optional)

| Service | Example domain |
|---------|----------------|
| Client | `phygital.zone` |
| API | `api.phygital.zone` |
| AR | `ar.phygital.zone` |

Update all env vars to match custom domains and redeploy.

---

## Local build test

```bash
# Client
cd client && npm run build

# AR engine
cd ar-engine && npm run build

# API — no build; test locally:
cd server && node index.js
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `/health` returns Vercel `NOT_FOUND` | **Root Directory must be `server`** — redeploy after fixing in Project Settings |
| API 500 on cold start | Check `MONGO_URI` and Vercel function logs |
| CORS / cookies | `CLIENT_URL` on API must match `VITE_APP_URL` exactly |
| Google OAuth fails | Redirect URI + JS origins must match Vercel URLs |
| `npm install` fails in subdirectory | `installCommand` is `cd .. && npm install` in each `vercel.json` |
| AR black screen on iOS | Confirm `https://phygital-client.vercel.app/xr/xr.js` returns 200 |
| Card print download fails | Expected on serverless — use Render API for print workers or VPS |

---

## Repo config files

| Path | Purpose |
|------|---------|
| `server/vercel.json` | Function timeout (60s) — Express entry is `index.js` |
| `server/index.js` | Express app export (`module.exports = app`) |
| `client/vercel.json` | Client static build + SPA routes |
| `ar-engine/vercel.json` | AR static build + SPA routes |
| `deploy/env/*.env.vercel.example` | Env templates per service |

Production VPS deploy: `deploy/DEPLOY.md` (unchanged).
