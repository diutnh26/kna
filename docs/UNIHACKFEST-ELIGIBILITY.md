# UniHackfest Track 2 — Eligibility & Repo Checklist

## Registration

- [ ] Register **Track 2 + Consumer dApps** on UniHackfest portal
- [ ] Email BTC to confirm KNĂ (pre-existing codebase) is eligible with public "hackathon delta" in `kna-docker`
- [ ] Save BTC reply for submission folder

## This repo (`kna-docker`)

- [x] Independent source tree — does not modify `d:\Travel\kna`
- [x] `.gitignore` excludes secrets, keypairs, `.env`
- [x] `sync-from-kna.ps1` requires confirmation — will not overwrite Solana work
- [ ] Initialize public GitHub repo and push (user action)
- [ ] Program ID + IDL committed after devnet deploy

## Scope boundaries (unchanged)

- VND manual payment — **no crypto payments**
- Solana = trust layer only (attestations, roles, proofs)
- Postgres remains operational source of truth
- Cluster locked to **devnet**

## Submission artifacts (see `docs/TRACK2-SUBMISSION.md`)

- Public repo with commit history
- Live demo URL or Docker instructions
- 60–90s backup video
- Architecture + threat model
- Devnet program ID, Squads vault, test wallet pubkeys (not secret keys)
