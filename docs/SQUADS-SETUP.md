# Squads v4 — Committee 2-of-3 on Devnet

## Setup

1. Preferred path: run `npx tsx src/scripts/setup-squads-vault.ts` from `app/apps/api`
2. That script creates the devnet Squad multisig using `committee-1/2/3-keypair.json`, funds members if needed, writes `secrets/squads-devnet.json`, and syncs `KNA_COMMITTEE_VAULT`
3. If you use the UI manually instead: open [Squads](https://devnet.squads.so/) on **devnet**, create a Squad with the 3 committee pubkeys from `secrets/PUBKEYS.txt`, threshold **2 of 3**, then copy the vault address into `secrets/.env.solana`
4. Re-run `bash scripts/init-governance.sh` or `npx tsx src/scripts/init-governance.ts` so on-chain `config.committee_vault` matches

## Current devnet Squad

- Multisig PDA: `3MAhssMeXQrgzLgxVbvFDBiQbsNKNPBAaATLkyHdhodv`
- Vault PDA: `3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42`
- Threshold: `2 / 3`
- Members: `committee-1`, `committee-2`, `committee-3`
- Machine-readable copy: `docs/SQUADS-DEVNET.json`

## Demo finalize flow

1. Coordinator has submitted `submit_attestation` (pending PDA exists)
2. On `#review`, committee opens **Export Squads proposal**
3. Create a Squads vault transaction that invokes KNĂ `finalize_attestation` with the Squads vault as authority (optional committee role account omitted)
4. Create proposal for that vault transaction
5. Two members approve → one member executes
6. Copy executed transaction signature → **Record finalize sig**
7. API calls RPC, decodes final PDA, only then marks `FINALIZED`

## API helpers

- `GET /chain/awaiting-committee` — queue
- `GET /chain/ledger/:id/finalize-ix?authority=<vault-or-member>` — instruction accounts + data
- `GET /chain/ledger/:id/squads-proposal?multisigPda=<optional>` — finalize payload + vault validation
- `POST /chain/ledger/:id/finalize` `{ finalizeTxSig }` — verifies on-chain before DB update

## Notes

- Do **not** use `--final` on program deploy during hackathon
- Upgrade authority may move to Squads after demo stability review
- Single committee keypath remains available for local tests (`includeCommitteeRole=true`)
- Current evidence uses this Squads vault. Do not finalize with the coordinator key.
- Backup if Squads UI fails: export `GET /chain/ledger/:id/squads-proposal`, execute the vault transaction elsewhere, paste the executed signature into KNĂ.
- API helpers: `GET /chain/ledger/:id/finalize-ix`, `GET /chain/ledger/:id/squads-proposal`, `@sqds/multisig` via `apps/api/src/chain/squads.ts`
