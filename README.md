# سروینو (Servino) — Service Marketplace

A Persian-first (RTL) online service marketplace that connects customers with verified service providers.
Customers submit service requests through dynamic forms, receive and compare offers, choose a provider and
track the order. Providers manage their professional profile, services, service areas, subscription and
orders. Administrators control users, catalog, requests, orders, subscriptions, payments and support.

> **Status:** Phase 3 (Dashboards & business features) is complete. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
> for exactly what is implemented, verified, and blocked.

## Core workflow (implemented)
1. **Admin** defines categories, services and each service's dynamic request form (`/dashboard/admin/catalog`).
2. **Customer** opens a service (`/services/<slug>`) → **Submit request** (`/request/<slug>`): city, address, dynamic
   fields (9 field types incl. file upload) and attachments.
3. The system **matches providers** that are approved, active, offer the service, serve the city and have an active
   subscription with remaining quota; they get a notification and see the request in their inbox.
4. **Providers** send one price offer each (price, estimated time, description, notes).
5. **Customer** compares offers (sort by price / time / rating) and **selects one** — an atomic transaction creates
   the order and rejects the other offers.
6. **Order lifecycle:** provider confirms → starts → marks done → customer confirms completion (cancel/dispute with a reason).
7. **Customer reviews** the completed order (1–5 stars, once); the provider's rating is recalculated.
8. Every important event creates an in-app **notification**.

## Business features (Phase 3)
- **Provider workspace:** professional profile, skills, offered services, service areas, portfolio (images), verification
  documents, checklist and *submit for verification*; subscription purchase (simulated gateway or wallet), wallet top-up,
  payment history, earnings report with chart, customer reviews, support tickets.
- **Customer:** address book (used in the request form), support tickets, plus requests/orders/reviews from Phase 2.
- **Admin:** reports & charts, customers/providers management (edit, activate/deactivate/suspend), provider
  verification (approve/reject/revoke, document review), requests & offers monitoring (flagged requests, cancel),
  orders (incl. dispute resolution), review moderation, subscription plans and user subscriptions (renew/cancel/expire),
  payments & wallet transactions, featured providers, support tickets, broadcast notifications, site settings.
- **Public:** provider discovery (`/providers`, filter by service and city), provider profile pages, featured providers
  on the home page and service pages (ordering decided on the server).
- **Simulated payments:** `/payment/<id>` is a clearly labelled test gateway — choose *successful* or *failed*; the
  server records the result. No card data is collected and no real money moves.

## Technology stack
- **Next.js 16** (App Router, Server Components, Server Actions, Route Handlers), **React 19**, **TypeScript** (strict)
- **Tailwind CSS 4**, **shadcn/ui** (Radix UI, RTL enabled), **Lucide** icons, Sonner toasts
- **React Hook Form** + **Zod** (shared client/server validation), **TanStack Query**, **Recharts**
- **PostgreSQL** + **Prisma 7** (Prisma Migrate, `pg` driver adapter)
- **Auth.js** (`next-auth` v4 stable) — Credentials provider, **bcryptjs**, JWT sessions
- **Vazirmatn** font, Persian UI, RTL layout
- **Vitest** for unit and integration tests, **ESLint**

## Prerequisites
- Node.js **20.19+ / 22.12+** (developed with Node 22.23)
- npm 10+
- **PostgreSQL 16+** (local install or a hosted instance)

## Installation
```bash
git clone https://github.com/zahra-feysali/servino-service-marketplace.git
cd servino-service-marketplace
npm install          # also generates the Prisma client
```

## Environment variables
Copy the example file and edit it:
```bash
cp .env.example .env
```
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://servino:password@localhost:5432/servino?schema=public` |
| `AUTH_SECRET` | Long random secret for Auth.js (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public base URL, e.g. `http://localhost:3000` |
| `UPLOAD_DIR` | Private directory for uploaded request attachments (outside `public/`, git-ignored), default `storage/uploads`. Must be writable by the app; back it up together with the database |
| `SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD` | Optional overrides for demo passwords used by the seed |

`.env` is git-ignored — never commit it.

## Database setup
1. Install PostgreSQL 16+ (Windows: the EDB installer from postgresql.org; macOS: Postgres.app or Homebrew; Linux: your package manager).
2. Create a database and user, for example in `psql`:
   ```sql
   CREATE USER servino WITH PASSWORD 'change-me';
   CREATE DATABASE servino OWNER servino;
   ```
   The user also needs permission to create databases for Prisma's shadow database during `migrate dev`
   (`ALTER USER servino CREATEDB;`).
3. Put the connection string into `DATABASE_URL` in `.env`.

## Migrations and seed data
```bash
npm run db:migrate   # prisma migrate dev — applies prisma/migrations to your database
npm run db:seed      # loads cities, catalog, dynamic form fields, plans and demo accounts
```
In production use `npm run db:deploy` (`prisma migrate deploy`). Do not use `prisma db push`.

## Running the application
```bash
npm run dev          # http://localhost:3000
npm run build && npm start   # production
```

## Tests and checks
```bash
npm run lint
npm run typecheck
npm test             # unit tests; DB integration tests (auth + full marketplace workflow incl.
                     # concurrent offer selection) run only when DATABASE_URL is reachable and migrated
npm run build
```

## Demo accounts (development seed only)
Created by `npm run db:seed`. Log in with the mobile number (or email) and password:

| Role | Mobile | Email | Password |
|---|---|---|---|
| Admin | `09120000000` | `admin@servino.local` | `Admin12345` |
| Customer | `09120000001` | `customer@servino.local` | `Demo12345` |
| Provider (approved, active subscription) | `09120000002` | `provider@servino.local` | `Demo12345` |
| Provider (pending verification) | `09120000003` | `pending@servino.local` | `Demo12345` |

Try the full flow: log in as the customer → open «تعمیر یخچال و فریزر» → submit a request in **تهران** → log in as the
approved provider → *درخواست‌های مرتبط* → send an offer → back as the customer → select the offer → follow the order.
As admin, open *متخصصان و تأیید* to approve the pending provider; as a provider, open *اشتراک* to buy a plan through
the simulated gateway.

These passwords are for local development only; override them with `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD`.
Never run the seed against production (it refuses to run with `NODE_ENV=production`).

## Payments
This version has **no real payment gateway**. All payments are simulated, stored in the database with
`isSimulated = true` / gateway `SIMULATED`, and clearly labeled in the UI (implemented in Phase 3).

## Project documentation
- [CLAUDE.md](CLAUDE.md) — permanent architecture, conventions and rules
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) — phase progress, test results, blocked items, next steps
