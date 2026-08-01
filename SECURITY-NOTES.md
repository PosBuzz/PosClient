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

Both are `overrides` entries pinning a transitive dependency past a vulnerable range.
Remove them once the parent package ships the fix upstream.

| Project | Override | Reason |
| --- | --- | --- |
| `backend` | `uuid: $uuid` (^11.1.1) | `exceljs@4.4.0` pins `uuid@^8.3.0` ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). `exceljs` only uses `const {v4} = require('uuid')`, unchanged in v11; verified by writing a workbook that exercises the conditional-formatting path. |
| `consumer` | `sharp: ^0.35.3` | `@vite-pwa/assets-generator@1.0.2` pins `sharp@^0.33`, which inherits libvips CVEs. Dev-only (the `generate-pwa-assets` script); not part of the Docker build. Verified by running the generator against sharp 0.35.3. |
