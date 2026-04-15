# Phygital8ThWall — System Architecture

## Overview

Phygital8ThWall is a SaaS platform that lets users create WebAR business card campaigns.
Any person who scans the generated QR code and points their phone camera at the business card
will see a 3D holographic video pop out from the card — with no app download required.

---

## Monorepo Structure

```
PhygitalEightThWall/
├── client/        React + Vite frontend (SaaS dashboard + marketing site)
├── server/        Express + MongoDB REST API
├── ar-engine/     8th Wall + Three.js WebAR experience (standalone Vite app)
└── docs/          Architecture documentation
```

---

## Tech Stack

| Layer        | Technology                                          |
|--------------|-----------------------------------------------------|
| Frontend     | React 18, Vite, Tailwind CSS v3, Framer Motion      |
| State        | Zustand (with persist middleware)                   |
| HTTP Client  | Axios (with JWT interceptors)                       |
| Charts       | Recharts                                            |
| Backend      | Node.js, Express 4, MongoDB Atlas, Mongoose 8       |
| Auth         | JWT (access token 15m) + Refresh Token (7d, httpOnly cookie) |
| Storage      | Cloudinary (images + videos + thumbnails)           |
| AR           | 8th Wall Open Source, Three.js, GSAP                |
| Deployment   | Vercel (client), Render/Railway (server), Atlas     |

---

## Data Flow

```
User Browser (client/)
      │
      │  REST API calls (Axios)
      ▼
Express Server (server/)
      │
      ├── MongoDB Atlas  ← campaign data, user data, analytics
      └── Cloudinary     ← image targets, videos, thumbnails
            │
            ▼
AR Engine (ar-engine/) — served from Vercel/CDN
      │
      │  Fetches campaign data from API
      ▼
8th Wall WebAR SDK — image tracking
      │
      ▼
Three.js 3D Scene — holographic video plane
```

---

## Key User Journey

1. User registers / logs in → receives JWT access token + refresh token cookie
2. User creates a campaign:
   - Uploads business card image → Cloudinary → `targetImageUrl` stored in DB
   - Uploads vertical intro video → Cloudinary → `videoUrl` stored in DB
   - QR code auto-generated pointing to `/ar/:campaignId`
3. User shares QR code (physical card, email, social)
4. Recipient scans QR → opens `/ar/:campaignId` in browser
5. AR engine fetches campaign from API, loads image target + video
6. 8th Wall detects the business card image → GSAP animates video plane into view
7. Analytics event (scan, watch time, location) sent back to server

---

## Authentication Flow

```
POST /api/auth/register → 201 { user, accessToken }  + Set-Cookie: refreshToken
POST /api/auth/login    → 200 { user, accessToken }  + Set-Cookie: refreshToken
POST /api/auth/refresh  → 200 { accessToken }         (uses httpOnly cookie)
POST /api/auth/logout   → 200                         (clears cookie)
```

Access tokens live in memory (Zustand store) — never localStorage.
Refresh tokens live in httpOnly cookies — not accessible to JS.

---

## Campaign Schema

```js
{
  userId:          ObjectId (ref: User),
  campaignName:    String,
  targetImageUrl:  String (Cloudinary URL),
  targetImagePublicId: String,
  videoUrl:        String (Cloudinary URL),
  videoPublicId:   String,
  qrCodeUrl:       String,
  status:          'active' | 'paused' | 'draft',
  analytics: {
    totalScans:    Number,
    uniqueScans:   Number,
    lastScannedAt: Date,
  },
  createdAt:       Date,
  updatedAt:       Date,
}
```

---

## Module Build Order

| Module | Feature                        | Status  |
|--------|--------------------------------|---------|
| 1      | Monorepo setup                 | ✅ Done |
| 2      | Authentication system          | Pending |
| 3      | User dashboard                 | Pending |
| 4      | Campaign creation flow         | Pending |
| 5      | QR generation + public AR page | Pending |
| 6      | 8th Wall WebAR integration     | Pending |
| 7      | Analytics system               | Pending |
| 8      | Campaign management            | Pending |
| 9      | Admin dashboard                | Pending |
| 10     | Production hardening           | Pending |

---

## Development Commands

```bash
# Run client dev server (http://localhost:5173)
npm run dev:client

# Run backend server (http://localhost:5000)
npm run dev:server

# Run AR engine (http://localhost:5174)
npm run dev:ar

# Format all files
npm run format
```

---

## Environment Setup Checklist

- [ ] Copy `client/.env.example` → `client/.env`, fill in values
- [ ] Copy `server/.env.example` → `server/.env`, fill in values
- [ ] Create MongoDB Atlas cluster, whitelist IP, get connection string
- [ ] Create Cloudinary account, get cloud name + API key + secret
- [ ] (Module 6) Create 8th Wall account, get app key
