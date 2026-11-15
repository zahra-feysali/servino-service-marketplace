# Implementation Status

_Last updated: 2026-11-15 — end of **Phase 1 (Foundation)**._

## Phases
| Phase | Status |
|---|---|
| 1 — Project foundation | **Complete** (DB-dependent verification BLOCKED, see below) |
| 2 — Core marketplace logic | Not started — waiting for authorization |
| 3 — Dashboards & business features | Not started |
| 4 — UI/UX, testing, finalization | Not started |

## Phase 1 — implemented
- **Project setup:** Next.js 16.4.6 App Router, React 19.3, TypeScript 6 strict, Tailwind 4, ESLint, `src/` + `@/*` alias.
  Removed the template's default `cacheComponents`/`partialPrefetching` flags (spec forbids Cache Components).
- **UI foundation:** shadcn/ui (radix-nova, RTL), base components, teal/amber palette (light + dark tokens),
  Vazirmatn variable font, `lang="fa" dir="rtl"`, Radix `DirectionProvider`, theme, TanStack Query, tooltip and toast providers.
- **Prisma 7 + PostgreSQL:** `prisma.config.ts`, full schema covering **all spec models** + supporting models
  (User, CustomerProfile, ProviderProfile, ProviderSkill, PortfolioItem, ProviderDocument, Province, City, Address,
  Category (tree), Service, ServiceFormField, ProviderService, ServiceArea, ServiceRequest, RequestMatch,
  RequestAttachment, RequestStatusHistory, ProviderOffer, Order, OrderStatusHistory, Review, Plan, Subscription,
  Payment, Wallet, WalletTransaction, FeaturedProvider, Notification, SupportTicket, TicketMessage, SiteSetting),
  status enums, indexes and unique constraints (one offer per provider per request, one order per request,
  one review per order, etc.), restrictive deletes for financial/audit data, JSON answers + form snapshot.
- **Initial migration SQL** generated offline: `prisma/migrations/20261115000000_init/migration.sql`
  (`prisma migrate diff --from-empty --to-schema`). ⚠️ **Not applied to a database yet / not verified against PostgreSQL.**
- **Auth.js:** Credentials provider (mobile or email + password), bcryptjs (12 rounds), JWT sessions, timing-safe
  failure path, `lastLoginAt` tracking, suspended/inactive accounts cannot sign in.
- **Registration:** customer or provider (never admin); one transaction creates User + profile (provider = `DRAFT`) +
  Wallet; duplicate phone/email handling; automatic sign-in after registration.
- **RBAC:** `src/proxy.ts` (token presence for `/dashboard/*`), server guards `requireRolePage`/`requireRole`/
  `requireUser`/`assertOwnership` that reload role + status from the DB; open-redirect-safe callback handling.
- **Layouts:** public header (desktop + mobile sheet) and footer; auth layout; dashboard shell with RTL sidebar
  (collapsible, mobile sheet), user menu with sign-out; customer/provider/admin layouts each guarded server-side.
- **Pages:** home (catalog from DB), `/services` (category tree), `/services/[slug]`, `/login`, `/register`,
  `/dashboard` (role redirect), role overview pages with real DB statistics, account settings (profile edit +
  password change) for every role, loading, error and not-found states.
- **Seed:** idempotent `prisma/seed.ts` — provinces/cities, categories/subcategories, 7 services with dynamic
  form fields covering all 9 field types, 3 plans, admin + customer + approved provider (services, areas, skills,
  active subscription) + pending provider, site settings.
- **Docs:** `CLAUDE.md`, `README.md`, this file, `.env.example`.

## Checks (Phase 1)
| Check | Result | Notes |
|---|---|---|
| `npm run lint` | **PASSED** | 0 errors, 0 warnings |
| `npm run typecheck` | **PASSED** | |
| `npx prisma validate` | **PASSED** | with a placeholder `DATABASE_URL` |
| `npx prisma generate` | **PASSED** | |
| Migration SQL generation (`migrate diff`) | **PASSED** | SQL file produced; not applied |
| Unit tests (`npm test`) | **PASSED** | 33 tests: auth schemas, phone normalization, RBAC/redirect safety, nav scoping, errors, bcrypt |
| Integration tests (`tests/integration/auth.int.test.ts`, 5 tests) | **BLOCKED** | need PostgreSQL; auto-skipped |
| `npm run build` | **PASSED** | all routes compiled, no warnings |
| Production smoke test (`next start`, no DB) | **PASSED** (partial) | `/login`, `/register` 200 in RTL; `/dashboard*` → 307 to `/login`; Auth.js endpoints 200; unknown route 404; client-side validation messages shown in Persian. `/` and `/services` return 500 without a DB (expected; error boundary) |
| `prisma migrate dev` | **BLOCKED** | PostgreSQL not installed on the dev machine |
| `prisma db seed` | **BLOCKED** | PostgreSQL not installed |
| End-to-end login/registration with real DB | **BLOCKED** | PostgreSQL not installed |

## Blocked by missing environment dependencies
PostgreSQL is **not installed** on the development machine (no `psql`, no service, no Docker). Blocked until it is available:
1. Applying the init migration (`npm run db:migrate`) — this will also confirm the offline-generated SQL.
2. Seeding (`npm run db:seed`).
3. DB integration tests (`npm test` will run them automatically once `DATABASE_URL` is reachable).
4. Manual end-to-end check of register → login → role dashboards → settings, and public catalog pages.

## Required manual setup
1. Install PostgreSQL 16+, create the database/user (see README → Database setup).
2. `cp .env.example .env`, then set `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`.
3. `npm run db:migrate && npm run db:seed && npm test`.

## Known issues / limitations
- Public catalog pages show the error state when the database is unreachable (by design; no mock data).
- Provider profile completion and "submit for verification" are not implemented yet (Phase 3, provider dashboard);
  the provider dashboard shows the current verification state honestly.
- Service detail pages state that online request submission arrives in Phase 2 (no dead "request" button).
- `UPLOAD_DIR` is documented but first used in Phase 2 (attachments).

## Important technical decisions
- `next-auth@4.24.15` (stable) instead of v5 beta; Prisma 7.10.1 (stable) instead of the 8.0 RC tagged `latest`;
  TypeScript 6.0.3 (typescript-eslint compatibility); Vitest 3.2.7 (npm install bug with Vitest 4).
- The proxy does **not** make role decisions (stale-JWT redirect loops); pages/actions read role + status from the DB.
- Double acceptance is prevented at the DB level by `Order.requestId @unique` and `Order.offerId @unique`
  (plus row locking in Phase 2) instead of a partial unique index (Prisma's partial indexes are preview-only).
- Money stored as integer Toman.
- `RequestMatch` (supporting model) records which providers received a request — used for inboxes and quotas.

## Next steps (Phase 2 — awaiting authorization)
Admin category/service CRUD and dynamic form builder; dynamic request form + shared Zod builder; request
submission with attachments; provider matching; provider request inbox; offer submission; offer comparison;
atomic offer selection with row locking; order status machine + history; reviews and rating aggregation;
notification system; tests for all core logic.
