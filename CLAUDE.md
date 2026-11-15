@AGENTS.md

# CLAUDE.md — Servino Service Marketplace (permanent project instructions)

Read this file, `IMPLEMENTATION_STATUS.md` and `README.md` before any work. The master
specification is the source of truth; this file condenses its permanent rules. **Do not change the
architecture, stack, scope or business rules below without explicit approval from the user.**

## 1. Product
Persian-first (RTL) full-stack marketplace like Achareh: customers submit service requests with
dynamic forms → matched, approved, subscribed providers send offers → customer atomically selects
one → order lifecycle → review. Admin controls everything. Roles: `CUSTOMER`, `PROVIDER`, `ADMIN`.

## 2. Approved stack (mandatory — do not replace)
| Area | Choice (pinned version) |
|---|---|
| Framework | Next.js **16.4.6** App Router, React **19.3.1**, TypeScript **6.0.3** strict |
| UI | Tailwind CSS 4, shadcn/ui (style `radix-nova`, Radix primitives, `rtl: true`), Lucide, Sonner |
| Forms/validation | React Hook Form + Zod 4 (`@hookform/resolvers`) — same schemas on client and server |
| Client server-state | TanStack Query (only where needed); charts: Recharts |
| Backend | Server Actions + Route Handlers inside this same Next.js app (no Express/Nest) |
| DB | PostgreSQL + Prisma **7.10.1** (`prisma-client` generator, `@prisma/adapter-pg`), Prisma Migrate |
| Auth | Auth.js — `next-auth@4.24.15` (latest **stable**; v5 is beta-only), Credentials provider, bcryptjs, JWT sessions, **no Prisma adapter** |
| Font / locale | Vazirmatn (local variable font from `vazirmatn` package), `lang="fa" dir="rtl"` |
| Tests | Vitest 3 (unit + DB integration tests that auto-skip without PostgreSQL) |

**Never introduce:** SQLite, MongoDB, in-memory/mock DB, a separate backend, Zustand, Better Auth or a
second auth framework, a real payment gateway, Cache Components / experimental Next features
(`cacheComponents`, `partialPrefetching`, `unstable_*` APIs), unnecessary dependencies, out-of-scope features.

### Version decisions
- `next-auth` v5 ("Auth.js v5") has only `beta` releases; spec requires stable → **v4.24.15** (supports Next 16).
- `prisma@latest` on npm is an 8.0 **RC**; we use the stable **7.10.1** line.
- TypeScript 7 is the native port and is outside typescript-eslint's supported range (<6.1) → **6.0.3**.
- Vitest 4 hits an npm 10 arborist bug (`edgesOut`) on install → stable **3.2.7**.
- `create-next-app@16.4` enables `cacheComponents` by default — it was **removed** from `next.config.ts`.

## 3. Directory structure (feature/domain-based)
```
prisma/            schema.prisma, migrations/, seed.ts            prisma.config.ts (Prisma 7 config)
src/proxy.ts       Next 16 "proxy" (formerly middleware): only checks a session token exists for /dashboard
src/app/
  (public)/        public site: /, /services, /services/[slug], /request/[slug] (customer request form)
  (auth)/          /login, /register
  dashboard/       /dashboard (role redirect) + customer/ provider/ admin/  (each layout = server role guard)
  api/auth/[...nextauth]/route.ts
  api/requests/route.ts          POST multipart request submission (files) — Route Handler, not a Server Action
  api/attachments/[id]/route.ts  GET private attachment (customer owner / matched provider / admin only)
src/features/<domain>/
  schemas.ts       Zod schemas (shared client/server)
  service.ts       business logic + Prisma (transactions here)
  queries.ts       read-only data access for pages
  actions.ts       "use server" — thin: auth → role → ownership → Zod → service → ActionResult
  components/      feature-specific UI
src/components/ui/      shadcn generated (do not hand-edit except lint fixes)
src/components/shared/  layout shells, header/footer, sidebar, empty/stat/page-header components
src/lib/           prisma.ts, auth.ts (Auth.js options), authz.ts (guards), errors.ts, utils.ts,
                   db-locks.ts (SELECT … FOR UPDATE helper, isUuid), files.ts (magic-byte MIME detection),
                   storage.ts (private local file storage under UPLOAD_DIR)
Key domain modules (Phase 2):
  features/forms/        definitions.ts (field types, admin field schema, snapshots), answers.ts (buildAnswersSchema — shared client/server)
  features/catalog/      admin-service/admin-actions/admin-queries (categories, services, form builder)
  features/requests/     service.ts (submit + cancel), queries.ts (scoped reads, attachment access), components/
  features/matching/     rules.ts (pure eligibility), service.ts (match + atomic quota SQL)
  features/offers/       rules.ts (pure selection/offer rules), service.ts (submit, withdraw, atomic selectOffer)
  features/orders/       state-machine.ts (pure transitions + actors), service.ts (changeOrderStatus), components/
  features/reviews/      rules.ts, service.ts (submitReview + recomputeProviderRating)
  features/notifications/ service.ts (notify(tx, …) inside business transactions), actions.ts
  features/marketplace/actions.ts   all workflow Server Actions (select/cancel/review/offer/withdraw/order status)
  components/shared/action-button.tsx  generic confirm/note dialog button for bound Server Actions
Key domain modules (Phase 3):
  features/subscriptions/ lifecycle.ts (pure: window stacking, expiry, plan schema), quota.ts, service.ts (purchase,
                          activate, expire, admin cancel/extend), plan-service.ts (plan CRUD)
  features/payments/      rules.ts (pure: settle rules, wallet math, labels), service.ts (top-up, completeSimulatedPayment)
  features/providers/     verification.ts (pure checklist/review rules), profile-service.ts (profile, services, areas,
                          skills, portfolio, documents, submit), public-queries.ts (discovery + backend ordering), actions.ts
  features/featured/      rules.ts (pure orderProviders/isFeaturedLive), service.ts
  features/tickets/       rules.ts, service.ts, actions.ts, components/ticket-views.tsx (shared by all roles)
  features/addresses/     schemas, service, actions, components
  features/users/admin-service.ts   user edit/status, provider review/revoke, document status
  features/admin/         queries.ts (requests/offers/orders/reviews), service.ts (flag/cancel request, review
                          moderation, broadcast, typed site settings), actions.ts (ALL admin mutations, ADMIN-only)
  features/reports/       aggregate.ts (pure buckets), queries.ts (admin reports, provider earnings)
  components/shared/server-form.tsx   generic FormData form (Server Action or upload endpoint) + FormFieldError/SubmitButton
  components/shared/charts.tsx        Recharts bar/pie (client)
  app/api/provider/files              POST provider document/portfolio upload (multipart)
  app/api/provider-files/[kind]/[id]  GET document (owner/admin) or portfolio image (public if provider APPROVED)
  app/(public)/payment/[id]           simulated payment gateway page (clearly labelled)
src/generated/prisma/   Prisma client output (gitignored, created by `prisma generate`/postinstall)
tests/unit, tests/integration
```

## 4. Coding conventions
- Server Components by default; `"use client"` only for interactivity (forms, menus, charts).
- No business logic or Prisma calls in components. Pages call `queries.ts`; mutations go through `actions.ts`.
- Server Actions return `ActionResult` (`src/lib/errors.ts`) and never throw raw errors to the client.
  Throw `AppError`/`ForbiddenError`/`NotFoundError` inside services; wrap with `toActionError`.
- User-facing text is Persian. Code, identifiers and comments are English.
- Money = integer **Toman** (`Int`). Format with `formatPrice`; dates with `formatDate` (Persian calendar).
- Use logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) — never `ml-/mr-/left/right` for layout.
- Phone numbers/emails/passwords inputs use `dir="ltr"`.
- Avoid `any`; use generated Prisma types; keep Zod schemas reusable.
- Only link to routes that exist (no dead links/buttons). Update `src/features/dashboard/nav.ts` when adding sections.
- Dynamic DB-backed public pages call `await connection()` (stable API) so they are rendered at request time.

## 5. Security rules (mandatory)
- Passwords: bcryptjs (12 rounds). Never store/log plain passwords. Login failure messages are generic.
- **All authorization is server-side.** Use `requireRolePage()` in pages/layouts and `requireUser()/requireRole()`
  + `assertOwnership()` in actions/route handlers (`src/lib/authz.ts`). These re-read role/status from the DB;
  the JWT is trusted only for the user id. The proxy is UX only.
- Never trust client-provided ids for ownership, prices, permissions or statuses — derive from session/DB.
- Public registration can only create `CUSTOMER`/`PROVIDER` (schema rejects `ADMIN`).
- Uploads: validate declared MIME + size, then the real type from magic bytes (`lib/files.ts`); store under
  `UPLOAD_DIR` (outside `public/`, git-ignored) with server-generated keys; serve only via `/api/attachments/[id]`
  with `nosniff`, `private, no-store` and a sandbox CSP. Delete saved files if the DB transaction fails.
- Route Handlers that mutate state check the `Origin` header (same-origin only) in addition to SameSite cookies.
- Validate route/action ids with `isUuid` before querying; unauthorized lookups return "not found".
- Never return `passwordHash` or other sensitive fields — always `select` explicit fields.
- Never commit `.env` or secrets. `.env.example` documents variables.

## 6. Database & Prisma rules
- PostgreSQL only. UUID PKs (`@db.Uuid`). Enums for every status. Explicit `select` in queries.
- Schema changes: edit `prisma/schema.prisma` → `npx prisma migrate dev --name <change>` (dev) /
  `npx prisma migrate deploy` (prod). **Never use `prisma db push`** as the workflow.
- Multi-step writes use `prisma.$transaction`. Critical selection flow (Phase 2) must lock the request row
  (`SELECT … FOR UPDATE`) and rely on `Order.requestId @unique` as the DB-level guard against double acceptance.
- Orders, payments, wallet transactions, status history: `onDelete: Restrict` (no cascading deletes of records).
- Dynamic forms: requests store `answers` (JSON) + `formSnapshot` (JSON copy of active fields) + `formVersion`,
  so editing a service form never corrupts historical requests.
- Provider matching (Phase 2) must require ALL: APPROVED profile, ACTIVE user, offers the service, serves the
  request's city, ACTIVE non-expired subscription with remaining quota (`RequestMatch` records receipts).
- Quota counters (`Subscription.requestsReceived/offersSubmitted`) are only changed by the conditional SQL in
  `features/matching/service.ts` (re-checks status, window and `planSnapshot` quota; malformed snapshot fails closed).
- Workflow invariants (keep them when extending):
  - selection: lock request → `validateSelection` → guarded `updateMany(status PENDING→ACCEPTED)` → reject others →
    request PROVIDER_SELECTED → create Order (price copied from offer) → histories → notifications, one transaction.
  - offers: lock request, require `RequestMatch`, OPEN + not expired, one per provider (unique), consume offer quota.
  - order status: lock order, ownership by role, `checkTransition` (actor + from-status + note rules), guarded update.
  - request expiry is lazy (`expiresAt`); OPEN + past expiry is shown as EXPIRED and refuses offers/selection.
  - providers see request address/contact only via the order (after selection); attachments only if matched.
- Uploads: allowed MIME = jpeg/png/webp/pdf, verified by magic bytes; ≤ 5 MB/file; ≤ 5 files per field/general.
- Payments (Phase 3): all payments are simulated (`gateway` SIMULATED or WALLET, `isSimulated = true`). Amounts come
  from DB rows (plan price, stored payment), never from the client. `completeSimulatedPayment` locks the Payment row and
  settles it exactly once together with its side effects (subscription activation / wallet credit).
- Wallet: balance changes only inside a transaction holding `lockWallet(tx, userId)`; every change writes a
  WalletTransaction with `balanceAfter`; balance can never go negative (`walletBalanceAfterDebit`).
- Earnings = value of COMPLETED orders (customers pay providers for the service directly; the platform earns from
  subscriptions). The `ORDER_EARNING` wallet reason is intentionally unused.
- Subscriptions: new purchases stack after the latest active one; `expireDueSubscriptions()` marks overdue ACTIVE ones
  EXPIRED (called from provider pages and the admin plans page); quotas are still enforced in SQL at use time.
- Featured placement is independent of plans; provider listing order is decided only by `orderProviders` on the server.
- Public pages never expose customer full names (reviews use `maskName`) nor provider contact data.
- The init migration `prisma/migrations/20261115000000_init` was generated offline with
  `prisma migrate diff --from-empty`. It has **not yet been applied to a real database** — see IMPLEMENTATION_STATUS.md.

## 7. Commands
```bash
npm install                 # also runs prisma generate (postinstall)
npm run dev                 # dev server (Turbopack)
npm run lint                # ESLint
npm run typecheck           # tsc --noEmit
npm test                    # Vitest (integration tests auto-skip without PostgreSQL)
npm run build               # production build
npm run db:validate         # prisma validate (needs DATABASE_URL set, not a live DB)
npm run db:migrate          # prisma migrate dev   (needs PostgreSQL)
npm run db:seed             # prisma db seed       (needs PostgreSQL)
npm run db:deploy           # prisma migrate deploy (production)
```

## 8. Development phases & workflow
Current state: **Phase 3 complete** (see IMPLEMENTATION_STATUS.md). Next: Phase 4 only when the user authorizes it.
Forms convention: simple forms use `ServerForm` + FormData Server Actions (server-side Zod validation, field errors via
`FormFieldError`); complex interactive forms (dynamic request form, form builder) use React Hook Form + shared Zod.
Migrations: `20261115000000_init`, `20261115100000_payment_gateway_wallet` (both generated offline with
`prisma migrate diff`, not yet applied to a database).
Phases: 1 Foundation → 2 Core marketplace logic → 3 Dashboards & business features → 4 UI/UX, testing, finalization.
- Implement **only the phase the user explicitly requests**; at the end of each phase: review, fix, run lint /
  typecheck / tests / build, update `CLAUDE.md`, `README.md`, `IMPLEMENTATION_STATUS.md`, review `git status`,
  commit with a meaningful message, push to `origin main`, report, then **stop and wait** for authorization.
- Report every check as PASSED / FAILED / BLOCKED / NOT RUN. Never claim an unexecuted check passed.
- If PostgreSQL is unavailable: keep building everything else; mark DB-dependent steps BLOCKED.
- Git remote: `https://github.com/zahra-feysali/servino-service-marketplace` (branch `main`). One repository for all phases.

## 9. Continuing in a new session
1. Read `IMPLEMENTATION_STATUS.md` (current phase, blocked items, next steps).
2. Check `git log --oneline` and `git status`.
3. Check whether PostgreSQL is now available (`DATABASE_URL` in `.env`); if so, run `npm run db:migrate`,
   `npm run db:seed` and `npm test` to clear BLOCKED items before new work.
4. Follow sections 3–6 for any new code.
