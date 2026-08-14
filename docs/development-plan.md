# KNĂ — development plan (mockup → production)

Full designed version: published artifact, "KNĂ — Mockup to Production: Development Plan".
This file is the working, plain-text copy the team edits as the plan changes.

## Guardrails

1. **One hypothesis per phase.** Phase 1 tests exactly one thing: will a guest
   book and pay a household directly through the platform, and will that
   household stay reachable through it. Not blockchain, not AI, not carbon
   accounting — those are named out of MVP scope on purpose.
2. **Transparency ships before blockchain does.** Phase 1's "proof of impact"
   is a plain, publicly-readable revenue-split table. It becomes a smart
   contract in Phase 2, only after running in parallel with the manual
   ledger for a month with zero discrepancies.
3. **Quantified exit gates, not vibes.** See below.

## Phase 0 — Foundation (done)

- [x] Git repo initialized, baseline mockup snapshot committed
- [x] Repo split into `apps/web` (existing prototype) + `apps/api` (new)
- [x] Auth service + real "Sign in" in `Navbar.jsx`
- [x] `react-i18next` wired; EN·VI toggle in `Navbar.jsx` actually switches locale
- [x] CI: lint + build + typecheck + migrate + test on every PR
- [x] Security review of the auth flow before payment work begins

## Phase 1 — MVP core (build done; pilot not started)

| Area | Status |
|---|---|
| Booking (`Travel.jsx`) | **Done.** Real listings, search + filters, server-side pricing, concierge confirmation queue |
| Marketplace (`Marketplace.jsx`) | **Done.** Real inventory, checkout, 5% fee, stock enforcement |
| Transparency ledger (`Community.jsx`, `Landing.jsx`) | **Done.** Public revenue-split table, DB-backed, computed server-side |
| Cultural archive (`Explore.jsx`) | **Done.** Contribution + Committee moderation before publish (`#review`) |
| Governance & provider ops | **Done.** Committee roster and minutes as real records; provider dashboard and coordinator queue (`#dashboard`) |
| Payments | **Seam built, integration blocked.** See below. |

### Deferred out of Phase 1 (unchanged)

Dynamic pricing · 360° tours and media hosting · gamified phrasebook ·
digital certificates of authenticity · on-platform committee voting ·
provider discussion board · blockchain settlement.

### Payments — the one open item

`apps/api/src/payments/gateway.ts` defines the interface the rest of the
system codes against, and ships `ManualSettlementGateway`: the guest
arranges payment with the household directly and a coordinator records
it. That is not a stub — it is how the pilot actually runs, and it is why
bookings sit `PENDING` until confirmed.

Choosing VNPay vs MoMo is **not an engineering decision**. It depends on
which the pilot buôn's households can settle into, and needs a merchant
account. When that exists: add one file next to `gateway.ts` and set
`PAYMENT_PROVIDER`. Nothing outside `src/payments/` should need changing.

### Not production-ready yet

- No email delivery — booking confirmations reach nobody
- No password reset or email verification
- Media (audio, 360° tours, photo essays) has no storage or pipeline
- Privacy policy, terms, and a contact route need writing (their footer
  links were removed rather than left pointing at nothing)
- No automated end-to-end tests; 40 API tests and 25 frontend tests exist,
  but nobody has driven the deployed app in a browser end to end

### Exit gate (all four required — none met, none can be met by code)

- [ ] 100+ completed bookings in the 3-month pilot window
- [ ] ≥80% of onboarded providers still active at pilot end
- [ ] Post-trip survey confirms the transparency panel affected the booking decision
- [ ] 1 B2B partner (Intermèdes or Lua Viet Tours) completes a pilot group through the platform

These are field results, not build tasks. **Phase 2 does not begin when the
software is finished — it begins when these four clear.** The remaining work
before the pilot can start is a payment decision, a pilot buôn selected via
the Beachhead matrix (§5.7), and real providers onboarded.

## Phase 2 — Transparency & intelligence (gated by Phase 1)

- Blockchain revenue distribution — architecture choice (public / permissioned / centralized+audited) gated on legal review, then a 1-month parallel run against the DB ledger before cutover
- AI travel assistant — exactly 2 functions (itinerary planning, cultural-etiquette coaching), RAG over the *published, moderated* archive only, explicit "I don't know" fallback
- Carbon tracker — wired to real booking data, community-run offset project registry

## Phase 3 — Controlled scale (gated by Phase 2)

- Replication tooling for new buôn (same schema, new tenant, not a new codebase)
- ESG reporting product (Power BI over Postgres — see the note below)
- White-label / other-province expansion — scoped, not built, until Phase 3 revenue funds it

## Explicitly not in Phase 1

Blockchain settlement · AI assistant (any form) · carbon tracker (any form) ·
dynamic pricing · white-label · on-platform committee voting · digital
certificates of authenticity.

## Database engine — decision changed

The dossier specifies Azure SQL, chosen partly for the team's T-SQL and
Power BI skills. **The implementation runs on PostgreSQL instead**, because
no SQL Server host is free without credit-card verification, and the pilot
needs a deployed environment more than it needs a specific engine.

What this does and doesn't affect:

- **Power BI is unaffected** — it has a native PostgreSQL connector, so the
  Phase 3 ESG reporting product still works as described.
- **T-SQL skills are less directly used.** Almost all database access goes
  through Prisma in TypeScript; the only hand-written SQL in the repo is the
  CHECK-constraint and partial-index migrations.
- **The business plan wording should be updated** before the next
  submission so it matches what is deployed.

The project briefly ran on SQL Server, and that was not wasted: it exposed
three real defects SQLite had hidden, the most serious being a nullable
`UNIQUE` that would have failed the second marketplace order in production.
Those fixes are engine-independent and remain in place.
