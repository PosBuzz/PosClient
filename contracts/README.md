# contracts/

Single source of truth wherever two PosBuzz apps must agree. Backend and consumer both test against
the files here, so a change on either side fails on the side that drifted.

- `fixtures/` is hand-written and reviewed like code.
- `generated/` is written by tests run with `UPDATE_CONTRACTS=1`, then committed. Never edit by hand.

See `docs/SYSTEM.md` (section 4, cross-layer contracts).

- `responses/` is generated over backend HTTP on an isolated canonical scenario; business dates retain their actual meaning.
- `requests/` records browser page mutations and is replayed over backend HTTP with fresh data and domain invariants.
- `consumer/src/test/contract-types.ts` and the admin counterpart are generated from reviewed responses by `node scripts/contracts/generate-response-types.mjs`. Never edit these copies by hand. Both app typechecks and CI run the generator with `--check` before compiling the assignments.

When changing a response: regenerate and review the backend response recording, regenerate the type-check copies, then run frontend typecheck and page tests. When changing a browser request: regenerate its recording through the real page test, then run the backend request replay. A successful UI mock alone is not cross-layer verification.
