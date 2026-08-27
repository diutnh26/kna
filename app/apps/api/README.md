# @kna/api

Express + TypeScript + Prisma on **PostgreSQL** — a local instance for
development and tests, Neon for staging and production.

## Setup

You need PostgreSQL 16+ reachable on `localhost:5432`.

- **Installer** (needs admin): <https://www.postgresql.org/download/windows/>
- **No admin?** Download the *binaries-only* ZIP from the same page, extract
  it, then:

  ```powershell
  $PGBIN  = "<extracted>\pgsqlin"
  $PGDATA = "<extracted>\pgdata"
  & "$PGBIN\initdb.exe"  -D $PGDATA -U postgres --auth=trust --encoding=UTF8 --locale=C
  & "$PGBIN\pg_ctl.exe"  -D $PGDATA -l "$PGDATA\server.log" start
  ```

  `--encoding=UTF8 --locale=C` matters here: the data is full of Vietnamese
  diacritics. `--auth=trust` is safe because Postgres binds to localhost
  only; production uses a password. The server is not a Windows service, so
  re-run the `pg_ctl … start` line after a reboot.

Create the two databases (once):

```bash
createdb kna_dev
createdb kna_test
```

Then:

```bash
cp .env.example .env
npm install                   # from the repo root
npm run db:generate --workspace apps/api
npm run db:migrate  --workspace apps/api
npm run db:seed     --workspace apps/api
npm run dev         --workspace apps/api   # http://localhost:4000
```

Root shortcuts: `npm run db:generate`, `db:migrate`, `db:seed`, `dev:api`,
`test:api`.

`npm run db:seed` **deletes every row** in `kna_dev` and reloads the demo
data. It refuses to run against a database that isn't local and named
dev/test/local — override with `SEED_ALLOW_DESTRUCTIVE=yes` only when you
mean it. Every demo account's password is `changeme123`; see the end of
`prisma/seed.ts`.

## Tests

```bash
npm run test --workspace apps/api
```

Runs against `kna_test`, never `kna_dev`. `globalSetup` applies pending
migrations (`migrate deploy` — it never drops anything); each test file
clears rows itself via `resetDb()`.

## One engine everywhere

Development, CI, staging and production all run PostgreSQL. That uniformity
is the point, and it was learned the hard way.

Development originally ran on SQLite for zero setup while production
targeted something else. Moving off SQLite surfaced three real defects it
had silently accepted:

- **`UNIQUE` on a nullable column.** Some engines — SQL Server among them —
  treat NULLs as equal, so `LedgerEntry.bookingId` being nullable-unique
  allowed exactly one row with no booking, meaning the *second marketplace
  order ever placed* would have failed. Now enforced by partial unique
  indexes, which mean the same thing on every engine.
- **Multiple cascade paths.** Relations now say `NoAction`, which is also
  correct for a system keeping a financial ledger: deleting a user must
  fail rather than silently erase a household's earnings history.
- **Unbounded text.** Free text a person writes is unbounded on Postgres by
  default, but was silently capped at 1000 characters elsewhere.

The project ran on SQL Server for a while — the plan called for Azure SQL —
and moved to Postgres when it turned out no SQL Server host is free without
card verification. The three fixes above are engine-independent and stayed.

Two Postgres-specific things worth knowing:

- `contains` is **case-sensitive**, so the search routes pass
  `mode: 'insensitive'` explicitly. Without it, searching "wik" would not
  find "Y Wik Niê".
- Prisma supports `enum` on Postgres, and Postgres treats NULLs as distinct
  in a `UNIQUE`. The schema still avoids both, so the same shape works if
  the project ever moves back to SQL Server.

## Schema notes

**No `enum` blocks**, even though Postgres supports them. The permitted
values live in [`src/lib/enums.ts`](src/lib/enums.ts) and are enforced at
the database by CHECK constraints in the `enum_check_constraints`
migration, generated from that same list. Adding a value means changing
both — or neither.

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

## Deploying

See [`docs/deployment.md`](../../docs/deployment.md). In short: Neon for the
database (free, no card), Render for the API and frontend. No schema or
application changes are needed — only `DATABASE_URL`.
