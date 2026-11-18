# Implementation Status

_Last updated: 2026-11-18 — **Provider withdrawals complete** (next section). Expansion 2 and Phases 1–4 below are complete.
Final report: [FINAL_REPORT.md](FINAL_REPORT.md)._

## Provider withdrawals & manual payouts (2026-11-18)
Status legend as below (Not Started · In Progress · Implemented · Tested · Verified · Blocked).

**Baseline:** `main` = `origin/main` at `58d8d3a`, clean tree; PostgreSQL 18.7 running; 240/240 tests passing.
**Plan:** reserve funds on the wallet (`Wallet.reservedBalance`) instead of debiting at request time; debit once on
"mark as paid" (ledger row unique per withdrawal); spending (`debitWallet`) limited to the available balance; guarded
status transitions under wallet + withdrawal row locks; audit events; notifications; provider and admin pages.

| # | Item | Status | Notes |
|---|---|---|---|
| W1 | Schema + migration `20261119000000_provider_withdrawals` | Tested | Additive: `ProviderBankAccount`, `WithdrawalRequest`, `WithdrawalEvent`, enums, `Wallet.reservedBalance`, `WalletTransaction.withdrawalId @unique`, reason `WITHDRAWAL`, notification `WITHDRAWAL_UPDATE`; DB CHECKs `reservedBalance >= 0`, `balance >= reservedBalance`, `amount > 0`. Applied with `migrate deploy`; status up to date. |
| W2 | Reservation-aware wallet (`features/finance/wallet.ts`) | Tested | `debitWallet` uses the available balance; `reserveWalletFunds`, `releaseWalletReservation`, `payOutReservedFunds`. |
| W3 | Rules (Sheba checksum/normalize/mask, amount, transitions) | Tested | `features/withdrawals/rules.ts`, 14 unit tests. |
| W4 | Service (request, cancel, approve, reject, mark paid, min setting) | Tested | `features/withdrawals/service.ts`; 11 PostgreSQL tests (reservation, ownership/roles, suspended provider, reject/approve/pay/cancel rules, single debit under retries, rollback, idempotency key, concurrent requests, concurrent spending, reconciliation, admin search) + 1 finance regression test (released earnings → payout, revenue unchanged). |
| W5 | Provider page `/dashboard/provider/withdrawals` | Verified | Balances, bank account form, request + review dialog, history with cancel. Checked in the browser (see below). |
| W6 | Admin pages `/dashboard/admin/withdrawals[/id]` | Verified | Summary, ledger reconciliation check, search/status/date filters, detail with full Sheba, audit trail, approve / record payment (confirmation required) / reject (reason required), min-withdrawal setting. |
| W7 | Existing features updated | Verified | Wallet page shows reserved/available + link; admin finance shows payouts and reservations (not revenue); nav items + pending badge for admins; ledger label for `WITHDRAWAL`. |

**Manual browser checks (performed):** provider — balances, wrong-checksum Sheba rejected, valid Sheba saved/normalized
(bank detected), amount above available blocked, review dialog, two requests created and reserved, a third cancelled
(funds released), history and notifications; admin — list/summary/ledger check, search by request number, approve,
record payment (confirmation enforced, reference stored, one ledger debit), reject with required reason (funds released),
finance page (revenue unchanged, payout listed), wallet transaction view. No horizontal overflow at 375 / 768 / 1280 px on
the provider page and both admin pages. The provider's earnings came from a real order (#78) run through the service
functions by a script (request → offer → selection → simulated top-up → wallet payment → completion), **not** clicked
through in the UI; commission stayed 10 % (240,000 of 2,400,000).

**Checks:** lint PASSED · typecheck PASSED · tests PASSED 266/266 (201 unit, 65 PostgreSQL) · build PASSED (no warnings) ·
`prisma validate` PASSED · `migrate status` up to date.

## Expansion 2 (started 2026-11-18)
Status legend: Not Started · In Progress · Implemented · Tested (automated tests pass) · Verified (also checked
manually in the browser) · Blocked.

**Baseline (start of work):** branch `main` = `origin/main` at `78ce8fb`, clean working tree; PostgreSQL 18.7 running
locally; 165/165 tests passing; all 4 original phases complete.

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Design system & global UI refresh | Verified | Tokens in `globals.css`, Card/Table/PageHeader/StatCard/EmptyState/dashboard shell (`bdf2b3c`); dashboard `min-w-0` fix. Checked in the browser at 375 / 768 / 1280 px. |
| 2 | Wallet, order payment, commission, escrow, refunds, admin finance | Tested | Migration `20261118085453_finance_order_payments`. `features/finance/*`, idempotent `settlePayment`. 8 PostgreSQL tests (top-up, wallet + gateway pay, frozen commission, release on completion, refund on cancel/dispute, concurrent pay, stale callback, ledger = balance) + unit tests. Admin finance and wallet pages opened in the browser; a full pay-by-UI run was **not** done manually. |
| 3 | Profile pictures | Verified | Migration `20261118091859_user_avatar`; `/api/avatars`. Upload/replace/delete + visibility tested (PostgreSQL); upload checked in the browser (header updates). |
| 4 | Multi-file upload fix | Verified | Root cause fixed (live FileList read after reset). `MultiFileInput` in request form, provider documents/portfolio, blog cover; chat composer. Multi-select, add-more, previews and type rejection checked in the browser; server storage of all files tested (PostgreSQL). |
| 5 | Jalali calendar | Tested | `lib/jalali.ts`, picker, admin date-range filters; unit tests incl. 5-year day-by-day cross-check with Intl. Jalali display seen across pages. |
| 6 | Header account menu | Verified | `AccountMenu` (avatar, name, role, links, logout); opened on mobile (375 px) and desktop. |
| 7 | Customer ↔ provider chat | Verified | Migration `20261118094228_chat`. Text/files, read ticks, unread badges, notifications (deduplicated), polling, read-only when the offer is withdrawn; 4 PostgreSQL + unit tests; sent and received a message in the browser. Providers see a masked customer name before selection; per-user rate limits. |
| 8 | About & Contact | Verified | Migration `20261118095615_contact_and_blog`. Contact form validated and saved through the real UI; admin inbox with read/archive. |
| 9 | Blog | Verified (public) / Tested (admin) | Public list, categories, article, related posts and SEO metadata checked in the browser; admin CRUD/publish/cover covered by PostgreSQL tests and pages opened (create flow not clicked through manually). 6 seeded articles. |
| 10 | Home hero & sections, footer | Verified | Hero image, real stats (zero values hidden), category images, steps, featured, latest posts, CTA; new footer. |
| 11 | Featured plans self-service | Tested | Migration `20261118101538_featured_plans`. Wallet/gateway purchase, activation once, stacking, failure, expiry, safe plan delete — 5 PostgreSQL + unit tests; provider and admin pages opened in the browser. |
| 12 | Provider dashboard (services & areas) | Verified | Grouped tiles, live counts, select/clear all, search; saves keep inactive items. |
| 13 | City management | Tested | `/dashboard/admin/cities`; CRUD, deactivate without data loss, safe delete — 3 PostgreSQL tests; page checked at all widths. |
| 14 | Integrity review & responsive checks | Verified | Independent read-only security review: no high-severity issue; 4 findings fixed (`f1e8aba`). No horizontal overflow on public, customer, provider and admin pages at 375 / 768 / 1280 px (one tablet overflow found and fixed). `shadcn` moved to devDependencies (`npm audit --omit=dev`: 0). |

**Checks (final run):** lint PASSED · typecheck PASSED · tests PASSED (see FINAL_REPORT.md for counts) · build PASSED ·
`prisma validate` PASSED · `prisma migrate status` up to date. Manual browser checks are listed per row above and are separate
from automated tests.

**Known limitations:** payments are simulated (no real gateway, refunds go to the wallet); chat uses polling (4 s), not
websockets; rate limits are in-memory per process; pre-selection chat cannot technically stop users from exchanging
phone numbers in free text; avatars are cropped client-side (no server-side image re-encoding).

## Phases
| Phase | Status |
|---|---|
| 1 — Project foundation | **Complete** |
| 2 — Core marketplace logic | **Complete** |
| 3 — Dashboards & business features | **Complete** |
| 4 — UI/UX, testing, finalization | **Complete** |

All work is complete. On 2026-11-16 PostgreSQL 18.7 was installed locally (portable EDB binaries, localhost only) and
**every previously BLOCKED check was executed and passed** — see "Database verification" below.

## Phase 4 — implemented
**Security review & fixes** (independent read-only audit of every Server Action and Route Handler; no IDOR or broken
role check found; all reported issues fixed):
- Open redirect via control characters in `callbackUrl` → `isSafeRelativePath` now rejects control chars/backslashes
  and verifies the parsed origin.
- Simulated payments could be self-settled in production → disabled in production unless
  `ALLOW_SIMULATED_PAYMENTS=true` (enabled in development, as the spec requires a simulated flow).
- Upload size cap bypass with chunked bodies → `bodySizeError` requires Content-Length (411/413).
- CSRF check skipped when `Origin` missing → `isSameOriginRequest` also checks `Sec-Fetch-Site`.
- Brute force → login rate limit (failed attempts: 10/15 min per identifier, 50/15 min per IP) and registration limit
  (10/hour per IP); IP taken from `x-real-ip` / right-most `x-forwarded-for` (not spoofable left-most entry).
- Sessions survived password changes → `User.passwordChangedAt` (new migration) + `authTime` JWT claim; older sessions
  are rejected; the user is signed out after changing the password.
- Race between admin subscription cancel and payment settlement → pending payment rows are locked first.
- Offers of suspended/unapproved providers could be selected → `selectOffer` requires APPROVED + ACTIVE provider.
- Portfolio images of suspended providers stayed public/cached → same visibility rule as public pages, private short cache.
- Global security headers (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS in production),
  `X-Powered-By` removed.

**Performance / queries:** offset pagination (20 per page, count queries) for all admin lists (customers, providers,
requests, offers, orders, reviews, subscriptions, payments, wallet transactions, tickets) replacing the 200-row caps;
existing indexes reviewed against all list/filter queries (status/date/owner composites already present); no N+1 in page
loaders (relations loaded with `select`).

**UI/UX:** per-role `loading`, `error` and `not-found` inside the dashboard shell (sidebar stays), public loading and
error boundaries (header/footer stay), skip-to-content link + `main` landmarks, Persian (Jalali) date hint under every
date input, app icon, `robots.txt` (private areas disallowed). Mobile/RTL verified in the browser at 375 px for the
pages that render without a database (login, register, 404, error state).

**Verification of buttons and links:** an automated audit of all 166 internal links/redirects/notification links against
the 67 app routes — **all resolve** (no dead links).

## Checks (final)
| Check | Result | Notes |
|---|---|---|
| `npm run lint` | **PASSED** | 0 errors, 0 warnings |
| `npm run typecheck` | **PASSED** | |
| `npx prisma validate` / `generate` | **PASSED** | |
| Migrations (`prisma migrate dev`) | **PASSED** | all 3 applied; schema in sync, no drift |
| Unit tests | **PASSED** | **142 tests** in 11 files |
| Integration tests (auth 5, marketplace 10, business 8 = 23) | **PASSED** | against PostgreSQL 18.7; run twice, fixtures cleaned up |
| `npm run build` | **PASSED** | 52 pages + route handlers, no warnings |
| Production smoke test (no DB) | **PASSED** (partial) | security headers present; protected pages redirect to login; file routes 401; upload endpoints 401 anon / 403 cross-site / 411 chunked |
| Link audit | **PASSED** | 166 links → 67 routes, 0 unresolved |
| Browser RTL/mobile check (DB-free pages) | **PASSED** | login, register, 404, error state at 375 px |
| `prisma db seed` | **PASSED** | run twice (idempotent) |
| Manual walkthrough with data (browser, production build) | **PASSED** | customer login → dynamic request with saved address → matched provider inbox + notification → offer → customer comparison & selection → order created; admin dashboard KPIs & charts with real data |

## Database verification (2026-11-16)
- PostgreSQL 18.7 (portable binaries, no Windows service; listens on localhost only; scram-sha-256 auth; dedicated
  `servino` role with CREATEDB for the Prisma shadow database).
- `prisma migrate dev`: 3 migrations applied, no drift. `prisma db seed`: OK (idempotent).
- `npm test`: **165/165 passed** (142 unit + 23 integration), including the raw SQL paths: `FOR UPDATE` locks, atomic
  quota UPDATEs, wallet lock, concurrent offer selection (exactly one order).
- Browser walkthrough on the production build (see table above). It left one demo request/offer/order in the local DB.

## Blocked by missing environment dependencies
None.

## Required manual setup
1. Install PostgreSQL 16+, create database/user (README → Database setup).
2. `cp .env.example .env`; set `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` (optional `UPLOAD_DIR`, `ALLOW_SIMULATED_PAYMENTS`).
3. `npm run db:migrate && npm run db:seed && npm test`, then `npm run dev` and follow README → Demo accounts.

## Known issues / limitations
- DB-backed public pages show the error state when PostgreSQL is unreachable (no mock data by design).
- The local PostgreSQL is not a Windows service: after a reboot start it again (README → Local PostgreSQL).
- Rate limiting is in-memory per process (use a shared store or sticky sessions with multiple instances).
- Subscription/request expiry is applied lazily (no background scheduler).
- Quotas apply to the whole subscription period; withdrawn offers do not refund quota.
- Featured placement is assigned by admins only; wallet has no withdrawal/refund flows (out of scope).
- Native date pickers are Gregorian (a Persian date hint is shown); values are stored as ISO dates.
- User-facing lists (customer/provider) are capped at the latest 100 items; admin lists are fully paginated.

## Important technical decisions
See FINAL_REPORT.md → "Key technical decisions" and CLAUDE.md (permanent rules).
