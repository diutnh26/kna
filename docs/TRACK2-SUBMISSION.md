# Track 2 — Submission & Demo Pack

## Positioning (one line)

> **Verifiable operating system for Ê Đê community tourism** — guests pay in VND; households and the community fund receive a transparent 7/3/90 split; anyone can verify settled amounts on Solana **devnet**. Solana is a notary, not a payment rail.

## Devnet evidence (live)

All Explorer URLs below are the judge-facing proofs. Machine-readable copy: [DEVNET-EVIDENCE.json](./DEVNET-EVIDENCE.json). Squads metadata: [SQUADS-DEVNET.json](./SQUADS-DEVNET.json).

| Item | Value |
|------|-------|
| Cluster | `devnet` |
| Program ID | `2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f` |
| Program Explorer | https://explorer.solana.com/address/2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f?cluster=devnet |
| Deploy tx | https://explorer.solana.com/tx/2zu5VkBki6q9hmYUyiVDepS5KqjrZUsRRJydtDKd1s5AX5mSCu5RUuZngR9tYYRTUaM9CmkCkmS4GkTLJ1z8vCMa?cluster=devnet |
| Config PDA | `AXKpJh38a52BWnnw97ovN3zYcFdhq7f4UHKBkXCsmrtg` |
| Initialize tx | https://explorer.solana.com/tx/PecFU386bH2bcVPW6sAZXfMxQQu6kTPcVKTsvUpfsKNx9pb5LUZrAAzMjamoPZKCv3MaWx7sy9nmLPDcMo1vGe3?cluster=devnet |
| Grant coordinator tx | https://explorer.solana.com/tx/3zh8Hsw1r5biHTpZkoTdg3y9dAP7Ydrpz9gTW9JTvLCkTf1kLbHiXDoZLBYs9Vy9UV3ohbitL9GyvMTRYUiL6YkT?cluster=devnet |
| Set committee vault tx | https://explorer.solana.com/tx/ZQ64hAPKK93xdDCR7m58rmPJbDqutyQz5JevSvfEDwMqcv6vzt25uvW6yjfz3uwmumGjv8EmCepSLat3YurJRaq?cluster=devnet |
| Squads create tx | https://explorer.solana.com/tx/5BuhGC2F8nkCSokbSRDCHYvsRFAWLmcp9ivhZLbWkW6AdjKM5DXXa84ZMpPucGhDk4h6bm4Ezo9nmcLU7o3AFUHN?cluster=devnet |
| Squads multisig PDA | https://explorer.solana.com/address/3MAhssMeXQrgzLgxVbvFDBiQbsNKNPBAaATLkyHdhodv?cluster=devnet |
| Squads vault PDA | https://explorer.solana.com/address/3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42?cluster=devnet |
| Demo pending PDA | https://explorer.solana.com/address/4FiuZEavPqCnPtntS4oYTfSdsYgbA7irZ5YdzNrqVXpd?cluster=devnet |
| Demo submit tx | https://explorer.solana.com/tx/dsxVtsErhpREWSpcNa3KAaA5N3P8iXxFe1VRGwt7sBKeMF6tV2twbMAxin36zBkQpdMA7eyNKtY1gQ6q4MsafEy?cluster=devnet |
| Vault tx create | https://explorer.solana.com/tx/5LxrJtqrW8w3NDYsJmMMD2REvJpScnASQakdrrp9E2gbrih9SECR8YwZYMkvP3ACnRsfA26RXVFTKqQQFpj2x2hk?cluster=devnet |
| Proposal create | https://explorer.solana.com/tx/DDBAZmJncHUVTNCXBspCiMSK4jTyDeAS2x8YiYinUSkF4sGPmEZFek4hscQy7TfC8efUrPdBzQfWiQMT4sMs1kx?cluster=devnet |
| Approval 1 | https://explorer.solana.com/tx/2bugpzVWm5sZURHNLg1TqfNvFWpDJXu9EBQc9mdStPwgRVKThLy96ENQXAMdwWNCcmZpC5DMX6HS6mkY4ePLnPrS?cluster=devnet |
| Approval 2 | https://explorer.solana.com/tx/2aHSLPJjtmmvowCcuWnKaSowuGJFHDEd6XHmiEKCGy8GyCdVjBD58qk4bagpRBEUEwAg9n6Cr1SRNv13TnsvcfG1?cluster=devnet |
| Demo final PDA | https://explorer.solana.com/address/7jKscYQw2yNnSRhydtRqH1uV65jDPZSv7bAt2q3rvMYp?cluster=devnet |
| Demo finalize (Squads execute) | https://explorer.solana.com/tx/47PaCdXN1AHPS3xDjWRyWXDxEcSVWTEKEVtamTAMbqMKmGB9748EeWZQeNZozkMQrFdW7w473ZHfKY3h5s2YTo7F?cluster=devnet |
| Deploy wallet | `FfNVnqMmVPHYBQCaZdHbteBMpc7TReNsTpocHBRz1u6J` |
| Coordinator | `7bX1dSyzUfxGTr4KshrPYZy3vzKZJNh6aUn7Gt2yg37g` |
| Committee vault | `3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42` (≠ coordinator) |

## Demo script (4 minutes)

1. **Guest** — book on Travel with VND/manual payment, **no wallet**
2. **Coordinator** — `#dashboard` → Phantom (devnet) → confirm booking → **Sign & submit** real `submit_attestation`
3. **Committee** — `#review` → export Squads proposal → 2-of-3 approve → execute → paste signature → API verifies final PDA by RPC + decode
4. **Public** — `#community` ledger shows proof + Explorer links matching 7/3/90
5. **Resilience** — stop RPC; booking + web ledger still valid; outbox reconciler retries later

**Backup if Squads UI fails:** export `GET /chain/ledger/:id/squads-proposal`, execute from [SQUADS-SETUP.md](./SQUADS-SETUP.md), paste the executed tx signature into KNĂ.

## Artifacts checklist

- [ ] Public GitHub repo with commit history
- [x] Program deployed on devnet + IDL discriminators in `app/packages/chain-client/idl/`
- [x] Evidence JSON (public txs/PDAs only) matching this document
- [x] CI workflow present (`.github/workflows/track2-ci.yml`) — run `scripts/pre-demo-checks.ps1` before demo
- [ ] 60–90s backup video
- [x] Architecture diagram (in README)
- [x] [Threat model](./THREAT-MODEL.md)
- [ ] BTC eligibility email saved
- [x] Squads vault pubkey filled in `secrets/.env.solana`

## What CI covers vs what is manual

**Automated (CI / pre-demo script):** program-id consistency, chain-client tests, API tests including fake-signature and finalize PDA mismatch rejects, web tests with a single Vitest worker, web production build (`VITE_API_URL` required), API build, mainnet hard-fail, secret scan, Anchor SBF `--no-idl`.

**Manual:** Phantom signing in the browser, Squads UI (scripted 2-of-3 path exists at `demo-squads-finalize.ts`), public GitHub push, live RPC during the 4-minute demo.

## Deploy commands (WSL)

```bash
cd /mnt/d/Travel/kna-docker
bash scripts/clean-and-build-anchor.sh
cd app/apps/api
npx tsx src/scripts/setup-squads-vault.ts
npx tsx src/scripts/init-governance.ts
npx tsx src/scripts/demo-submit-attestation.ts
npx tsx src/scripts/demo-squads-finalize.ts
```

Do **not** run `demo-finalize-attestation.ts` — that bootstrap path is retired.

## Staging (Docker + Solana profile)

```powershell
cd d:\Travel\kna-docker
.\scripts\pre-demo-checks.ps1
docker compose -f docker-compose.yml -f docker-compose.solana.yml --profile solana up --build
```

Base stack (no Solana): `docker compose up --build` — unchanged.

## Engineering metrics (safe to claim)

- Finalized attestations with verified Explorer links (see evidence above)
- Committee vault is a Squads 2-of-3 PDA, not the coordinator
- Zero hash discrepancy between Postgres settled row and on-chain PDA (API verifies before state flip)
- Outbox recovery after RPC outage (worker is reconciler-only)
- Mock signatures (`mock_*` / `devnet_*`) rejected by API and chain-client
