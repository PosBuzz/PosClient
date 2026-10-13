# Owner actions for the final safety-net gates

These repository/account actions remain pending. Implementation, local tests and PR CI do not
prove credential revocation or a successful first nightly run.

## Credentials (KI-088)

Update 2026-10-14: the owner confirmed the historical JWT is already rotated, and that the `pull.sh` token and the tracked `.env.docker` files are intentional (D-067). The repository is public; no history rewrite is planned. The text below is the original recommendation and is kept for reference.

Revoke the GitHub personal access token used by `pull.sh` first. Rotate/revoke the historical JWT,
GCP API key and Kubernetes credentials as applicable. Record completion without copying values
into issues, logs or this document. Replace the token URL in `pull.sh` with an SSH remote using a
repository-scoped, read-only deploy key, or a narrowly scoped credential supplied from the deployment
environment. Never embed the replacement in Git. History cleanup, if chosen, needs coordination
with everyone holding clones; it does not replace revocation.

The deploy workflow currently checks the dispatched SHA but `pull.sh` pulls the latest `main`.
Checking out the exact approved SHA on the VM is a separate owner decision; the current gate
does not guarantee that an older green dispatch deploys that older revision.

## Required status on main

Dropped (D-065): branch protection is not available to this repo.

## Throwaway proofs

Use a separate temporary worktree and branch; never introduce deliberate failures on
`fix/known-issues` or `main`. Open a draft throwaway PR with one deliberately false normal test.
Wait for `All checks` to fail, verify the failure is reported, then close
the PR and remove the temporary branch/worktree. Do not actually attempt a merge.

For the deploy proof, add a temporary unconditional failure immediately after the unchanged
`Require green CI for this commit` step and before the SSH step on that throwaway branch.
This prevents deployment even if the gate regresses. Dispatch the red branch:

```sh
gh workflow run deploy-backend.yml --repo PosBuzz/PosClient --ref test/safety-gate-red
gh run list --repo PosBuzz/PosClient --workflow deploy-backend.yml --branch test/safety-gate-red
```

Evidence must show failure in the green-CI gate itself, with the temporary stop and SSH steps
both skipped. A failure only in the temporary stop does not prove the gate. Close/delete the
throwaway artifacts after collecting evidence.

## First nightly run

After the final implementation is pushed, dispatch its branch and inspect every job:

```sh
gh workflow run nightly.yml --repo PosBuzz/PosClient --ref fix/known-issues
gh run list --repo PosBuzz/PosClient --workflow nightly.yml --branch fix/known-issues
gh run view RUN_ID --repo PosBuzz/PosClient --json status,conclusion,jobs
```

GitHub may require the workflow to exist on the default branch before it can be dispatched.
If so, record that concrete blocker; a local run does not count as a successful nightly.
Record the run and any generated finding issue in DECISIONS.md. Do not tick X3 beforehand.

## Dependency and license proofs

X-DEP-001/002 are exercised by the production-audit evaluator and its scoped-exception regression
tests. X-DEP-004 has an immutable-lockfile step after installation; prove rejection of an intentional
lockfile change on the throwaway branch. X-DEP-005 configuration covers weekly npm updates for all
three apps and weekly GitHub Actions updates; confirm the repository's Dependabot update UI/runs.

X-DEP-003 remains an owner policy decision: D-017 currently chooses **no license restrictions**,
and `.github/dependency-review-config.yml` consequently has no `deny-licenses`. Do not invent a
denied-license policy or claim its proof has passed. Choose the denied SPDX identifiers, confirm
GitHub dependency review is available for this repository, then enable
`DEPENDENCY_REVIEW_ENABLED=true` and prove both a deliberately vulnerable dependency and an
explicitly denied license are blocked on throwaway PRs. Remove those deliberate dependencies
after collecting evidence. Record the chosen policy and proofs in DECISIONS.md.
