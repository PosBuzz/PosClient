# Security notes

Dependency-audit decisions and the reasoning behind the overrides in use. Re-check them whenever dependencies are upgraded.
Edge and server security (Cloudflare, nginx, firewall, secrets) is described in [`OPERATIONS.md`](OPERATIONS.md) and
[`../deploy/README.md`](../deploy/README.md).

## Current state (2026-10-16)

- `npm audit` (including dev dependencies) reports **0 vulnerabilities** in backend, consumer, admin and portfolio.
- CI gates the production dependencies of all four apps at high and above (`scripts/check-production-audit.mjs`). There are no audit exceptions:
  `.github/audit-exceptions.json` is empty.
- GitHub Dependabot alerts are on (notifications only). Version-update and security-update PRs are off on purpose, so nothing opens PRs on its own.
- The backend Docker image installs production dependencies only (`npm ci --omit=dev`). `prisma` is a real dependency because the container runs
  `prisma migrate deploy` at start.
- Backend tests run on Jest 30, which no longer uses `micromatch`/`braces` (braces GHSA-vfj7-8cjw-p6xm has no patched release).

## Overrides in use

Overrides install patched or compatible versions of transitive dependencies. They are not audit exceptions. Check them with `npm ls <package>` and
remove the ones the upstream package has outgrown.

| App | Override | Why |
|---|---|---|
| backend | `uuid: $uuid` | `exceljs` still requests an old `uuid` (GHSA-w5hq-g745-h8pq); pins the patched one the app depends on |
| backend | `typed-rest-client` -> `qs ^6.16.0` | Stryker's REST client bundles a vulnerable `qs` (GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g); dev tooling only |
| backend | `@istanbuljs/load-nyc-config` -> `js-yaml ^4.3.2` | Drops `argparse`/`sprintf-js` (GHSA-hp3w-g68c-fv3c, no patched release); that package only reads an nyc config this project does not have |
| consumer | `typed-rest-client` -> `qs ^6.16.0` | Same as backend (Stryker) |
| consumer | `sharp ^0.35.5` | The PWA asset generator requests an older `sharp`; floor covers GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w |
| portfolio | `sharp ^0.35.5` | Same sharp advisories (used by Next image handling) |
| portfolio | `postcss: $postcss` | Next 15.5.x pins `postcss` 8.4.31, which is affected by several PostCSS advisories (e.g. GHSA-qx2v-qp2m-jg93, GHSA-r28c-9q8g-f849) |

## Re-checking

```bash
cd <app> && npm audit                      # everything, including dev dependencies
cd <app> && npm audit --omit=dev           # what CI gates
node --test scripts/check-production-audit.test.mjs   # the CI gate's own tests
```

Notes that stay true: `react-router` / `react-router-dom` (consumer, admin) must stay on 7.18.2 or newer (GHSA-qwww-vcr4-c8h2); portfolio must stay on
Next 15.5.27 or newer (earlier 15.x releases have RCE and cache-poisoning advisories); upgrading Next or Jest/Stryker is the moment to re-test the overrides.
