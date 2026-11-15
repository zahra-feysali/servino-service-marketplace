# Implementation Status

_Last updated: 2026-11-16 — end of **Phase 4 (UI/UX, testing, finalization)**. Final report: [FINAL_REPORT.md](FINAL_REPORT.md)._

## Phases
| Phase | Status |
|---|---|
| 1 — Project foundation | **Complete** |
| 2 — Core marketplace logic | **Complete** |
| 3 — Dashboards & business features | **Complete** |
| 4 — UI/UX, testing, finalization | **Complete** |

All code-level work is complete. **Verification that needs PostgreSQL is BLOCKED** (PostgreSQL is not installed on the
development machine) — see "Blocked" below. Nothing in this file claims a database-backed check passed.

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
| Migration SQL generation | **PASSED** | 3 migrations generated offline; **not applied** |
| Unit tests | **PASSED** | **142 tests** in 11 files |
| Integration tests (auth 5, marketplace 10, business 8 = 23) | **BLOCKED** | need PostgreSQL; auto-skipped |
| `npm run build` | **PASSED** | 52 pages + route handlers, no warnings |
| Production smoke test (no DB) | **PASSED** (partial) | security headers present; protected pages redirect to login; file routes 401; upload endpoints 401 anon / 403 cross-site / 411 chunked |
| Link audit | **PASSED** | 166 links → 67 routes, 0 unresolved |
| Browser RTL/mobile check (DB-free pages) | **PASSED** | login, register, 404, error state at 375 px |
| `prisma migrate dev` / `db seed` / full manual walkthrough with data | **BLOCKED** | PostgreSQL not installed |

## Blocked by missing environment dependencies
PostgreSQL is not installed (no `psql`, service or Docker). Blocked until available:
1. `npm run db:migrate` — applies and verifies the 3 offline-generated migrations.
2. `npm run db:seed`.
3. 23 integration tests (run automatically by `npm test` once `DATABASE_URL` is reachable).
4. Manual end-to-end walkthrough of all dashboards with data; raw SQL (row locks, quota UPDATEs, wallet lock) has not yet
   been executed against PostgreSQL.

## Required manual setup
1. Install PostgreSQL 16+, create database/user (README → Database setup).
2. `cp .env.example .env`; set `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` (optional `UPLOAD_DIR`, `ALLOW_SIMULATED_PAYMENTS`).
3. `npm run db:migrate && npm run db:seed && npm test`, then `npm run dev` and follow README → Demo accounts.

## Known issues / limitations
- DB-backed public pages show the error state when PostgreSQL is unreachable (no mock data by design).
- Rate limiting is in-memory per process (use a shared store or sticky sessions with multiple instances).
- Subscription/request expiry is applied lazily (no background scheduler).
- Quotas apply to the whole subscription period; withdrawn offers do not refund quota.
- Featured placement is assigned by admins only; wallet has no withdrawal/refund flows (out of scope).
- Native date pickers are Gregorian (a Persian date hint is shown); values are stored as ISO dates.
- User-facing lists (customer/provider) are capped at the latest 100 items; admin lists are fully paginated.

## Important technical decisions
See FINAL_REPORT.md → "Key technical decisions" and CLAUDE.md (permanent rules).
