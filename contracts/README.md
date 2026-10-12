# contracts/

Single source of truth wherever two PosBuzz apps must agree. Backend and consumer both test against
the files here, so a change on either side fails on the side that drifted.

- `fixtures/` is hand-written and reviewed like code.
- `generated/` is written by tests run with `UPDATE_CONTRACTS=1`, then committed. Never edit by hand.

See `docs/testing/phase-X1-cross-layer-contracts.md`.
