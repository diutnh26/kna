# Evidence — QR → Demo token (updated after live Devnet mint)

## Live evidence already on Devnet

| Role | Pubkey | Amount | Explorer tx |
|------|--------|--------|-------------|
| Guest (your Phantom) | `5J9ixFxaUBe1bNDxPec67shUjRce831GgAyoE1Ygyu8V` | 1 dKNA | https://explorer.solana.com/tx/5FVUH2oqxt4JsfKyaMuT9s6tohkjdEe452uUAx4oK1UBj5QskHxVVbrYeiLgdcpPaX4VyiLHzZ3zbkmVmwwf8LjV?cluster=devnet |
| Provider (demo) | `ACP16wSVq6au2wjdyQJLren8HY1bKa5Xfiq4majUfuf7` | 900 dKNA | https://explorer.solana.com/tx/62kAP1jQ57k1P69K1fxFToPDfjD12hJSi4hy8Y2EHcxLatB3ZUuobmusi4c75LXqgsnquR7U3SRF3d5tGm6Rh6No?cluster=devnet |
| Community vault | `3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42` | 30 dKNA | https://explorer.solana.com/tx/43jyFU1zE7MVUNZ5jVN3jUWXE1mhEQquLBKjPmV6rdN8N5dgsU7ETTVK7cZNiHAMEqDDJyUj293TUPySJdo3yoLV?cluster=devnet |

**Mint:** `6yASZNZd9qTwfBv5Ay61RsGvcTzftZkPxZCHgJ97bf7N`  
https://explorer.solana.com/address/6yASZNZd9qTwfBv5Ay61RsGvcTzftZkPxZCHgJ97bf7N?cluster=devnet

Full JSON: `secrets/demo-token-evidence.json` (gitignored).

## UI where to look

| Screen | What |
|--------|------|
| **Travel** — “Where the money goes” | Demo wallet panel (guest / provider / community / mint) |
| **Account** | Link Phantom + same wallet panel + activity Explorer after PAID |
| **Community** | Wallet panel + Postgres VND ledger (not the same as mint txs) |

## Docker

```bash
cd d:\Travel\kna-docker
docker compose up --build -d
```

Loads `secrets/.env.demo-token` + `secrets/.env.solana`.

Phantom: switch to **Devnet**, open Tokens — may need to add custom token mint `6yASZNZd9qTwfBv5Ay61RsGvcTzftZkPxZCHgJ97bf7N` to see 1 dKNA.
