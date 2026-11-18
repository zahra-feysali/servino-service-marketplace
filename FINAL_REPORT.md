# Servino — Final Project Report

_Date: 2026-11-16 · Repository: `zahra-feysali/servino-service-marketplace` (branch `main`)_

## 1. Summary
Servino is a Persian-first (RTL), full-stack service marketplace built as a single Next.js 16 application with
PostgreSQL + Prisma. Customers submit requests through admin-defined dynamic forms, matched providers send offers,
customers compare and select an offer (atomically creating an order), track the order, and review the provider.
Providers manage a verified professional profile, services, service areas, subscription, wallet and earnings.
Administrators manage users, verification, catalog and forms, requests/offers/orders, reviews, plans and subscriptions,
simulated payments, featured providers, support tickets, notifications, settings and reports.

All four phases of the master specification were implemented in order, each committed separately:
`2f5c863` (Phase 1), `4ca7f65` (Phase 2), `11e939f` (Phase 3), and the Phase 4 commit.

## 2. Stack (as specified)
Next.js 16 App Router · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui (Radix, RTL) · Lucide ·
React Hook Form · Zod · TanStack Query · Recharts · Server Actions + Route Handlers · PostgreSQL · Prisma 7 + Prisma
Migrate · Auth.js (next-auth v4 stable, Credentials, bcryptjs, JWT) · Vazirmatn · Vitest · ESLint.
Not used (per spec): SQLite, MongoDB, separate backend, Zustand, real payment gateway, Cache Components/experimental flags.

## 3. Feature coverage vs. specification
| Spec section | Status |
|---|---|
| §5 Roles & RBAC (server-side) | Done — DB-backed guards on every page, action and route handler |
| §6 Core workflow (registration → verification → request → matching → offers → atomic selection → order lifecycle → review) | Done |
| §7 Services & dynamic forms (9 field types, ordering, enable/disable, required, options, defaults, help text, history-safe snapshots, client+server validation) | Done |
| §8 Customer dashboard | Done |
| §9 Provider dashboard | Done |
| §10 Admin dashboard | Done |
| §11 Subscriptions (configurable plans, Plan/Subscription models, statuses, backend quotas) | Done |
| §12 Simulated payments (Payment, Wallet, WalletTransaction, success/failure stored, history, clearly labelled) | Done |
| §13 Featured providers (independent of plans, dates, cost, backend ordering) | Done |
| §14 Reviews & ratings (one per order, admin moderation, rating from valid reviews) | Done |
| §15 Notifications (DB, read/unread) | Done |
| §16 Support tickets | Done |
| §17 Database design (all listed models + supporting models, enums, indexes, uniques, restrictive deletes, JSON answers) | Done |
| §18 Security & code quality | Done — plus Phase 4 audit fixes |
| §19 UI/UX & public pages (home, categories, service pages, request form, provider discovery & profiles, auth) | Done |
| §22 Testing | Done — 165 tests pass (unit + PostgreSQL integration) |

## 4. Verification results
| Check | Result |
|---|---|
| Lint | PASSED |
| Typecheck | PASSED |
| Prisma validate / generate | PASSED |
| Unit tests | PASSED — 142 tests (165 total with integration) |
| Integration tests (23) | PASSED — PostgreSQL 18.7 |
| Production build | PASSED |
| Smoke tests without DB (redirects, 401/403/411, headers) | PASSED (partial) |
| Internal link audit (166 links / 67 routes) | PASSED |
| Browser RTL/mobile check of DB-free pages | PASSED |
| Migrations applied (3), seed (idempotent), UI walkthrough with data | PASSED |

## 5. Key technical decisions
- **Stable versions only:** next-auth 4.24.15 (v5 is beta-only), Prisma 7.10.1 (`latest` tag is an 8.0 RC),
  TypeScript 6.0.3 (typescript-eslint range), Vitest 3.2.7 (npm install bug with v4). Cache Components removed from the
  create-next-app template.
- **Authorization:** JWT trusted only for identity; role, status and password-change time re-read from PostgreSQL on
  every request; proxy only checks token presence (avoids stale-role redirect loops).
- **Concurrency:** `SELECT … FOR UPDATE` row locks (request, order, payment, provider, ticket, wallet), guarded
  conditional updates, and DB unique constraints (`Order.requestId/offerId`, one offer per provider, one review per
  order) as backstops; quota consumption in a single conditional SQL UPDATE.
- **Dynamic forms:** shared Zod builder for client and server; immutable `formSnapshot` + `formVersion` per request.
- **Files:** Route Handlers for uploads (Server Actions are 1 MB-limited without experimental flags); magic-byte type
  checks; private storage with server-generated keys; auth-checked download routes with strict headers.
- **Money:** integer Toman; amounts from DB only; payments settle once inside a locked transaction; wallet never negative.
- **Revenue model:** platform revenue = subscriptions; provider earnings = completed orders (paid directly by customers).

## 6. How to run
1. Install PostgreSQL 16+, create the database (README → Database setup).
2. `npm install` · `cp .env.example .env` and set `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`.
3. `npm run db:migrate` · `npm run db:seed` · `npm test` (now including 23 integration tests).
4. `npm run dev` → http://localhost:3000 — demo accounts are listed in README.

## 7. Known limitations
See IMPLEMENTATION_STATUS.md → "Known issues / limitations" (lazy expiry, in-memory rate limiting, Gregorian native
date pickers with Persian hints, admin-assigned featured placement, no wallet withdrawals).

## 8. Readiness
The application is feature-complete for the specified scope. All checks pass, including migrations, seed and the 23
PostgreSQL integration tests (matching, concurrent selection, order transitions, reviews, subscriptions, payments, wallet,
verification, tickets), plus a browser walkthrough of the core flow with real data. For production: managed PostgreSQL,
HTTPS, a shared rate-limit store if scaling out, and `ALLOW_SIMULATED_PAYMENTS` left unset until a real gateway exists.

---

# Expansion 2 — Report (2026-11-18)

## Implemented features
| # | Feature | Status | Key files |
|---|---|---|---|
| 1 | New design system (tokens, cards, tables, page headers, stat cards, dashboard shell) | Verified | `src/app/globals.css`, `src/components/ui/{card,table}.tsx`, `src/components/shared/*` |
| 2 | Customer wallet, order payment (wallet / simulated gateway), frozen commission, escrow release, refunds, admin finance | Tested | `src/features/finance/*`, `src/features/payments/service.ts`, `/dashboard/admin/finance`, `/dashboard/customer/wallet` |
| 3 | Profile pictures for all users | Verified | `src/features/avatars/*`, `src/app/api/avatars/**`, `src/components/shared/user-avatar.tsx` |
| 4 | Multi-file upload fix + reusable picker with previews/progress | Verified | `src/components/shared/multi-file-input.tsx`, `src/lib/{uploads,upload-client}.ts` |
| 5 | Jalali calendar (picker, display, filters) | Tested | `src/lib/jalali.ts`, `src/components/shared/{jalali-date-picker,date-range-filter}.tsx` |
| 6 | Header account menu (avatar, name, role, links) | Verified | `src/components/shared/account-menu.tsx` |
| 7 | Customer ↔ provider chat (text, images, PDF, read state, unread counts, notifications, polling) | Verified | `src/features/chat/*`, `src/app/api/conversations/**`, `src/app/api/chat-files/**` |
| 8 | About & Contact pages, contact inbox | Verified | `src/app/(public)/{about,contact}`, `src/features/contact/*`, `/dashboard/admin/contact` |
| 9 | Blog (public + admin, SEO, categories, 6 Persian articles) | Verified (public) / Tested (admin) | `src/features/blog/*`, `src/app/(public)/blog/**`, `/dashboard/admin/blog/**`, `prisma/seed-blog.ts` |
| 10 | Home hero & sections, footer | Verified | `src/app/(public)/page.tsx`, `src/components/shared/site-footer.tsx` |
| 11 | Featured plans (buy by wallet/gateway, auto activation, renewal, expiry) | Tested | `src/features/featured/purchase-*.ts`, `/dashboard/provider/featured`, `/dashboard/admin/featured-plans` |
| 12 | Provider services & areas redesign | Verified | `src/features/providers/components/selection-groups.tsx` |
| 13 | City management | Tested | `src/features/locations/*`, `/dashboard/admin/cities` |
| 14 | Integrity/security review, responsive checks | Verified | see below |

Status meaning: **Tested** = automated tests pass; **Verified** = tests pass and the feature was also checked manually in
the browser. Nothing in this list is unimplemented.

## Migrations (all additive — no column or table dropped; applied to local PostgreSQL 18)
`20261118085453_finance_order_payments`, `20261118091859_user_avatar`, `20261118094228_chat`,
`20261118095615_contact_and_blog`, `20261118101538_featured_plans`. `prisma validate` passed; `prisma migrate status`:
up to date. Seed is idempotent (re-run verified: 6 posts, 4 categories, 1 commission setting; admin edits are never overwritten).

## Automated checks (final run, 2026-11-18)
| Check | Result |
|---|---|
| ESLint (`npx eslint .`) | PASSED — 0 errors, 0 warnings |
| TypeScript (`tsc --noEmit`) | PASSED |
| Vitest | PASSED — **240 / 240** tests in 26 files (**187 unit**, **53 PostgreSQL integration**), 0 failed, 0 skipped |
| Production build (`npm run build`) | PASSED — compiled without warnings, 68 routes |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Internal link audit (73 links from public + admin pages) | 0 broken |

New test files: `finance-jalali`, `uploads-avatars`, `chat-rules`, `blog-contact`, `featured-plans` (unit);
`finance`, `avatars`, `uploads`, `chat`, `blog-contact`, `featured-plans`, `cities` (integration). Existing
`marketplace` and `business` integration tests were updated for the new rules (payment before work starts; idempotent
repeated gateway callbacks).

## Manual checks (browser, separate from automated tests)
- Responsive: no horizontal scroll at **375 / 768 / 1280 px** on public pages and the customer, provider and admin
  dashboards checked (home, services, providers, blog list/article, about, contact, request form, wallet, order detail,
  messages, chat, provider services/featured/earnings/wallet/requests, admin finance/cities/blog/contact/featured plans/
  requests/payments). One overflow at 768 px was found and fixed (`min-w-0` on the dashboard main).
- Avatar upload, account menu (mobile and desktop), multi-file selection with previews and type rejection, chat send/
  receive with read ticks, contact form validation and submission, blog pages.
- Not clicked through manually (covered by automated tests only): paying an order through the UI, buying a featured
  plan through the UI, creating a blog post through the admin form.

## Security review
An independent read-only review of all Expansion 2 code found no high-severity issue. Four findings were fixed in
`f1e8aba`: masked customer name for providers before selection, avatar visibility limited to live offers, per-user chat
rate limits, and a row lock for concurrent avatar uploads (plus a stricter UUID check in the blog form).

## Limitations / manual steps for the user
- Payments remain **simulated**; no real money moves and refunds go to the in-app wallet. A real gateway would call
  `settlePayment` from a verified callback.
- Chat uses 4-second polling (no websockets). Rate limits are in-memory per process.
- After pulling: `npm install`, `npm run db:migrate` (or `db:deploy` in production), `npm run db:seed`, then restart
  `npm run dev` (Prisma 7 needs `npx prisma generate` after schema changes).
- Images in `public/images` are free-license Unsplash photos (sources in `public/images/CREDITS.md`).

---

# Provider withdrawals & manual payouts — Report (2026-11-18)

## Implemented
- **Provider** (`/dashboard/provider/withdrawals`): total balance, available balance, amount reserved by open requests,
  total paid out; bank account (holder name + Sheba with checksum validation and normalization); withdrawal request with a
  review dialog (amount + masked destination) and an idempotency key; history (date, amount, masked Sheba, status,
  rejection reason, payment date and reference); cancel while pending.
- **Admin** (`/dashboard/admin/withdrawals`, `/[id]`): status filter, Jalali date range, search by name / display name /
  mobile / request number; totals; live ledger reconciliation check; detail with full Sheba (admins only), provider
  status, wallet figures and the audit trail; approve, record payment (transfer reference required + explicit
  confirmation that the transfer was made outside the app), reject (reason required); configurable minimum withdrawal
  (`finance.minWithdrawal`, default 0 = none). Sidebar badge with the number of pending requests.
- **Notifications** to the provider on submission, approval, rejection, payment and cancellation (one per transition).
- No fees were introduced. No bank API exists: "record payment" only records a transfer an admin made manually.

## Database (migration `20261119000000_provider_withdrawals`, additive)
New tables `ProviderBankAccount` (one per user), `WithdrawalRequest` (code, amount, status, bank snapshot, admin/actor
fields, unique `payoutReference`, unique `(userId, clientKey)`), `WithdrawalEvent` (append-only audit). New columns
`Wallet.reservedBalance` (default 0) and `WalletTransaction.withdrawalId` (unique). New enum values `WITHDRAWAL`
(ledger reason) and `WITHDRAWAL_UPDATE` (notification). CHECK constraints: `reservedBalance >= 0`,
`balance >= reservedBalance`, `amount > 0`. Existing rows were verified compatible before applying; nothing was dropped.

## Financial design
- A request **reserves** the amount (`reservedBalance += amount`); the balance and the ledger are untouched.
  Available = balance − reserved. Reject/cancel releases the reservation. **Record payment** debits the balance and the
  reservation together, writing exactly one ledger row (`reason = WITHDRAWAL`, `withdrawalId` unique). So
  `balance = Σ credits − Σ debits` and `reserved = Σ PENDING + APPROVED amounts` hold at all times (checked by the admin
  page and by tests). The money is never subtracted twice.
- `debitWallet` (order payment, subscription, featured purchase) now spends only the available balance, so reserved funds
  cannot be spent. Commission, escrow, release and refund logic is unchanged.
- Every operation is one transaction: lock the wallet row, then the withdrawal row (same order everywhere), validate the
  transition, then a guarded `updateMany(where status = expected)`. Retries and races fail without side effects.
- Transitions: PENDING → APPROVED | REJECTED | CANCELLED; APPROVED → PAID | REJECTED; PAID/REJECTED/CANCELLED are final.
  (An approved request can still be rejected, e.g. if the transfer could not be made; never after payment.)

## Security
Server-side role checks in every action (`requireRole`) plus DB re-checks in the service (active PROVIDER / active ADMIN);
ownership enforced in the query (another provider's request → "not found"); ids validated with `isUuid`; all inputs
validated with Zod; amounts, balances, statuses and bank details are never taken from the client; suspended users cannot
act (session rejected, service re-check). Bank details are masked everywhere except for the owner and admins; no public
endpoint exposes them; no card PIN/CVV2 or banking credentials are requested. Server Actions rely on the built-in
Next.js origin check (no new Route Handlers were added).

## Automated tests (final run)
| Check | Result |
|---|---|
| ESLint | PASSED — 0 errors, 0 warnings |
| TypeScript | PASSED |
| Vitest | PASSED — **266 / 266** in 28 files (**201 unit**, **65 PostgreSQL integration**), 0 failed, 0 skipped |
| Build | PASSED — no warnings; 3 new routes |
| `prisma validate` / `generate` / `migrate status` | PASSED / PASSED / up to date |

New: `tests/unit/withdrawals.test.ts` (14), `tests/integration/withdrawals.int.test.ts` (11), and one regression test in
`finance.int.test.ts` (released order earnings → withdrawal → payout; commission and platform revenue unchanged).

## Manual browser checks (performed, separate from automated tests)
Provider: balances; wrong-checksum Sheba rejected; valid Sheba saved and normalized (bank name shown); amount above the
available balance blocked; review dialog; requests #33 (1,000,000) and #34 (500,000) reserved; #35 cancelled and released;
history and notifications. Admin: list, totals, ledger check, search by number, approve #33, record payment with reference
(confirmation enforced) → balance 2,160,000 → 1,160,000 with one ledger row; reject #34 with a required reason → funds
released; finance page (platform revenue unchanged, payout listed separately); wallet transaction view. No horizontal
overflow at 375 / 768 / 1280 px on the three new pages. **Not done in the UI:** the regression order (#78) that produced
the provider's earnings was run through the real service functions by a script, not clicked through; server-side
over-limit rejection, concurrency and rollback are covered by automated tests only.

## Known limitations
- Transfers are manual; there is no bank integration or automatic reconciliation with bank statements.
- The bank-name lookup covers common banks only (unknown codes show "نامشخص"); holder-name/Sheba ownership is not
  verified against a bank inquiry service.
- The local development database now contains the demo order #78 and withdrawals #33–#35 created during verification.
