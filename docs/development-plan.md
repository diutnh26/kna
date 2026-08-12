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

## Phase 0 — Foundation (in progress)

- [x] Git repo initialized, baseline mockup snapshot committed
- [x] Repo split into `apps/web` (existing prototype) + `apps/api` (new)
- [ ] Auth service + real "Sign in" in `Navbar.jsx`
- [ ] `react-i18next` wired; EN·VI toggle in `Navbar.jsx` actually switches locale
- [ ] CI: lint + build on every PR
- [ ] Security review of the auth flow before payment work begins

## Phase 1 — MVP core (3 mo. build + 3 mo. pilot, one buôn)

| Area | Ships | Deferred |
|---|---|---|
| Booking (`Travel.jsx`) | Real listings, availability, VNPay/MoMo checkout, concierge-assisted confirmation queue | Dynamic pricing, calendars, third-party sync |
| Marketplace (`Marketplace.jsx`) | Real inventory, cart, checkout, 5% fee at settlement | Digital certificates of authenticity |
| Transparency ledger (`Community.jsx`, `Landing.jsx`) | Public revenue-split table (10% booking: 7%/3%, 5% marketplace), DB-backed | Blockchain settlement (Phase 2) |
| Cultural archive (`Explore.jsx`) | Admin console, elder/committee moderation before publish | 360° tours, gamified phrases |
| Governance & provider ops | Committee roster + decisions log as real records, provider dashboard | On-platform voting |

### Exit gate (all four required)

- 100+ completed bookings in the 3-month pilot window
- ≥80% of onboarded providers still active at pilot end
- Post-trip survey confirms the transparency panel affected the booking decision
- 1 B2B partner (Intermèdes or Lua Viet Tours) completes a pilot group through the platform

## Phase 2 — Transparency & intelligence (gated by Phase 1)

- Blockchain revenue distribution — architecture choice (public / permissioned / centralized+audited) gated on legal review, then a 1-month parallel run against the DB ledger before cutover
- AI travel assistant — exactly 2 functions (itinerary planning, cultural-etiquette coaching), RAG over the *published, moderated* archive only, explicit "I don't know" fallback
- Carbon tracker — wired to real booking data, community-run offset project registry

## Phase 3 — Controlled scale (gated by Phase 2)

- Replication tooling for new buôn (same schema, new tenant, not a new codebase)
- ESG reporting product (Power BI over Azure SQL)
- White-label / other-province expansion — scoped, not built, until Phase 3 revenue funds it

## Explicitly not in Phase 1

Blockchain settlement · AI assistant (any form) · carbon tracker (any form) ·
dynamic pricing · white-label · on-platform committee voting · digital
certificates of authenticity.
