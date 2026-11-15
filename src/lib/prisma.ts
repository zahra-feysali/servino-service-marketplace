import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Single PrismaClient instance (PostgreSQL via the official `pg` driver adapter).
 * The connection pool is created lazily by `pg`, so importing this module never
 * opens a connection by itself — queries fail with a clear error if the database
 * is unreachable or DATABASE_URL is missing.
 */
function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type DbClient = typeof prisma;
/** Transaction client type for functions that run inside `prisma.$transaction`. */
export type TxClient = Parameters<Parameters<DbClient["$transaction"]>[0]>[0];
