# Deploying KNĂ (staging)

Target: a free, publicly reachable staging environment — enough to show
Intermèdes and Lua Viet Tours, run the §4.3 concept test, and let Committee
members try the review console on a real device.

| Piece | Where | Cost |
|---|---|---|
| Frontend | Render Static Site | free |
| API | Render Web Service | free |
| Database | **Azure SQL, free offer** | free |

## Why the database isn't on Render

Render offers only Postgres and Redis — **no SQL Server**. This project runs
on SQL Server, and that is not a preference: moving to it caught three real
defects that SQLite had hidden, including one that would have failed the
second marketplace order in production (see "Why not SQLite" in
[`apps/api/README.md`](../apps/api/README.md)).

Render's free Postgres also **expires 30 days after creation**, which is
shorter than a pilot.

Azure SQL's free offer gives **100,000 vCore-seconds and 32 GB per database,
for the lifetime of the subscription**, up to 10 databases. It keeps
development, CI, staging and production all on one engine, and it matches
the T-SQL and Power BI skills the plan is built around.

> **Students:** the *Azure for Students Starter* offer is explicitly
> incompatible with the SQL free offer. Use *Azure for College Students* or
> the standard *Azure Free* account instead.

## 1. Database

1. Go to <https://aka.ms/azuresqlhub> → **Create a database** → **Start free**.
2. Name the database `kna` and create a logical server. Note the server name,
   admin login, and password.
3. Confirm the **Cost summary** card reads **Estimated Cost/Month: 0**.
4. Leave *Behavior when free limit reached* on **Auto-pause** — that makes
   overspend impossible.

### Firewall

Azure SQL denies everything by default. Render is not Azure, so
"Allow Azure services" does **not** cover it. Add Render's outbound IPs for
your region as firewall rules — they're listed on your service's
**Connect** page in the Render dashboard, under outbound IPs.

Do **not** open `0.0.0.0/0`. This database will hold the public ledger and
real people's contact details.

### Connection string

```
sqlserver://<server>.database.windows.net:1433;database=kna;user=<login>;password=<password>;encrypt=true
```

### First migration

Run once from your machine, with the firewall temporarily allowing your own
IP:

```bash
cd apps/api
DATABASE_URL="<connection string>" npx prisma migrate deploy
```

After this, Render's `preDeployCommand` applies migrations on every deploy.

**Do not run `npm run db:seed` against it.** The seed deletes every row; it
refuses to run against a non-local, non-dev-named database, and that guard
is there for a reason.

## 2. Render

1. Render dashboard → **New** → **Blueprint** → connect the GitHub repo.
   It reads [`render.yaml`](../render.yaml) and creates `kna-api` and
   `kna-web`.
2. On **kna-api**, set the two secrets marked `sync: false`:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Azure SQL string above |
   | `JWT_SECRET` | 32+ chars — `openssl rand -base64 48` |

   The API **refuses to start** without both, and rejects a short or
   default secret (`apps/api/src/lib/config.ts`). A failed first boot is
   almost always one of these.
3. Deploy. `CORS_ORIGIN` and `VITE_API_URL` are wired between the two
   services automatically.

## What "free" actually means here

- **The API sleeps.** Render spins a free service down after 15 minutes
  idle; the next request takes ~1 minute. Fine for a demo, visibly bad if
  you hand the link to a partner cold — open it yourself a minute first.
- **750 instance-hours/month** across the workspace.
- **Ephemeral disk.** Nothing written to the filesystem survives a restart.
  Uploaded media will need object storage; nothing uploads today.
- **Single instance, no autoscaling.**

## Before this is production rather than staging

- **SMTP ports 25, 465 and 587 are blocked on Render's free tier.** When
  booking-confirmation email is built, use an HTTP email API (Resend,
  Postmark, SendGrid) rather than raw SMTP. Worth knowing before choosing a
  provider.
- No custom domain or TLS beyond `*.onrender.com`.
- No error tracking or log retention.
- No database backups beyond Azure SQL's 7-day point-in-time restore.
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
