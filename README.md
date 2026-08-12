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

```bash
npm install          # installs both workspaces
npm run db:generate   # generate the Prisma client
npm run db:migrate    # create the local SQLite dev database
npm run dev:api        # http://localhost:4000
npm run dev:web        # http://localhost:5173, in a second terminal
```

## Why this structure

The frontend (`apps/web`) is the existing prototype, moved as-is — same
components, same design system, no rewrite. `apps/api` is new: a small
Express + Prisma service that Phase 1 wires the frontend's mock arrays up to.

Local development uses SQLite so no cloud account is required to start
building. The Prisma schema is written to move to Azure SQL / T-SQL for
staging and production without application-code changes — see
`apps/api/prisma/schema.prisma`.
