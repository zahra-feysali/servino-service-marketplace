# Implementation Status

_Last updated: 2026-11-15 — end of **Phase 3 (Dashboards & business features)**._

## Phases
| Phase | Status |
|---|---|
| 1 — Project foundation | **Complete** (DB-dependent verification BLOCKED) |
| 2 — Core marketplace logic | **Complete** (DB-dependent verification BLOCKED) |
| 3 — Dashboards & business features | **Complete** (DB-dependent verification BLOCKED) |
| 4 — UI/UX, testing, finalization | Not started — waiting for authorization |

## Phase 3 — implemented
**Schema:** `PaymentGateway` gained `WALLET` (migration `20261115100000_payment_gateway_wallet`, generated offline with
`prisma migrate diff --from-schema <phase-2 schema> --to-schema`; not yet applied). No other schema changes were needed.

**Customer dashboard (complete per spec §8):** overview, requests, request details, received offers, comparison,
selection, orders, order details, **address management** (CRUD, default address, used to prefill the request form with
server-side ownership + city check), submitted reviews, notifications, account settings, **support tickets**.

**Provider dashboard (complete per spec §9):** overview (verification state, subscription, wallet), relevant requests
(+ **report problematic request**), request details, submit offer, submitted offers, received orders and status
management, **professional profile**, **skills**, **portfolio** (image upload), **certificates & verification documents**
(upload, private), **offered services**, **service areas**, **verification checklist + submit for verification**,
**subscription** (plans, quotas used/remaining, history, purchase via simulated gateway or wallet, renewal stacking),
**wallet & payments** (simulated top-up, transactions, payment history), **earnings** (completed orders, 6-month chart),
**customer reviews**, notifications, settings, **support tickets**.

**Admin dashboard (complete per spec §10):**
- Users: customers & providers lists (search, filters), user detail (edit name/phone/email; activate / deactivate /
  suspend — not self, not admins), provider verification review (approve / reject with reason / revoke approval,
  per-document approve/reject, private document viewing).
- Services: categories, subcategories, services, dynamic forms (Phase 2).
- Requests & orders: requests list (status, flagged, code search) + detail (answers from snapshot, matched providers,
  offers, history, flag/unflag, cancel open request), offers list, orders list + detail with admin transitions
  (cancel, dispute resolution).
- Subscriptions: plan CRUD/activate/deactivate/delete-if-unused; user subscriptions list with renew (extend N days,
  re-activates expired), cancel (with reason) and "apply expiry" sweep.
- Payments: payment list (status filter, all marked simulated) and wallet transaction history.
- Featured providers (create/edit/delete, placement HOME/CATEGORY/SEARCH, dates, cost, order), review moderation
  (hide/publish with rating recompute), support tickets (list, reply, close/reopen), broadcast notifications
  (all/customers/providers), general site settings (name, support phone/email, request offer window — used by request
  submission and the footer), reports & statistics with Recharts (requests/day, simulated revenue/day, orders by status,
  top services, KPIs).

**Subscriptions:** plans are DB rows (never hard-coded); `Plan` and `Subscription` separate; subscription stores user,
plan, start/end, status (PENDING/ACTIVE/EXPIRED/CANCELLED) and a frozen `planSnapshot`; quotas enforced on the backend
(SQL, Phase 2) — this phase adds purchase/activation, stacking renewals, expiry sweep and admin management.

**Simulated payments:** Payment / Wallet / WalletTransaction used; success and failure both persisted; history visible to
the user and admin; subscription status updated only by the server inside the payment transaction (row-locked, settle
once); simulated payments labelled everywhere (gateway page banner, "شبیه‌سازی" badges, `SIM-` tracking codes).

**Featured providers:** independent of plans; provider, placement, active flag, start/end, cost, order; backend ordering
(`orderProviders`) used by the home page, service pages and `/providers`.

**Public pages added:** `/providers` (discovery, filters by service & city), `/providers/[id]` (approved providers only:
bio, skills, services, areas, portfolio, published reviews with masked names), featured sections on home and service pages.

**Support tickets:** title, category, optional linked order (ownership checked), messages/replies, statuses
(OPEN / ANSWERED / CUSTOMER_REPLY / CLOSED), created/updated dates, admin management; notifications on staff replies.

## Checks (Phase 3)
| Check | Result | Notes |
|---|---|---|
| `npm run lint` | **PASSED** | 0 errors, 0 warnings |
| `npm run typecheck` | **PASSED** | |
| `npx prisma validate` / `generate` | **PASSED** | |
| Migration SQL generation (`migrate diff`) | **PASSED** | `ALTER TYPE "PaymentGateway" ADD VALUE 'WALLET';` — not applied |
| Unit tests (`npm test`) | **PASSED** | **126 tests** in 10 files (20 new: subscription window/expiry/plan schema, payment settle rules, wallet math, top-up validation, verification rules, featured ordering, ticket status, address schema, report buckets, name masking) |
| Integration: `tests/integration/business.int.test.ts` (8 tests) | **BLOCKED** | gateway purchase success/failure & settle-once, wallet top-up + wallet purchase + stacking, expiry, verification workflow, featured ordering, ticket ownership/status, review hide → rating recompute |
| Integration: marketplace (10) + auth (5) | **BLOCKED** | |
| `npm run build` | **PASSED** | 51 pages + route handlers, no warnings (fixed a build-time DB query in the footer) |
| Production smoke test (no DB) | **PASSED** (partial) | all new dashboard pages and `/payment/<id>` redirect anonymous users to login; document files 401 anonymous; upload endpoint 401 anonymous / 403 cross-origin |
| `prisma migrate dev` / `db seed` / manual walkthrough | **BLOCKED** | PostgreSQL not installed |

## Blocked by missing environment dependencies
PostgreSQL is still **not installed**. Blocked until available:
1. Applying both migrations (`npm run db:migrate`) and seeding (`npm run db:seed`).
2. 23 integration tests (run automatically by `npm test` once `DATABASE_URL` is reachable).
3. Manual end-to-end walkthrough of all dashboards; raw SQL (`FOR UPDATE` locks, quota UPDATEs, wallet lock) has not
   been executed against PostgreSQL yet.

## Required manual setup
1. Install PostgreSQL 16+, create database/user (README → Database setup).
2. `cp .env.example .env`; set `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, optionally `UPLOAD_DIR`.
3. `npm run db:migrate && npm run db:seed && npm test`.

## Known issues / limitations
- Public pages that read the database (`/`, `/services`, `/providers`, provider profiles, portfolio images) return the
  error state / 500 when the database is unreachable (no mock data by design).
- Subscription expiry is applied lazily (provider pages, admin "apply expiry" button); no background scheduler.
- Quotas apply to the whole subscription period; withdrawn offers do not refund quota.
- Featured placements are assigned by admins (optional cost field); providers cannot buy featured placement themselves
  (`FEATURED_PLACEMENT` payment purpose reserved).
- Wallet balance is only funded by simulated top-ups and only spent on subscriptions; no withdrawals/refund flows.
- Date inputs use the browser's Gregorian date picker; displayed dates use the Persian calendar (Phase 4 polish).
- Admin lists are capped at the latest 200 rows (pagination planned for Phase 4 review).

## Important technical decisions
- Generic `ServerForm` (FormData + Server Actions, server-side Zod) for the many simple forms; React Hook Form + shared
  Zod remains for complex interactive forms (dynamic request form, form builder, login/register).
- File uploads (documents, portfolio, request attachments) use Route Handlers to avoid the 1 MB Server Action limit
  without enabling experimental options.
- Earnings are computed from completed orders (service fees are paid directly to providers); platform revenue comes
  from subscription payments.
- Phase 1–2 decisions still apply (next-auth v4 stable, Prisma 7.10.1, TS 6.0.3, Vitest 3.2.7, no Cache Components,
  row locks + DB unique constraints for concurrency).

## Next steps (Phase 4 — awaiting authorization)
Complete UI/UX polish, responsive + RTL audit of every page, review all forms/validation and user journeys, security &
authorization review, query/performance review (pagination, indexes), fix issues, run all tests (incl. DB tests once
PostgreSQL is available), production build, final README/documentation and final report.
