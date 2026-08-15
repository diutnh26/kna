# Demonstration data

The deployed environment ships with a dataset showing **how KNĂ presents
information** — a public ledger row, a household's earnings, a moderation
queue, a coordinator's confirmation list. It uses the households, listings
and products the original mockup carried.

**None of it is field data.** Real records arrive with the pilot. The app
says so on every screen for as long as these records exist.

## Loading it

```bash
npm run db:demo
```

Additive. It deletes nothing, and it is safe to point at Neon.

That is the whole reason it exists separately from the seed:

| | `npm run db:seed` | `npm run db:demo` |
|---|---|---|
| Deletes every row first | **yes** | no |
| Safe against a deployed database | no — refuses | yes |
| Refuses if data is already there | no | yes |

Both load the same records, from [`apps/api/prisma/dataset.ts`](../apps/api/prisma/dataset.ts).
One copy, so a developer's machine and the demo environment cannot drift
into showing different things.

The seed's guard — which refuses to run against anything that is not a
local, dev-named database — must not be weakened to populate a deployed
environment. One stray run later would erase real pilot data. `db:demo` is
the other door.

## What it refuses to do

- **Load twice.** The dataset creates rows with generated ids, so a second
  run would duplicate every listing and double every ledger figure. On a
  transparency ledger that is worse than an error message, so it stops.
- **Sit beside real accounts.** If the database holds any user outside
  `@example.kna`, it refuses. Mixing demonstration figures into a live
  ledger is the one thing this platform cannot afford. Override with
  `DEMO_ALLOW_ALONGSIDE_REAL=yes` only if you are certain.

## How the banner knows

`GET /community/stats` returns `isDemoData: true` when any `@example.kna`
account exists, and [`DemoDataBanner.jsx`](../apps/web/src/components/DemoDataBanner.jsx)
renders from that.

Deliberately derived from the data rather than a build flag. A flag left
set would label real pilot records as a demo; a flag left unset would
present demo figures as real. This clears itself the moment the
demonstration records are removed — no deploy, no config change.

`@example.kna` is the marker: `example` is reserved and `.kna` is not a
TLD, so these addresses can never collide with a real one and are
recognisable at a glance in the database.

## Signing in

Every demonstration account uses the password `changeme123`.

| Account | Shows you |
|---|---|
| `guest@example.kna` | booking and buying as a visitor |
| `coordinator@example.kna` | the confirmation queue — bookings and orders awaiting a decision |
| `ami.hbia@example.kna` | a household's own earnings, and the Committee review console (she holds both) |
| `y.bla@example.kna` | an artisan's marketplace side |

## What's in it

10 verified providers across 4 buôn · 6 listings · 6 products ·
6 Committee members · 9 Community Fund entries · 4 published decisions ·
9 archive entries (6 published, 2 awaiting review, 1 refused) · 5 phrases.

Transactions cover both halves of the lifecycle on purpose:

- **2 settled** — one confirmed booking, one paid order. These are what the
  public ledger shows.
- **3 pending** — two bookings and one order awaiting a coordinator. These
  are deliberately *absent* from the public ledger, and present in the
  confirmation queue. A dataset with only settled records makes the queue
  look broken, and hides the distinction the ledger fix was about.

## Removing it

When real providers are onboarded, delete the demonstration records and the
banner disappears by itself. Delete children before parents — ledger
entries, order items, bookings and orders first, then listings and
products, then providers, then the `@example.kna` users.

Do this **before** real bookings exist, not after. Once a real ledger row
references a demo listing, untangling the two is no longer a delete.
