# KNĂ

Community-owned circular tourism ecosystem for the Ê Đê people of Đắk Lắk, Vietnam.
BKI 2026 · Team NEXUS · UEF.

This is a monorepo (npm workspaces):

```
apps/
  web/   React + Vite frontend (the original prototype, unchanged in spirit)
  api/   Express + TypeScript + Prisma backend
```

See [`docs/development-plan.md`](docs/development-plan.md) for the phased build
plan this repo follows (Phase 0 → Phase 3).

## Getting started

Requires a **SQL Server** instance on `localhost:1433` — see
[`apps/api/README.md`](apps/api/README.md) for setup, including a Docker
one-liner if you don't have one.

```bash
CREATE DATABASE kna_dev; CREATE DATABASE kna_test;   -- once, in SQL Server

cp apps/api/.env.example apps/api/.env
npm install           # installs both workspaces
npm run db:generate   # generate the Prisma client
npm run db:migrate    # apply migrations
npm run db:seed       # load demo data (wipes kna_dev)
npm run dev:api       # http://localhost:4000
npm run dev:web       # http://localhost:5173, in a second terminal
```

Demo accounts all use the password `changeme123` — `guest@example.kna`,
`ami.hbia@example.kna` (host and Committee chair),
`coordinator@example.kna`.

## Why this structure

The frontend (`apps/web`) is the existing prototype, moved as-is — same
components, same design system, no rewrite. `apps/api` is a small
Express + Prisma service that Phase 1 wired the frontend's mock arrays up to.

Both development and production run on SQL Server (Azure SQL in staging and
production), so the two agree on constraint behaviour. Development briefly
ran on SQLite; that was dropped after it hid three provider-specific
defects — see the "Why not SQLite" section in `apps/api/README.md`.
