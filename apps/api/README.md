# @kna/api

Express + TypeScript + Prisma on **SQL Server** — a local instance for
development and tests, Azure SQL for staging and production.

## Setup

You need a SQL Server instance reachable over TCP. On Windows, Developer or
Express edition both work; elsewhere use the official container:

```bash
docker run -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='Your!Strong!Passw0rd' \
  -p 1433:1433 -d mcr.microsoft.com/mssql/server:2022-latest
```

Create the two databases (once):

```sql
CREATE DATABASE kna_dev;
CREATE DATABASE kna_test;
```

Then:

```bash
cp .env.example .env          # adjust DATABASE_URL if not using Windows auth
npm install                   # from the repo root
npm run db:generate --workspace apps/api
npm run db:migrate  --workspace apps/api
npm run db:seed     --workspace apps/api
npm run dev         --workspace apps/api   # http://localhost:4000
```

Root shortcuts: `npm run db:generate`, `db:migrate`, `db:seed`, `dev:api`,
`test:api`.

`npm run db:seed` **deletes everything** in `kna_dev` and reloads the demo
data. Every demo account's password is `changeme123`; see the end of
`prisma/seed.ts` for the accounts.

## Tests

```bash
npm run test --workspace apps/api
```

Runs against `kna_test`, never `kna_dev`. `globalSetup` applies pending
migrations (`migrate deploy` — it never drops anything); each test file
clears rows itself via `resetDb()`.

## Why not SQLite

Development used to run on SQLite for zero setup. It was dropped because
too much of what matters is provider-specific, and SQLite quietly accepted
things SQL Server rejects — or worse, accepted things SQL Server accepts
but interprets differently. Moving over surfaced three real defects
immediately:

- **`UNIQUE` on a nullable column.** SQL Server treats NULLs as equal, so
  `LedgerEntry.bookingId` being nullable-unique allowed exactly one row
  with no booking — meaning the *second marketplace order ever placed*
  would have failed. Fixed with filtered unique indexes.
- **Multiple cascade paths.** SQL Server refuses them; the relations now
  say `NoAction`, which is also correct for a system that keeps a
  financial ledger — deleting a user must fail rather than silently erase
  a household's earnings history.
- **Unbounded text.** Prisma maps a bare `String` to `NVARCHAR(1000)`
  here. Free text a person writes (a listing blurb, an oral-history body,
  a moderation reason) is now `NVARCHAR(MAX)`.

## Schema notes

**No `enum` blocks** — Prisma's SQL Server connector doesn't support them.
The permitted values live in [`src/lib/enums.ts`](src/lib/enums.ts) and are
enforced at the database by CHECK constraints in the
`enum_check_constraints` migration. Adding a value means changing both.

## Routes

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | — | DB connectivity check |
| POST | `/auth/signup`, `/auth/login` | — | Rate limited; returns a JWT |
| GET | `/auth/me` | ✓ | Re-reads seat/provider status |
| GET | `/listings`, `/listings/:id` | — | `?category=`, `?buon=`, `?q=` |
| GET | `/products` | — | `?category=`, `?q=` |
| POST | `/bookings` | ✓ | 7%/3%/90% split + ledger row, one transaction |
| GET | `/bookings/mine` | ✓ | |
| GET | `/bookings/pending` | coordinator | The coordination queue |
| POST | `/bookings/:id/decision` | coordinator | `confirm` \| `decline` |
| POST | `/orders` | ✓ | 5%/95% split + ledger row |
| GET | `/providers/me` | provider | Own listings, bookings, earnings |
| GET | `/archive`, `/types`, `/pillars`, `/phrases`, `/stats` | — | Published entries only |
| POST | `/archive` | provider/committee | Always lands `IN_REVIEW` |
| GET | `/archive/queue`, `/reviewed` | committee | |
| POST | `/archive/:id/review` | committee | `publish` \| `reject` (reason required) |
| GET | `/community/ledger`, `/fund`, `/decisions`, `/committee`, `/stats` | — | The public record |

Every route that moves money computes its split via
[`src/lib/fees.ts`](src/lib/fees.ts) — the one place the 7/3/90 and 5/95
percentages live, so the API and the public ledger cannot disagree.

## Moving to Azure SQL

1. Create the database and a login; add a firewall rule for your IP and
   allow Azure services.
2. Point `DATABASE_URL` at it (see `.env.example`).
3. `npx prisma migrate deploy`.

No schema or application changes — the provider is already `sqlserver`.
