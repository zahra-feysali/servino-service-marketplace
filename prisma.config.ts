import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 configuration. DATABASE_URL is read from `.env` (never committed).
// `prisma generate` / `prisma validate` work without a database; migrate/seed need PostgreSQL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
