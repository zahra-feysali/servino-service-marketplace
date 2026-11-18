import { prisma } from "@/lib/prisma";
import { pageArgs, toPaginated } from "@/lib/pagination";
import { toEnglishDigits } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import type { WithdrawalStatus } from "@/generated/prisma/enums";
import { availableBalance } from "./rules";
import { getMinWithdrawal } from "./service";

/** Wallet figures for one user: total, reserved by open withdrawals, available, and total paid out. */
export async function getWithdrawalBalances(userId: string) {
  const [wallet, paid, open] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId }, select: { balance: true, reservedBalance: true } }),
    prisma.withdrawalRequest.aggregate({ where: { userId, status: "PAID" }, _sum: { amount: true }, _count: true }),
    prisma.withdrawalRequest.aggregate({ where: { userId, status: { in: ["PENDING", "APPROVED"] } }, _count: true }),
  ]);
  const balance = wallet?.balance ?? 0;
  const reserved = wallet?.reservedBalance ?? 0;
  return {
    balance,
    reserved,
    available: availableBalance(balance, reserved),
    paidTotal: paid._sum.amount ?? 0,
    paidCount: paid._count,
    openCount: open._count,
  };
}

/** Everything the provider withdrawals page needs (always the signed-in provider's own data). */
export async function getProviderWithdrawalPage(userId: string, page = 1) {
  const where = { userId };
  const [balances, bankAccount, minWithdrawal, items, total] = await Promise.all([
    getWithdrawalBalances(userId),
    prisma.providerBankAccount.findUnique({ where: { userId }, select: { holderName: true, iban: true, updatedAt: true } }),
    getMinWithdrawal(),
    prisma.withdrawalRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, code: true, amount: true, status: true, ibanSnapshot: true, createdAt: true,
        approvedAt: true, rejectedAt: true, rejectionReason: true, paidAt: true, payoutReference: true, cancelledAt: true,
      },
    }),
    prisma.withdrawalRequest.count({ where }),
  ]);
  return { balances, bankAccount, minWithdrawal, history: toPaginated(items, total, page) };
}

type AdminFilter = { status?: WithdrawalStatus; q?: string; from?: Date; to?: Date };

export async function adminListWithdrawals(filter: AdminFilter, page = 1) {
  const q = filter.q?.trim();
  const code = q ? Number(toEnglishDigits(q).replace(/\D/g, "")) : NaN;
  const where: Prisma.WithdrawalRequestWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.from || filter.to ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { user: { fullName: { contains: q, mode: "insensitive" } } },
            { user: { phone: { contains: toEnglishDigits(q) } } },
            { user: { providerProfile: { displayName: { contains: q, mode: "insensitive" } } } },
            ...(Number.isInteger(code) && code > 0 && code < 2_147_483_647 ? [{ code }] : []),
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, code: true, amount: true, status: true, ibanSnapshot: true, createdAt: true, paidAt: true,
        user: { select: { fullName: true, phone: true, status: true, providerProfile: { select: { displayName: true } } } },
      },
    }),
    prisma.withdrawalRequest.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

/** Totals for the admin overview (payouts are NOT platform revenue). */
export async function adminWithdrawalSummary() {
  const [byStatus, reserved] = await Promise.all([
    prisma.withdrawalRequest.groupBy({ by: ["status"], _sum: { amount: true }, _count: true }),
    prisma.wallet.aggregate({ _sum: { reservedBalance: true } }),
  ]);
  const get = (s: WithdrawalStatus) => byStatus.find((r) => r.status === s);
  return {
    pendingCount: get("PENDING")?._count ?? 0,
    pendingAmount: get("PENDING")?._sum.amount ?? 0,
    approvedCount: get("APPROVED")?._count ?? 0,
    approvedAmount: get("APPROVED")?._sum.amount ?? 0,
    paidCount: get("PAID")?._count ?? 0,
    paidAmount: get("PAID")?._sum.amount ?? 0,
    rejectedCount: get("REJECTED")?._count ?? 0,
    reservedTotal: reserved._sum.reservedBalance ?? 0,
  };
}

export async function countPendingWithdrawals(): Promise<number> {
  return prisma.withdrawalRequest.count({ where: { status: "PENDING" } });
}

/** Full detail for the admin (complete bank details are visible to admins only). */
export async function adminGetWithdrawal(id: string) {
  const w = await prisma.withdrawalRequest.findUnique({
    where: { id },
    select: {
      id: true, code: true, amount: true, status: true, ibanSnapshot: true, holderNameSnapshot: true, createdAt: true,
      approvedAt: true, rejectedAt: true, rejectionReason: true, paidAt: true, payoutReference: true, adminNote: true, cancelledAt: true,
      userId: true,
      user: {
        select: {
          fullName: true, phone: true, status: true,
          providerProfile: { select: { id: true, displayName: true, verificationStatus: true } },
          bankAccount: { select: { iban: true, holderName: true } },
        },
      },
      reviewedBy: { select: { fullName: true } },
      paidBy: { select: { fullName: true } },
      walletTransaction: { select: { id: true, amount: true, balanceAfter: true, createdAt: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, fromStatus: true, toStatus: true, note: true, metadata: true, createdAt: true, actor: { select: { fullName: true, role: true } } },
      },
    },
  });
  if (!w) return null;
  return { ...w, balances: await getWithdrawalBalances(w.userId) };
}

/**
 * Ledger reconciliation across all wallets: returns wallets whose balance differs from
 * Σ credits − Σ debits, or whose reservation differs from the sum of their open withdrawals.
 */
export async function findWalletLedgerMismatches() {
  return prisma.$queryRawUnsafe<{ walletId: string; balance: number; ledger: number; reserved: number; open: number }[]>(`
    SELECT w."id" AS "walletId", w."balance", w."reservedBalance" AS "reserved",
           COALESCE(t.ledger, 0)::int AS "ledger", COALESCE(o.open, 0)::int AS "open"
    FROM "Wallet" w
    LEFT JOIN (
      SELECT "walletId", SUM(CASE WHEN "type" = 'CREDIT' THEN "amount" ELSE -"amount" END) AS ledger
      FROM "WalletTransaction" GROUP BY "walletId"
    ) t ON t."walletId" = w."id"
    LEFT JOIN (
      SELECT "walletId", SUM("amount") AS open
      FROM "WithdrawalRequest" WHERE "status" IN ('PENDING', 'APPROVED') GROUP BY "walletId"
    ) o ON o."walletId" = w."id"
    WHERE w."balance" <> COALESCE(t.ledger, 0) OR w."reservedBalance" <> COALESCE(o.open, 0)
    LIMIT 50
  `);
}
