# Pitch notes — Track 2 (4 minutes)

## Opening
When a guest asks “did my money reach the household and the community fund?”, Facebook cannot answer and Booking.com will not show the split. KNĂ answers on the web, and Solana lets anyone verify the settled split without asking the guest to touch crypto.

## Beats
1. Problem — OTA margin + opaque splits + community excluded from content decisions
2. Product — guest books in VND, no wallet; coordinator confirms; public ledger
3. Trust layer — coordinator uses Phantom to sign `submit_attestation`; committee uses a real Squads 2-of-3 vault to execute `finalize_attestation`; anyone verifies Explorer links plus PDA decode
4. Business — guests/tour operators pay; 7% platform / 3% fund / 90% household
5. Honest status — Postgres is the operational source of truth; Solana is the verifiable notary for settled revenue splits; pilot not claimed as traction
6. Ask — mentors for Squads ops + DMC intro; not token investment

## Primary demo path
1. Show a guest booking flow in VND with no wallet.
2. Show coordinator on `#dashboard` signing the pending attestation with Phantom.
3. Show committee on `#review` exporting the Squads proposal payload, approving 2-of-3, and executing from the vault.
4. Paste the executed signature back into KNĂ and open `#community` to show the matching Explorer proof.

## Backup demo path
If the Squads UI misbehaves, use the exported proposal payload from KNĂ, prove the multisig/vault match from [SQUADS-DEVNET.json](./SQUADS-DEVNET.json), execute externally, and paste the executed tx signature back into KNĂ for RPC verification.

## Closing
We are not tokenizing the buôn. We are giving the buôn a receipt the province can audit.

## Live proof (devnet)
Program `2Ft67fV4…` is deployed; the live Squads multisig and the submit/finalize evidence are in [DEVNET-EVIDENCE.json](./DEVNET-EVIDENCE.json) and [SQUADS-DEVNET.json](./SQUADS-DEVNET.json).

## MUST NOT say
Web3 hóa Tây Nguyên · community token · NFT homestay · crypto payments · mainnet
