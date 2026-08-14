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

## 1. Database

1. Sign up at <https://neon.com> with GitHub. No card.
2. Create a project named `kna`. Pick the region closest to Đắk Lắk —
   Singapore (`ap-southeast-1`) is the nearest.
3. Copy the connection string from the dashboard. It looks like:

   ```
   postgresql://<user>:<password>@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

   Keep `?sslmode=require`. Neon refuses unencrypted connections.

### First migration

Run once from your machine:

```bash
cd apps/api
DATABASE_URL="<neon connection string>" npx prisma migrate deploy
```

After this, Render's `preDeployCommand` applies migrations on every deploy.

**Do not run `npm run db:seed` against it.** The seed deletes every row. It
refuses to run against a non-local or non-dev-named database, and that guard
exists precisely for this moment.

## 2. Render

1. Render dashboard → **New** → **Blueprint** → connect the GitHub repo.
   It reads [`render.yaml`](../render.yaml) and creates `kna-api` and
   `kna-web`.
2. On **kna-api**, set the two secrets marked `sync: false`:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon string, including `?sslmode=require` |
   | `JWT_SECRET` | 32+ chars — `openssl rand -base64 48` |

   The API **refuses to start** without both, and rejects a short or
   default secret (`apps/api/src/lib/config.ts`). A failed first boot is
   almost always one of these.
3. Deploy. `CORS_ORIGIN` and `VITE_API_URL` are wired between the two
   services automatically.

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

```bash
curl https://kna-api.onrender.com/health
# {"status":"ok","db":"connected", ...}

curl https://kna-api.onrender.com/listings
# [] until providers are onboarded — an empty array is correct, not a fault
```

Then open the frontend, sign in, and place a booking; it should appear on
the landing page's public ledger. That single loop exercises auth, the fee
split, and the ledger together.
