# Deploying KNĂ (staging)

Target: a free, publicly reachable staging environment — enough to show
Intermèdes and Lua Viet Tours, run the §4.3 concept test, and let Committee
members try the review console on a real device.

| Piece | Where | Cost | Card needed |
|---|---|---|---|
| Frontend | Render Static Site | free | no |
| API | Render Web Service | free | no |
| Database | **Neon Postgres** | free, permanently | no |

## Why Neon and not Render's own Postgres

Render offers a free Postgres, but it **expires 30 days after creation** —
shorter than the pilot it would have to survive.

Neon's free plan is permanent, needs no card, gives 0.5 GB per project, and
scales to zero when idle. It is also the same engine used in local
development and CI, which matters: running one engine everywhere is what
caught three real defects earlier in this project, including one that would
have failed the second marketplace order in production.

> **Historical note.** The plan document originally specified Azure SQL,
> chosen partly for the team's T-SQL and Power BI skills. That was dropped
> because no SQL Server host is free without card verification. Power BI has
> a native PostgreSQL connector, so the Phase 3 ESG-reporting story is
> unaffected — but the business plan's wording should be updated before the
> next submission so it matches what is deployed.

## 1. Database — already provisioned

The Neon project **KNA** (`tiny-rice-73142638`) exists in the
`ap-southeast-1` (Singapore) region, running **PostgreSQL 18**, and all
three migrations have been applied to it. Local development runs Postgres
17; the schema uses nothing version-specific, and CI runs 17 as a check.

The repo has a committed [`.neon`](../.neon) file holding the org and
project IDs — no secrets. `npx neon env pull` writes the real connection
strings to `.env.local`, which is gitignored.

### Two connection strings, and why

Neon gives you both:

| | Host | Use for |
|---|---|---|
| **Pooled** | `…-pooler.…neon.tech` | the running app (`DATABASE_URL`) |
| **Direct** | `…neon.tech` (no `-pooler`) | migrations (`DIRECT_DATABASE_URL`) |

The pooled endpoint is PgBouncer in transaction mode, which cannot run
Prisma migrations — they need session-level advisory locks. The schema
declares `directUrl` so Prisma picks the right one automatically. Locally
both point at the same server, so it makes no difference there.

### Running migrations by hand

```bash
npx neon env pull        # writes .env.local at the repo root

cd apps/api
DIRECT="<neon direct url>"
DATABASE_URL="$DIRECT" DIRECT_DATABASE_URL="$DIRECT" npx prisma migrate deploy
```

After this, Render's **build command** applies pending migrations on every
deploy. (Render does not support `preDeployCommand` on the free plan, so
migration runs as a build step. `migrate deploy` is a no-op once migrations
are applied, so this is safe to repeat — but if a build fails after it, the
database is briefly ahead of the running code. Harmless for additive
migrations; apply a destructive one by hand first.)

**Do not run `npm run db:seed` against it.** The seed deletes every row. It
refuses to run against a non-local or non-dev-named database, and that
guard exists precisely for this moment.

## 2. Render

1. Render dashboard → **New** → **Blueprint** → connect the GitHub repo.
   It reads [`render.yaml`](../render.yaml) and creates `kna-api` and
   `kna-web`.
2. On **kna-api**, set the two secrets marked `sync: false`:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** string (`…-pooler.…`), with `?sslmode=require` |
   | `DIRECT_DATABASE_URL` | Neon **direct** string (no `-pooler`), same options |
   | `JWT_SECRET` | 32+ chars — `openssl rand -base64 48` |

   Paste the **bare URL only**. Neon's dashboard can hand you a `psql '…'`
   command; copying that whole line is the most common way this fails, and
   Prisma reports it only as `P1013: the scheme is not recognized`. The
   build runs `apps/api/scripts/check-db-env.mjs` first, which names the
   offending variable, spots a pasted psql command, and refuses if the
   pooled and direct URLs are the wrong way round.

   The API also **refuses to start** without both, and rejects a short or
   default `JWT_SECRET` (`apps/api/src/lib/config.ts`).
3. Deploy.

### The two services' URLs are written out, not wired

`render.yaml` sets `CORS_ORIGIN` and `VITE_API_URL` to literal origins.
Render's `fromService … property: host` looks like the better answer and was
tried first; it failed in both directions, and both failures were silent:

- On the API it resolved to the **bare service name**, so the response
  header was `access-control-allow-origin: https://kna-web` and a browser
  would have blocked every call from the real origin.
- On the static site it did not reach the Vite build **at all**, so
  `VITE_API_URL` was unset and the first deployed bundle called
  `http://localhost:4000`. The build succeeded and the site served; it was
  broken only in a visitor's browser.

So `apps/web/vite.config.js` now **fails the build** if `VITE_API_URL` is
missing or points at localhost, and CI asserts the built bundle names the
deployed API. If you rename a service, edit both values in `render.yaml`.

To build the frontend locally you must therefore pass one:

```bash
VITE_API_URL=https://kna-api.onrender.com npm run build:web
```

## What "free" actually costs here

- **The API sleeps.** Render spins a free service down after 15 minutes
  idle; the next request takes ~1 minute. Fine for a demo, visibly bad if
  you send a partner a cold link — open it yourself a minute beforehand.
- **The database sleeps too.** Neon scales to zero after 5 minutes; the
  first query afterwards takes a second or so.
- **750 instance-hours/month** on Render, **100 CU-hours/month** on Neon,
  per workspace/project.
- **0.5 GB database.** Ample for a pilot; nowhere near a media library.
- **Ephemeral disk on Render.** Nothing written to the filesystem survives a
  restart. Uploaded media will need object storage; nothing uploads today.
- Exceeding a Neon free limit **suspends compute until the next month**
  rather than billing you.

## Before this is production rather than staging

- **SMTP ports 25, 465 and 587 are blocked on Render's free tier.** When
  booking-confirmation email is built, use an HTTP email API (Resend,
  Postmark, SendGrid) rather than raw SMTP. Worth knowing before choosing a
  provider.
- No custom domain or TLS beyond `*.onrender.com`.
- No error tracking or log retention.
- Neon's free plan has no point-in-time restore worth relying on. The public
  ledger is the record this project's whole argument rests on; before real
  bookings exist, arrange backups.
- Privacy policy and terms don't exist yet, and this environment will hold
  real names and email addresses if anyone signs up. Treat the link as
  internal until those are written.

## Checks after deploying

Both services are live and were verified with these:

```bash
curl https://kna-api.onrender.com/health
# {"status":"ok","db":"connected", ...}

curl https://kna-api.onrender.com/listings
# [] until providers are onboarded — an empty array is correct, not a fault

# CORS must name the full origin, not the bare service name
curl -i -X OPTIONS https://kna-api.onrender.com/listings \
  -H "Origin: https://kna-web.onrender.com" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
# access-control-allow-origin: https://kna-web.onrender.com

# The deployed bundle must not have baked in the dev API URL
curl -s https://kna-web.onrender.com/ | grep -oE '/assets/index-[^"]+\.js'
curl -s https://kna-web.onrender.com/assets/<that file> | grep -c localhost:4000
# 0
```

`/listings`, `/products`, `/community/ledger`, `/community/committee` and
`/archive` all answer `200 []`.

### The database is empty, on purpose

Nothing is seeded. `npm run db:seed` deletes every row before inserting, and
refuses to run against anything that is not a local dev database — that
guard is why it cannot be pointed at Neon by accident.

So the deployed site currently renders empty states everywhere. Before
showing it to Intermèdes or Lua Viet Tours, decide deliberately between:

- **Onboard real providers** through the app — the honest option, and the
  one the pilot needs anyway.
- **Load demo content** written for the demo, inserted by a separate
  additive script. Do not reach for the seed: repointing it at Neon means
  disabling a guard that exists for exactly this moment, and one stray run
  later would wipe real pilot data.

Then sign in, place a booking, and confirm it appears on the landing page's
public ledger. That single loop exercises auth, the fee split, and the
ledger together, and nobody has driven it against the deployed stack yet.
