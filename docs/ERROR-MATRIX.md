# kna-trust-layer error matrix

Every guard in `app/programs/kna-trust-layer/src/lib.rs`, the test that proves
it, and what the operator sees today. Tests live in
`app/packages/chain-client/program-tests/trust-layer.test.ts` (LiteSVM against
the built `.so`) unless marked *Rust unit*.

Run them: `.\scripts\program-tests.ps1` on Windows, or
`anchor build && npm run test:program` (from `app/`) on Linux/macOS. CI runs
them in the `anchor-build` job.

## Program errors (`KnaError`)

Anchor numbers custom errors from 6000; Phantom shows them as
`custom program error: 0x…`.

| Code | Hex | Error | Raised by | Proven by |
|---|---|---|---|---|
| 6000 | 0x1770 | `Unauthorized` | `set_paused`, `set_committee_vault`, `grant_role`, `revoke_role` (not the coordinator authority); `submit_attestation`, `cancel_pending` (role is not coordinator, or grant belongs to another wallet); `finalize_attestation`, archive proofs (neither committee vault nor committee member) | grant_role, set_paused, revoke_role by an outsider; submit by a committee member; finalize by the coordinator; finalize by an outsider on the vault path; cancel by a committee member |
| 6001 | 0x1771 | `Paused` | `grant_role`, `submit_attestation`, `finalize_attestation`, `publish_archive_proof` | submit while paused (and accepted again once unpaused); finalize while paused |
| 6002 | 0x1772 | `InvalidRole` | `grant_role` with a role other than 1, 2, 3 | grant role 9 |
| 6003 | 0x1773 | `RoleRevoked` | `submit_attestation`, `cancel_pending`, committee path of `finalize_attestation` and archive proofs | submit by a revoked coordinator; finalize by a revoked committee member |
| 6004 | 0x1774 | `SplitMismatch` | `validate_split` in `submit_attestation`: parts do not sum to the total, or platform / community share is not floor(total × bps / 10 000) | parts not summing; marketplace split 5% / 0%; 3,750 ₫ rounded (263 / 113) rejected while floored (262 / 112) passes; *Rust unit* `rejects_bad_split`, `rejects_parts_not_summing_to_total`, `rejects_overflow_sum` |
| 6005 | 0x1775 | `InvalidState` | `finalize_attestation` on a non-PENDING attestation; `cancel_pending` on a non-PENDING attestation; `acknowledge_receipt` with a mismatched ledger hash | finalize after cancel; cancel after finalize |
| 6006 | 0x1776 | `AlreadyExists` | Never raised. Replays are stopped by Anchor `init` instead (below). | — |
| 6007 | 0x1777 | `Overflow` | `validate_split` bps multiplication. Unreachable in practice: u64 × u16 always fits in u128. | *Rust unit* `booking_split_1m_vnd`, `floor_split_small_total`, `zero_total_ok` cover the arithmetic |

## Anchor and runtime guards

| Guard | What it stops | Proven by |
|---|---|---|
| `init` on `config` | A second `initialize_config` taking over authority | second initialize_config fails (`already in use`) |
| `init` on the pending PDA `["pending", hash(ledgerId)]` | Submitting the same ledger entry twice | second submit fails (`already in use`) |
| `init` on the final PDA `["final", hash(ledgerId)]` | Double settlement: finalizing twice, by the same or another signer | member finalizes, then the vault's finalize fails (`already in use`) and the first finalization stands |
| Role PDA must exist (`AccountNotInitialized`, 3012) | A wallet with no grant submitting | submit by a wallet with no grant |
| Optional `committee_role` + vault check | Vault path works without a role grant; nobody else can use it | finalize by the vault with no role account; outsider on the same path gets `Unauthorized` |

## What the operator sees

Nothing in the API or web decodes these codes yet. A failed Phantom signature
shows the raw hex (e.g. `0x1774`), and the API only learns the attestation
never landed when it reconciles. Worth mapping in `AttestationPanel` before a
live demo: `0x1771` → "Program is paused", `0x1773` → "Your role was revoked",
`0x1774` → "Split does not match the booking schedule".

## Compute units

The test run prints the maximum compute units per instruction (LiteSVM,
program built 2026-09-23). This is input for `docs/BENCHMARK.md` (Phase 6), not a
devnet measurement:

| Instruction | Max CU |
|---|---|
| `submit_attestation` | 20,663 |
| `finalize_attestation` (committee member) | 20,512 |
| `grant_role` | 18,922 |
| `finalize_attestation` (vault) | 13,911 |
| `initialize_config` | 9,133 |
| `cancel_pending` | 8,542 |
| `revoke_role` | 5,785 |
| `set_paused` | 3,808 |
