# Threat model — KNĂ Solana trust layer (Track 2)

## Assets
- Settled ledger amounts and 7/3/90 split claims
- Coordinator / committee role grants
- Guest booking data (Postgres only — never on-chain PII)
- Program upgrade authority (deploy keypair, optionally Squads later)

## Trust boundaries
| Zone | Trust |
|------|-------|
| Guest browser | Untrusted |
| Coordinator Phantom | Semi-trusted operator |
| API + Postgres | Operational source of truth |
| Solana program | Append-only notary for settled splits |
| Public RPC | Availability risk, not authority over DB |

## Threats & mitigations

| Threat | Mitigation |
|--------|------------|
| PII leakage on-chain | Only hashes + amounts; provider labels hashed with domain separation |
| Malicious client posts fake sig | API rejects `mock_`/`devnet_` patterns; RPC confirmation + PDA decode required |
| Replay / wrong ledger | PDA seeds = ledger hash; content hash recomputed server-side from settled rows |
| Wrong program / wrong cluster | Program ID pinned; mainnet hard-fail; Phantom network guard |
| Compromised coordinator | Role grant required; committee must finalize; pause switch |
| Committee collusion | Squads 2-of-3; vault path preferred over single committee key |
| RPC outage | Booking/ledger remain in Postgres; outbox retries; no booking rollback |
| Upgrade authority abuse | Devnet only; no `--final`; optional transfer to Squads post-demo |
| Explorer theater | Links only for verified signatures |

## Non-goals
- Crypto payments, tokens, NFTs, RWA
- On-chain guest identity
- Mainnet
