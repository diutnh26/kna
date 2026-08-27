# Secrets (local only — never commit)

Store devnet keypairs and RPC keys here. This folder is gitignored except this README.

## Expected files (create locally)

| File | Purpose |
|------|---------|
| `coordinator-keypair.json` | Coordinator wallet for attestation submit |
| `committee-1-keypair.json` | Squads member 1 of 3 |
| `committee-2-keypair.json` | Squads member 2 of 3 |
| `committee-3-keypair.json` | Squads member 3 of 3 |
| `deploy-keypair.json` | Program deploy authority (keep offline after deploy) |
| `guest-demo-keypair.json` | Optional guest receipt demo |
| `.env.solana` | Copy from `.env.solana.example` with real values |

## Generate wallets (WSL / Ubuntu)

```bash
cd /mnt/d/Travel/kna-docker
./scripts/setup-devnet-wallets.sh
```

## Helius (optional)

Add `HELIUS_API_KEY` to `.env.solana`. Public devnet RPC works as fallback.

## CI / Render

Use the platform secret store — never paste keypairs into env vars in compose files committed to git.
