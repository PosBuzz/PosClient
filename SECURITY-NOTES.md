# Security notes

Accepted `npm audit` findings and the reasoning behind them. Re-check these whenever
dependencies are upgraded.

## Accepted: react-router RSC-mode CSRF bypass

- **Advisory:** [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) (high)
- **Affected:** `react-router` 7.12.0 – 8.2.0, via `react-router-dom`
- **Present in:** `admin`, `consumer` (currently `react-router-dom@7.18.2`)
- **Accepted on:** 2026-08-01

**Why it is not exploitable here.** The advisory concerns React Router's RSC mode, where a
server action can execute before the framework returns a 400. Both `admin` and `consumer`
are static SPAs: they build to plain assets and are served by nginx, with no React Router
server, no RSC, and no data-router routes. A grep of both `src` trees finds no
`createBrowserRouter`, no route `loader`/`action`, and no `@react-router/serve`. Routing is
purely client-side (`BrowserRouter`, `Link`, `Navigate`, `Outlet`, `useNavigate`,
`useParams`, `useLocation`, `useRoutes`, `useSearchParams`). The vulnerable code path does
not exist in either deployment.

**Why it is not simply patched.** The only fixed version is `react-router@8.3.0`. There is
no `react-router-dom` v8 — the package was consolidated into `react-router` — so upgrading
means rewriting every `react-router-dom` import across both apps (61 sites) and raising the
React floor from 19.2.4 to >= 19.2.7. That is a major framework migration with real routing
regression risk, taken on for a vulnerability that cannot be triggered by these apps.

**Revisit if** either app adopts RSC, server actions, a data router
(`createBrowserRouter` with `loader`/`action`), or any server-side React Router rendering.
At that point the upgrade to `react-router@8.3.0`+ becomes required, not optional.

## Applied overrides

Each is an `overrides` entry pinning a transitive dependency past a vulnerable range.
Remove them once the parent package ships the fix upstream.

| Project | Override | Reason |
| --- | --- | --- |
| `backend` | `uuid: $uuid` (^11.1.1) | `exceljs@4.4.0` pins `uuid@^8.3.0` ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). `exceljs` only uses `const {v4} = require('uuid')`, unchanged in v11; verified by writing a workbook that exercises the conditional-formatting path. |
| `consumer` | `sharp: ^0.35.3` | `@vite-pwa/assets-generator@1.0.2` pins `sharp@^0.33`, which inherits libvips CVEs. Dev-only (the `generate-pwa-assets` script); not part of the Docker build. Verified by running the generator against sharp 0.35.3. |
| `portfolio` | `postcss: $postcss` (^8.5.26) | `next@15.5.23` pins `postcss@8.4.31`, which carries four advisories ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849)). The override dedupes it onto the 8.5.26 that `@tailwindcss/postcss` already resolves, so one patched copy serves both. Verified with a full `next build`. |
| `portfolio` | `sharp: ^0.35.3` | `next@15.5.23` pins `sharp@0.34.5`, which inherits the libvips CVEs ([GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)). Matches the pin already used by `consumer`. Verified with a full `next build`. |

**Why not upgrade Next instead.** Both advisories are only fixed upstream in `next@16.3.1`;
every 15.x release is in the vulnerable range. Next 16 is a major with breaking changes
(and this app is on 15.5.23), so the overrides carry the patched transitive versions until
the Next 16 upgrade is planned on its own. `npm audit` reports 0 vulnerabilities in
`portfolio` with them in place. **Revisit when** the app moves to Next 16 — drop both
overrides then and re-audit.

