# Admin console

The admin console (`#admin` on the web app) lets a KNĂ admin manage the platform from the browser instead of the database. It is for the `ADMIN` role only. Coordinators keep their Dashboard, and Committee members keep the Review screen.

## The first admin

Admins are made in the console (People → Users → role), except the first one:

1. Sign up on the web app with the account that should become the admin (email or Google).
2. From `app/apps/api`, point `DATABASE_URL` at the database and run the script. For Neon, use the **direct** connection string:

   ```powershell
   $env:DATABASE_URL = "<Neon direct connection string>"
   npx tsx src/scripts/make-admin.ts you@example.com
   ```

3. Sign out and in again. **Admin** appears in the navbar.

The script also records itself in the admin audit log.

## What an admin can do

| Level | Areas | What it means |
|---|---|---|
| Full CRUD | Users, providers, Committee seats, listings, products, Community Fund entries, Committee decisions, archive entries, phrases | Create, edit and remove, with photographs uploaded from the browser |
| Actions only | Bookings, orders, ledger, carbon offsets, top-ups, wallets, linked Phantom wallets, chain jobs | Only what the platform's own rules allow: cancel a booking before check-in, settle or cancel an order, void a ledger row, withdraw an offset, retry a top-up credit, retry a registration or a chain job. Amounts, statuses and signatures are never edited directly: the database must keep agreeing with devnet |
| Read-only | Attestations, chain audit log, admin audit log, platform status | For looking, not changing. On-chain settings need the upgrade key, which never lives on the server |

**Removing** deletes a record only when nothing depends on it. Otherwise:

- a listing with bookings, or a product with orders, is unpublished;
- a user with history is disabled (they cannot sign in, and their records stay);
- a provider with listings is unverified and unpublished;
- an archive entry with an on-chain proof goes back to the Committee's queue.

Every removal and every money action needs a written reason.

**Publishing stays with the Committee.** Admins can create and edit archive entries and phrases, but these always go to the Committee's review queue. Editing a published entry sends it back for review. An admin can take a published entry down, but cannot put one up. Only a Committee seat can publish (`/archive/:id/review`, `/archive/phrases/:id/review`), and the ADMIN role does not count as one.

**Guards:**

- There is always at least one active admin.
- No admin can demote, disable or delete themselves.
- Changing someone's role, disabling them, removing their Committee seat or setting their password ends their sessions immediately.
- The console refuses changes that are not sent as JSON, which stops cross-site form posts.

## Audit trail

Every change made from the console writes an `AdminAuditLog` row:

- who made it and when;
- which record it touched, and the action;
- the fields before and after;
- the reason, when one is required.

Passwords, password hashes and wallet keys never appear in the trail or in any console response. Each record shows its own history under **History**, and **System → Admin audit log** shows everything.

## Providers

Providers manage their own catalogue from **Dashboard**:

- their household profile (name, photo, about);
- their listings (photo, details, rooms or seats, price) and products (photo, details, stock).

A household that KNĂ has not verified can prepare everything, but can publish only after an admin verifies it (Providers → verified). Removing something that already has bookings or orders unpublishes it instead of deleting it.

## Photographs

Uploads accept JPEG, PNG or WebP up to 3 MB. The bytes must match the declared type. Photos are stored in Postgres (`UploadedImage`, because the hosts have no persistent disk) and served from `GET /images/:id` with long-lived caching. The API builds the absolute URL from the request. Set `PUBLIC_API_URL` if the API sits behind a proxy that does not forward the original host and scheme.

## API

All endpoints are under `/admin` and require an ADMIN session:

```
GET    /admin/meta                          what the console can show and do
GET    /admin/system                        configuration and chain status
GET    /admin/:resource                     list (?q, ?page, ?pageSize, ?sort, ?dir, filters)
GET    /admin/:resource/:id                 one record, and the actions open to it
GET    /admin/:resource/:id/history         its audit trail
POST   /admin/:resource                     create
PATCH  /admin/:resource/:id                 update
DELETE /admin/:resource/:id                 remove, with {"reason": "..."}
POST   /admin/:resource/:id/actions/:name   an action, e.g. cancel a booking
```

Resources are described once, in `app/apps/api/src/admin/resources.ts`. To add an area, describe it there: its fields, what it allows, and its rules. The console picks it up from `/admin/meta`.
