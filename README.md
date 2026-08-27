# KNĂ — Docker + Track 2 Solana (hackathon fork)

Independent snapshot of KNĂ for **UniHackfest Track 2**. Does not modify `d:\Travel\kna`.

**Positioning:** Verifiable CBT operating system. Guests book in VND with no wallet; coordinators submit a real Phantom-signed attestation; committee members finalize it through a real Squads 2-of-3 vault on Solana **devnet**. Not a token/payment product.

## Quick start (app only — Solana off)

```powershell
cd d:\Travel\kna-docker
docker compose up --build
```

- Web: http://localhost:8080  
- API: http://localhost:4000  
- Demo login: `coordinator@example.kna` / `changeme123`

## Track 2 stack (optional profile)

```powershell
docker compose -f docker-compose.yml -f docker-compose.solana.yml --profile solana up --build
```

Devnet program is **live**: [`2Ft67fV4…`](https://explorer.solana.com/address/2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f?cluster=devnet). Current real Squads multisig: [`3MAhss…`](https://explorer.solana.com/address/3MAhssMeXQrgzLgxVbvFDBiQbsNKNPBAaATLkyHdhodv?cluster=devnet) with vault [`3yY8ey…`](https://explorer.solana.com/address/3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42?cluster=devnet). Full proof pack: [docs/DEVNET-EVIDENCE.json](docs/DEVNET-EVIDENCE.json) and [docs/TRACK2-SUBMISSION.md](docs/TRACK2-SUBMISSION.md).

Rebuild/redeploy (WSL): `bash scripts/clean-and-build-anchor.sh`

## Architecture (on-chain / off-chain)

```
Guest (VND, no wallet) → Web/API → Postgres (source of truth)
                              ↓ outbox
Coordinator Phantom → submit_attestation → pending PDA
Committee Squads 2/3 → finalize_attestation → final PDA
API reconciler verifies RPC → #community Explorer links
```

## Demo story

1. Guest books in VND, no wallet required.
2. Coordinator opens `#dashboard` and uses Phantom on devnet to sign `submit_attestation`.
3. Committee opens `#review`, exports the Squads proposal payload, collects 2-of-3 approvals, and executes from the Squads vault.
4. KNĂ accepts the finalize signature only after RPC confirmation plus PDA decode match, then exposes the proof on `#community`.

Postgres remains the operational source of truth. Solana is the verifiable notary for settled split records.

## Pre-demo checks

```powershell
cd d:\Travel\kna-docker
.\scripts\pre-demo-checks.ps1
```

This verifies evidence presence, real Squads vault ≠ coordinator, program-id consistency, chain-client tests, API tests, and production builds.

WSL: `bash scripts/pre-demo-checks.sh`

## Key paths

| Path | Purpose |
|------|---------|
| `app/programs/kna-trust-layer/` | Anchor trust program |
| `app/packages/chain-client/` | Hash/PDA/instruction client + IDL |
| `app/apps/api/src/chain/` | Outbox reconciler, gateway, config |
| `app/apps/web/src/wallet/` | Operator Phantom + committee finalize UX |
| `secrets/` | Devnet keypairs (gitignored) |
| `docs/TRACK2-SUBMISSION.md` | Demo + submission checklist |
| `docs/THREAT-MODEL.md` | Threat model |

## Sync from original kna

```powershell
.\sync-from-kna.ps1 -DryRun   # preview
.\sync-from-kna.ps1           # blocked if Solana artifacts exist
```

## Environment

Copy `.env.solana.example` → `secrets/.env.solana`. Set `SOLANA_ENABLED=true` on API for chain routes.

## Git

Repo initialized locally. Push to a **public** GitHub remote before submission (see `docs/UNIHACKFEST-ELIGIBILITY.md`).
