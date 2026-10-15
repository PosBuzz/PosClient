# PosBuzz

A multi-tenant point-of-sale system for shops in Bangladesh: sales, inventory, returns, payments, reports, billing and a
super-admin console. Business time zone `Asia/Dhaka`, currency BDT.

| | Production | Staging |
|---|---|---|
| App (POS) | https://posbuzz.xyz | https://posbuzz.cloud |
| Admin console | https://admin.posbuzz.xyz | https://admin.posbuzz.cloud |
| API | https://api.posbuzz.xyz/api/v1 | https://api.posbuzz.cloud/api/v1 |
| Website | https://portfolio.posbuzz.xyz | https://portfolio.posbuzz.cloud |
| Git branch | `main` | `staging` |

## What is in this repository

| Folder | What | Stack |
|---|---|---|
| `backend/` | REST API (`/api/v1`) | NestJS, Prisma, PostgreSQL |
| `consumer/` | The POS app shops use (installable PWA) | React, Vite, Tailwind |
| `admin/` | Super-admin console | React, Vite, Ant Design |
| `portfolio/` | Marketing / SEO website with CMS content | Next.js |
| `contracts/` | Response-shape contracts shared by backend and frontends | JSON fixtures |
| `e2e/` | Full-stack browser tests | Playwright |
| `PrintingFromWebToPOSPrinter/` | Windows receipt-printing agent the POS app talks to | C# |
| `ai-service/` | Product-description generator (not deployed) | Python (FastAPI) |
| `deploy/` | Production/staging stack, deploy scripts, nginx, backups, alerts | Docker Compose, bash |
| `docs/` | Documentation (below) | Markdown |

## Run it locally

You need Node.js `>=22.22.1 <23` (`nvm install 22 && nvm use 22`) and a PostgreSQL database.

```bash
git clone https://github.com/PosBuzz/PosClient.git
cd PosClient
npm run setup     # installs dependencies, creates backend/.env from .env.example and asks for your database settings
npm run dev       # backend, admin, consumer, portfolio (and the AI service if its Python venv exists)
```

Each app has a `.env.example` (`backend/`, `consumer/`, `admin/`, `portfolio/`); copy it to `.env` and fill in the values.
Never commit `.env` files or secrets.

## Check your work

```bash
npm run lint:all && npm run typecheck:all   # all three TypeScript apps
npm run test:all                            # backend + consumer + admin + repo guard scripts
```

Backend integration tests need a test database: `docker compose -f docker-compose.test.yml up -d --wait`, then `npm run test:int` in `backend/`.
Details, conventions and the rules for tests (never lower a coverage or mutation threshold to make something pass) are in
[`docs/SYSTEM.md`](docs/SYSTEM.md).

## How changes ship

1. Branch from `staging` and open a pull request **into `staging`**. CI must pass.
2. Merging deploys **staging** (posbuzz.cloud) automatically. Test there.
3. Open a pull request **`staging` into `main`**. Merging deploys **production** (posbuzz.xyz).

Deploys are built and rolled out by GitHub Actions with health checks, automatic rollback and a smoke test. Nobody deploys by hand.

## Documentation

| Document | For |
|---|---|
| [`docs/SYSTEM.md`](docs/SYSTEM.md) | The system in one place: apps, environments, branch flow, CI, test layers and rules, decisions, known issues |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Running the server: log in, deploy and roll back, logs, restore, rotate secrets, troubleshooting |
| [`deploy/README.md`](deploy/README.md) | File-level detail of the deploy, backup, alert and nginx setup, and server recovery |
| [`docs/SECURITY-NOTES.md`](docs/SECURITY-NOTES.md) | Dependency-audit decisions and overrides |
| [`docs/PRINTING_SETUP.md`](docs/PRINTING_SETUP.md) | Setting up receipt printing on a shop computer |
| [`docs/account-data-imports.md`](docs/account-data-imports.md) | Importing account data |
| [`contracts/README.md`](contracts/README.md) | The shared API contracts |
| `CLAUDE.md`, `AGENTS.md` | Instructions for AI coding agents working in this repository |

## Support

For support, email info@posbuzz.com
