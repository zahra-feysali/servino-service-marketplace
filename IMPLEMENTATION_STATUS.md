# Implementation Status

_Last updated: 2026-11-15 — end of **Phase 2 (Core marketplace logic)**._

## Phases
| Phase | Status |
|---|---|
| 1 — Project foundation | **Complete** (DB-dependent verification BLOCKED) |
| 2 — Core marketplace logic | **Complete** (DB-dependent verification BLOCKED) |
| 3 — Dashboards & business features | Not started — waiting for authorization |
| 4 — UI/UX, testing, finalization | Not started |

## Phase 2 — implemented
- **Category & service management (admin):** `/dashboard/admin/catalog` — create/edit/delete main categories and
  subcategories (2 levels, parent validation), create/edit/activate/delete services. Deleting is refused when items are
  in use (deactivate instead). Unique slug handling.
- **Dynamic form builder (admin):** `/dashboard/admin/catalog/services/[id]` — add/edit/delete fields, all 9 types
  (TEXT, TEXTAREA, NUMBER, SELECT, RADIO, CHECKBOX, DATE, BOOLEAN, FILE), label, technical name (unique per service),
  required/optional, enable/disable, options (value/label), default value (type-checked), help text, placeholder,
  ordering (up/down with stable renumbering), per-type config (min/max, max length, file types/size/count).
  Every change bumps `Service.formVersion`.
- **History-safe storage:** requests store validated `answers` (JSON) + an immutable `formSnapshot` of the active
  fields + `formVersion`; request pages render from the snapshot, so later form edits never corrupt old requests.
- **Customer request submission:** `/request/[slug]` dynamic form generated from the service's active fields; the
  same Zod builder (`buildAnswersSchema`) validates on the client and on the server; city, address, preferred date,
  description; unknown answer keys stripped. Submitted via `POST /api/requests` (multipart Route Handler).
- **Attachments:** per FILE field and general attachments; declared type/size/count checks + real type detection by
  magic bytes (JPEG/PNG/WebP/PDF), ≤ 5 MB each; stored privately under `UPLOAD_DIR` with generated keys (path-traversal
  safe); files removed if the DB transaction fails; served only by `GET /api/attachments/[id]` to the owner, matched
  providers and admins (404 otherwise).
- **Provider matching:** in the submission transaction, providers are matched only if APPROVED, ACTIVE, offering the
  service, serving the city and holding an ACTIVE, in-window subscription with remaining request quota. Quota is
  consumed with a single conditional SQL UPDATE (race-safe, fail-closed on malformed snapshots). Matches are recorded
  in `RequestMatch`; providers get a `NEW_REQUEST` notification.
- **Provider access:** `/dashboard/provider/requests` inbox (new/viewed, open/all) and request detail — only for matched
  providers; customer address/phone hidden until the provider is selected.
- **Offer submission:** price, estimated duration (hour/day), description, notes. Server enforces approval, match,
  OPEN + not expired, one offer per provider (DB unique), and offer quota (atomic). Providers can withdraw a pending
  offer (`/dashboard/provider/offers`).
- **Offer comparison & selection (customer):** `/dashboard/customer/requests/[id]` — offer cards with provider rating,
  completed orders, experience; sort by price/time/rating; cheapest/fastest/best-rated highlights. **Atomic selection**
  in one `$transaction`: row lock on the request (`SELECT … FOR UPDATE`), ownership + state + offer checks, guarded
  PENDING→ACCEPTED update, other pending offers REJECTED, request → PROVIDER_SELECTED, order created with the price
  copied from the stored offer, request + order status history, notifications to customer, selected and rejected
  providers. `Order.requestId`/`offerId` UNIQUE as a DB backstop against double acceptance.
- **Request cancellation:** customer can cancel an OPEN request with a reason (pending offers rejected, providers notified).
- **Order status management:** pure state machine (`features/orders/state-machine.ts`) with per-transition actors and
  mandatory reasons for cancel/dispute; service locks the order row, checks ownership by role and the current status,
  sets timestamps, writes history, updates the request (COMPLETED/CANCELLED) and provider counters, notifies the other
  party. UI for customer and provider order lists/details with role-specific action buttons and timeline.
- **Reviews & ratings:** one review per completed order by its customer (DB unique + rules), 1–5 stars + comment,
  provider `ratingAverage`/`ratingCount` recomputed from PUBLISHED reviews in the same transaction;
  `/dashboard/customer/reviews`.
- **Notifications:** stored in DB with read/unread; created inside the business transactions (new request, new offer,
  offer accepted/rejected, order created, status changes, review received); notifications page for each role,
  mark one/all as read, unread badge in sidebar and header bell.
- **Navigation:** sidebars now list all implemented sections; service pages link to the request form.

## Phase 1 — implemented (summary)
Next.js 16 / TS strict / Tailwind 4 / shadcn (RTL) / Vazirmatn setup; full Prisma schema for all spec models and the
offline-generated init migration; Auth.js credentials (bcrypt, JWT); customer/provider registration; server-side RBAC
guards; public, auth and dashboard layouts; account settings; idempotent seed; docs.

## Checks (Phase 2)
| Check | Result | Notes |
|---|---|---|
| `npm run lint` | **PASSED** | 0 errors, 0 warnings |
| `npm run typecheck` | **PASSED** | |
| `npx prisma validate` / `generate` | **PASSED** | no schema changes were needed in Phase 2 |
| Unit tests (`npm test`) | **PASSED** | 106 tests in 9 files — dynamic form schema builder & admin field validation, file rules, matching rules & quotas, order state machine, offer selection rules, offer comparison, reviews/rating, magic-byte detection, private storage & path traversal, plus Phase 1 auth/RBAC tests |
| Integration: `tests/integration/marketplace.int.test.ts` (10 tests) | **BLOCKED** | full workflow incl. matching, quotas, duplicate offers, **concurrent selection (exactly one order)**, transitions/ownership, single review & rating, cancellation — needs PostgreSQL; auto-skipped |
| Integration: `tests/integration/auth.int.test.ts` (5 tests) | **BLOCKED** | needs PostgreSQL |
| `npm run build` | **PASSED** | 32 routes, no warnings |
| Production smoke test (`next start`, no DB) | **PASSED** (partial) | `/request/<slug>` and new dashboard routes redirect anonymous users to `/login`; `GET /api/attachments/<id>` → 401 anonymous; `POST /api/requests` → 401 anonymous, 403 cross-origin |
| `prisma migrate dev` / `db seed` | **BLOCKED** | PostgreSQL not installed |
| Manual end-to-end UI walkthrough with data | **BLOCKED** | needs PostgreSQL + seed |

## Blocked by missing environment dependencies
PostgreSQL is still **not installed** on the development machine. Blocked until available:
1. `npm run db:migrate` (applies and verifies the offline-generated init migration).
2. `npm run db:seed`.
3. 15 integration tests (`npm test` runs them automatically once `DATABASE_URL` is reachable).
4. Manual walkthrough: admin form builder → customer request (with files) → provider offer → selection → order → review.
   The raw SQL in `features/matching/service.ts` (quota UPDATEs) and `lib/db-locks.ts` (row locks) has not yet been
   executed against PostgreSQL.

## Required manual setup
1. Install PostgreSQL 16+, create database/user (README → Database setup).
2. `cp .env.example .env`; set `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, optionally `UPLOAD_DIR`.
3. `npm run db:migrate && npm run db:seed && npm test`.

## Known issues / limitations
- Request expiry is evaluated lazily (OPEN past `expiresAt` is displayed as EXPIRED and rejects offers/selection);
  there is no background job that writes `EXPIRED` to the database.
- Withdrawn offers do not refund the consumed offer quota (documented behaviour).
- Quotas apply to the whole subscription period (no monthly reset inside longer plans).
- Admin views of requests/offers/orders, admin dispute resolution UI, review moderation UI, provider profile
  completion (services, areas, documents, submit for verification), subscriptions/payments UIs, address book and
  support tickets belong to **Phase 3**. Service functions already support admin order transitions and rating
  recomputation for later use.
- Date inputs use the browser's Gregorian date picker; displayed dates use the Persian calendar (polish in Phase 4).
- Customer/provider dashboards show the counterpart's phone number only inside an order (not cancelled).

## Important technical decisions
- Request submission uses a **Route Handler** (`POST /api/requests`) because Server Actions are limited to 1 MB unless
  the `experimental.serverActions.bodySizeLimit` option is enabled (experimental options are not allowed).
- Concurrency: pessimistic row locks (`SELECT … FOR UPDATE`) on the request (offers, selection, cancellation) and the
  order (status changes, reviews) + guarded conditional updates + DB unique constraints as backstops.
- Quota enforcement in SQL (conditional `UPDATE … WHERE requestsReceived < (planSnapshot->>'max…')::int`), so concurrent
  requests can never exceed a plan's quota.
- Phase 1 decisions still apply (next-auth v4 stable, Prisma 7.10.1, TS 6.0.3, Vitest 3.2.7, no Cache Components).

## Next steps (Phase 3 — awaiting authorization)
Complete customer/provider/admin dashboards (incl. provider profile, services, areas, portfolio, documents and
verification flow; admin users/providers/requests/orders/reviews management), subscription plans & lifecycle with
quotas, simulated payments, wallet & transactions, featured providers, support tickets, reports & charts, and tests.
