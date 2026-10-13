# Owner actions for the final safety-net gates

These repository/account actions remain pending. Implementation, local tests and PR CI do not
prove branch protection, credential revocation or a successful first nightly run.

## Credentials (KI-088, high priority)

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

The prepared policy requires an up-to-date `All checks` status and applies to administrators.
It uses zero required approvals because the sole code owner cannot approve their own PR.
If a second reviewer is available, choose one required approval instead before applying it.

Save this JSON as `/tmp/posbuzz-main-protection.json`:

```json
{
  "required_status_checks": { "strict": true, "contexts": ["All checks"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "require_code_owner_reviews": false
  },
  "restrictions": null
}
```

```sh
gh api --method PUT repos/PosBuzz/PosClient/branches/main/protection \
  --input /tmp/posbuzz-main-protection.json
gh api repos/PosBuzz/PosClient/branches/main/protection \
  --jq '{strict: .required_status_checks.strict, contexts: .required_status_checks.contexts, enforce_admins: .enforce_admins.enabled}'
```

Record the applied policy, actor and evidence in DECISIONS.md.

## Throwaway proofs

Use a separate temporary worktree and branch; never introduce deliberate failures on
`fix/known-issues` or `main`. Open a draft throwaway PR with one deliberately false normal test.
Wait for `All checks` to fail, verify GitHub reports the required-check merge block, then close
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
