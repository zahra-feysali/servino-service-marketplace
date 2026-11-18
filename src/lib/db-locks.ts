import type { TxClient } from "@/lib/prisma";

/**
 * Row-level pessimistic locks (`SELECT … FOR UPDATE`) for critical multi-step operations.
 * Must be called inside `prisma.$transaction(async (tx) => …)`; the lock is held until commit/rollback.
 * Table names are a fixed whitelist — never user input.
 */
const LOCKABLE = {
  ServiceRequest: 'SELECT "id" FROM "ServiceRequest" WHERE "id" = $1::uuid FOR UPDATE',
  Order: 'SELECT "id" FROM "Order" WHERE "id" = $1::uuid FOR UPDATE',
  Payment: 'SELECT "id" FROM "Payment" WHERE "id" = $1::uuid FOR UPDATE',
  ProviderProfile: 'SELECT "id" FROM "ProviderProfile" WHERE "id" = $1::uuid FOR UPDATE',
  SupportTicket: 'SELECT "id" FROM "SupportTicket" WHERE "id" = $1::uuid FOR UPDATE',
  Conversation: 'SELECT "id" FROM "Conversation" WHERE "id" = $1::uuid FOR UPDATE',
  User: 'SELECT "id" FROM "User" WHERE "id" = $1::uuid FOR UPDATE',
  WithdrawalRequest: 'SELECT "id" FROM "WithdrawalRequest" WHERE "id" = $1::uuid FOR UPDATE',
} as const;

export async function lockRow(tx: TxClient, table: keyof typeof LOCKABLE, id: string): Promise<boolean> {
  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(LOCKABLE[table], id);
  return rows.length > 0;
}

/**
 * Locks (creating it first if missing) the wallet of a user and returns its current state.
 * `reservedBalance` is the amount held by open withdrawal requests; available = balance − reserved.
 */
export async function lockWallet(tx: TxClient, userId: string): Promise<{ id: string; balance: number; reservedBalance: number }> {
  await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
  const rows = await tx.$queryRawUnsafe<{ id: string; balance: number; reservedBalance: number }[]>(
    'SELECT "id", "balance", "reservedBalance" FROM "Wallet" WHERE "userId" = $1::uuid FOR UPDATE',
    userId,
  );
  return rows[0];
}

/** Validates that a string is a UUID before using it in queries (avoids DB cast errors on bad input). */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_REGEX.test(v);
