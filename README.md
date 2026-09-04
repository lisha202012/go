# GOFAM GROW

Personal growth gamification web app (mobile-responsive PWA).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React (Vite), React Router, TailwindCSS, Zustand |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma |
| Auth | JWT (access + refresh), bcrypt |
| Jobs | node-cron (seed expiry, monthly virtue reset) |

## Monorepo layout

```
gofam-grow/
  apps/web          React PWA (mobile-first, max-width ~480px)
  apps/api          Express API (/api/v1)
  packages/shared-types   Shared enums & types
```

## Prerequisites

- Node.js 18+
- A PostgreSQL database (system install **or** Prisma local Postgres — no Docker required)

## Setup

### 1. Install dependencies

```bash
cd gofam-grow
npm install
npm run build -w @gofam/shared-types
```

### 2. Start a local database (recommended without Docker)

```bash
cd apps/api
npx prisma dev --name gofam-grow-mono --detach
# Prints a TCP URL, e.g. postgres://postgres:postgres@localhost:51214/template1
node scripts/ensure-db.mjs   # creates gofam_grow on that server
```

Or use your own Postgres and create a `gofam_grow` database.

### 3. Configure environment

```bash
# API
cp apps/api/.env.example apps/api/.env
# Set DATABASE_URL to your Postgres URL (port from prisma dev is often NOT 5432)

# Web
cp apps/web/.env.example apps/web/.env
```

### 4. Migrate & seed

```bash
# from repo root
npm run db:generate
cd apps/api && npx prisma migrate deploy && npx prisma db seed
```

For iterative local schema work you can use `npm run db:migrate` (`prisma migrate dev`).

Seed populates:

- 7 Hills (HOPE, HONE, HOLD, HOOD, HOST, HORN, HOOK)
- 7 Camps (coin rewards: 500 / 750 / 1000 / 1250 / 1500 / 2000 / 10000)
- Default `AdminConfig` rows for all tunable values

### 5. Run in development

```bash
# Terminal 1 — API (http://localhost:4000)
npm run dev:api

# Terminal 2 — Web (http://localhost:5173)
npm run dev:web
```

Health check: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

## Auth foundation (API)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/health` | Liveness + DB ping |
| POST | `/api/v1/auth/register` | `{ username, email, password }` |
| POST | `/api/v1/auth/login` | `{ email, password }` |
| POST | `/api/v1/auth/refresh` | `{ refreshToken }` |
| POST | `/api/v1/auth/logout` | Bearer + optional `{ refreshToken }` |
| GET | `/api/v1/auth/me` | Bearer required |

Protected routes use `requireAuth` middleware (`Authorization: Bearer <accessToken>` → `req.user`).

## Web routes (placeholders)

`/onboarding` · `/home` · `/missions` · `/journey` · `/glow` · `/profile`

No UI screens yet — scaffold only.

## Scheduled jobs

- **Hourly** — expire pending Glow Seeds past `expiresAt`
- **Daily 00:05** — remove `ActiveVirtue` rows past month-end `expiresAt`
