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

Requires **PostgreSQL** on `localhost:5432` — see
[`apps/api/README.md`](apps/api/README.md) for setup.

```bash
createdb kna_dev && createdb kna_test        # once

cp apps/api/.env.example apps/api/.env
npm install           # installs both workspaces
npm run db:generate   # generate the Prisma client
npm run db:migrate    # apply migrations
npm run db:seed       # load demo data (wipes kna_dev; refuses non-local targets)
npm run dev:api       # http://localhost:4000
npm run dev:web       # http://localhost:5173, in a second terminal
```

For the AI assistant, put a `GEMINI_API_KEY` (aistudio.google.com) in
`apps/api/.env`, then `npm run ai:sync` to embed the knowledge base.
**Hướng dẫn test chatbot từng bước (tiếng Việt): [`docs/test-chatbot.md`](docs/test-chatbot.md)** —
details in [`apps/api/src/ai/README.md`](apps/api/src/ai/README.md), and a
standalone local test bench in
[`apps/local-chatbot-test/README-TEST.md`](apps/local-chatbot-test/README-TEST.md)
(`npm run dev:chatbot-test` → http://localhost:4100). Without a key the
assistant still runs, serving Committee-approved answers only.

Demo accounts all use the password `changeme123` — `guest@example.kna`,
`ami.hbia@example.kna` (host and Committee chair),
`coordinator@example.kna`.

## Why this structure

The frontend (`apps/web`) is the existing prototype, moved as-is — same
components, same design system, no rewrite. `apps/api` is a small
Express + Prisma service that Phase 1 wired the frontend's mock arrays up to.

Development, CI and production all run on PostgreSQL (Neon in staging and
production), so they agree on constraint behaviour. Development previously
ran on SQLite and then SQL Server; the history and why it matters are in
the "One engine everywhere" section of `apps/api/README.md`.
