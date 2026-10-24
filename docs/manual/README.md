# User manuals

Two end-user manuals, written in Markdown and built into PDFs that ship inside the apps.

| Manual | Source | PDF (committed, served by the app) | Download link |
|---|---|---|---|
| Shop App (consumer) | `docs/manual/consumer/*.md` | `consumer/public/manual/PosBuzz-Shop-App-Manual.pdf` | Book icon in the top bar |
| Admin Panel | `docs/manual/admin/*.md` | `admin/public/manual/PosBuzz-Admin-Manual.pdf` | Book icon in the top bar |

Screenshots live in `docs/manual/images/<app>/` and are referenced from the Markdown as `images/<app>/<name>.png`.

## Updating a manual

1. Edit the Markdown (chapters are joined in file-name order) and, if a screen changed, replace its screenshot.
2. `cd docs/manual && npm ci && npm run build` rewrites both PDFs (needs a Playwright Chromium: `npx playwright install chromium`).
3. Commit the Markdown, images and PDFs together. `npm run check` fails if a PDF is older than its sources.

Change a screen, a button label or a message in an app and the matching chapter should change in the same pull request.

## Taking screenshots

Run the stack from `docker-compose.e2e.yml` (see `e2e/scripts/prepare.mjs`), load demo data, and capture with Playwright at 1280 px (desktop) and 390 px (phone) wide. Keep scripts out of git.
