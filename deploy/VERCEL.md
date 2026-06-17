# Deploy Phygital client to Vercel (manual)

This repo is a **monorepo**. Vercel hosts the **React client** (`client/`). The **API** (`server/`) stays on your VPS/Render — it is not deployed to Vercel.

| Component | Host |
|-----------|------|
| React app (dashboard, QR, surface AR) | **Vercel** |
| Express API + MongoDB + workers | **VPS / Render** (existing) |
| Image-target AR (`ar-engine`) | **Optional** second Vercel project or `ar.phygital.zone` |

---

## 0. Prerequisites

1. [GitHub repo](https://github.com/thankiuday/Phygital_8th_wall) pushed and up to date.
2. [Vercel account](https://vercel.com/signup) (GitHub login recommended).
3. A running API with HTTPS, e.g. `https://phygital.zone/api`.
4. Node **18+** locally (Vercel uses Node 20 by default).

---

## 1. One-time: prepare the API for a new client URL

When the client lives on a new domain (e.g. `https://phygital.vercel.app`), update **server** env on VPS/Render:

```bash
# Use your real Vercel URL or custom domain
CLIENT_URL=https://your-project.vercel.app
```

Also update:

| Service | Setting |
|---------|---------|
| Google Cloud Console | Authorized JavaScript origins: `https://your-project.vercel.app` |
| Google Cloud Console | Authorized redirect URI stays: `https://phygital.zone/api/auth/google/callback` |
| Stripe Dashboard | Success/cancel URLs if they hard-code `CLIENT_URL` |
| CORS | Already reflects `Origin` — no change if API allows any origin with credentials |

If you later point a **custom domain** on Vercel (e.g. `https://phygital.zone`), set `CLIENT_URL` to that domain instead.

---

## 2. Create the Vercel project (client)

1. Go to [vercel.com/new](https://vercel.com/new).
2. **Import** `thankiuday/Phygital_8th_wall` (or your fork).
3. **Important — Project settings:**

   | Setting | Value |
   |---------|--------|
   | **Root Directory** | `.` (repository root — **not** `client`) |
   | **Framework Preset** | Other |
   | **Build Command** | `npm run build:client` (or leave empty — `vercel.json` sets this) |
   | **Output Directory** | `client/dist` |
   | **Install Command** | `npm install` |

4. Do **not** enable “Override” unless you know you need to — root `vercel.json` already configures the build.

5. Click **Deploy** once to verify the build (it may fail until env vars are set — that’s OK).

---

## 3. Environment variables (Vercel dashboard)

**Project → Settings → Environment Variables**

Add for **Production** and **Preview**:

| Variable | Example | Required |
|----------|---------|----------|
| `VITE_API_URL` | `https://phygital.zone/api` | Yes |
| `VITE_APP_URL` | `https://your-project.vercel.app` | Yes |
| `VITE_AR_ENGINE_URL` | `https://ar.phygital.zone` | Yes (image-target AR) |
| `VITE_APP_NAME` | `Phygital` | Optional |

Use your real Vercel URL for `VITE_APP_URL` until a custom domain is attached.

Reference: `deploy/env/client.env.vercel.example`

---

## 4. Redeploy

After env vars are saved:

**Deployments → … → Redeploy** (or push a commit to `main`).

Build steps (automatic):

1. `npm install` (all workspaces — links `ar-engine` into client)
2. `client` prebuild: copies 8th Wall binaries to `client/public/xr`
3. `vite build` → output in `client/dist`

---

## 5. Custom domain (optional)

1. Vercel → **Project → Settings → Domains**
2. Add `phygital.zone` and `www.phygital.zone`
3. At your DNS host, add the records Vercel shows (usually `CNAME` for `www`, `A` for apex)
4. Update env vars:
   - `VITE_APP_URL=https://phygital.zone`
   - Server `CLIENT_URL=https://phygital.zone`
5. Redeploy client

**Note:** If `phygital.zone` currently points to your VPS for API + static files, move API to a subdomain (e.g. `api.phygital.zone`) and set `VITE_API_URL=https://api.phygital.zone/api`, or keep API on the same host behind a reverse proxy.

---

## 6. Optional: deploy `ar-engine` on Vercel

Image-target campaigns redirect to `VITE_AR_ENGINE_URL`. You can host that separately:

1. Create a **second** Vercel project from the same repo.
2. Settings:

   | Setting | Value |
   |---------|--------|
   | **Root Directory** | `ar-engine` |
   | **Build Command** | `npm run build` (from `ar-engine/vercel.json`) |
   | **Output Directory** | `dist` |
   | **Install Command** | `cd .. && npm install` |

3. Set client `VITE_AR_ENGINE_URL` to the new URL (e.g. `https://ar-yourproject.vercel.app`).

---

## 7. Verify after deploy

- [ ] Home page loads: `https://your-project.vercel.app`
- [ ] Login / register (API + cookies)
- [ ] Google OAuth (if enabled)
- [ ] Dashboard loads campaigns
- [ ] Public AR page: `/ar/<campaignId>` — surface mode opens camera on iPhone
- [ ] `/xr/xr.js` returns 200 (8th Wall SLAM assets)
- [ ] Image-target AR opens `VITE_AR_ENGINE_URL/ar/<id>`

---

## 8. Local production build test (before Vercel)

```bash
cd PhygitalEightThWall
npm install
cp deploy/env/client.env.vercel.example client/.env.local
# Edit client/.env.local with real URLs

npm run build:client
npx serve client/dist -p 4173
```

Open `http://localhost:4173` — API calls go to `VITE_API_URL` (not proxied).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build: `@8thwall` not found | Root Directory must be repo root; run `npm install` at root |
| 404 on `/dashboard` refresh | `vercel.json` rewrites — redeploy from latest `main` |
| API 401 / cookies not sent | `VITE_API_URL` must be HTTPS; API `CLIENT_URL` must match `VITE_APP_URL` |
| CORS errors | API must allow your Vercel origin (current server reflects `Origin`) |
| AR black screen on iOS | Confirm `/xr/xr.js` loads; use HTTPS; allow camera permission |
| Google login fails | Update `CLIENT_URL` on server + Google authorized origins |

---

## What stays off Vercel

- `server/` — Express, MongoDB, Redis workers, Puppeteer card render
- Long-running processes (PM2 workers)
- MongoDB / S3 / Stripe webhooks

Keep using `deploy/DEPLOY.md` for VPS API operations.
