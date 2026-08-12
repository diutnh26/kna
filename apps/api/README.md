# @kna/api

Express + TypeScript + Prisma. Local dev runs on SQLite — no cloud account
needed to start.

## Setup

```bash
cp .env.example .env
npm install                 # from the repo root, installs all workspaces
npm run db:generate --workspace apps/api
npm run db:migrate --workspace apps/api   # creates apps/api/prisma/dev.db
npm run db:seed --workspace apps/api      # loads the same demo data the mockup shows
npm run dev --workspace apps/api          # http://localhost:4000
```

Or, from the repo root, the shortcuts in the root `package.json`:
`npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run dev:api`.

## Routes

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | — | DB connectivity check |
| POST | `/auth/signup`, `/auth/login` | — | Returns a JWT |
| GET | `/listings`, `/listings/:id` | — | `?category=`, `?buon=` |
| GET | `/products` | — | `?category=` |
| POST | `/bookings` | ✓ | Computes the 7%/3%/90% split, writes a `LedgerEntry` |
| GET | `/bookings/mine` | ✓ | |
| POST | `/orders` | ✓ | Computes the 5%/95% split, writes a `LedgerEntry` |
| GET | `/community/ledger` | — | The public transparency table |
| GET | `/community/fund` | — | Community Fund entries, grouped by quarter |
| GET | `/community/decisions`, `/community/committee` | — | |

Every route that moves money computes its fee split via
`src/lib/fees.ts` — that's the one place the 7/3/90 and 5/95 percentages
live, so the API and the public ledger can never disagree with each other.

## Moving to Azure SQL later

1. Change `prisma/schema.prisma`'s `datasource.provider` to `"sqlserver"`.
2. Point `DATABASE_URL` at the Azure SQL connection string.
3. `npm run db:migrate` again. No application code changes.
