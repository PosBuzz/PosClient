# Admin (Super-admin) App Testing Plan

Master plan, conventions and the decision playbook live in `../../../docs/testing/`.

## Current state (2026-10-12)
- React 19, Vite 6.4.3, antd 5, TanStack Query 5, zustand 5. ~6.8k lines. **No tests.** Lint and tsc are green.
- `src/api/axiosInstance.ts` is a near copy of the consumer's (same CSRF/refresh logic, admin
  endpoints). `src/api/http.ts` wraps get/post/patch/delete.
- Pages: consumers (incl. data import modal), plans, billings, roles, users, support,
  backup&restore, account&security, home, login, `test`.
- **Out of scope:** `src/pages/portfolio/*` (the portfolio CMS editor), consistent with the
  project-wide exclusion of portfolio. Adding smoke tests later costs about an hour using the A2 pattern.

What the admin controls that affects other apps:
- **Plans → permissions** a tenant can have. Consumer menus/routes and backend `PermissionsGuard` all depend on this.
- **Consumers** (create, soft delete, data import between tenants). Tenant lifecycle.
- **Billing** periods/invoices.

## Phases
| Phase | Doc |
|---|---|
| A1 | `phase-1-test-harness.md` |
| A2 | `phase-2-admin-tests.md` |

Admin backend logic is tested in backend B3 §8 (BE-ADM-*) and B5 (admin routes in the
permission matrix). These phases cover the admin **UI** and its contract with the backend.
