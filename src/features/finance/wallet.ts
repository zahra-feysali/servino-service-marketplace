import type { TxClient } from "@/lib/prisma";
import { lockWallet } from "@/lib/db-locks";
import { AppError } from "@/lib/errors";
import { walletBalanceAfterCredit, walletBalanceAfterDebit } from "@/features/payments/rules";
import { availableBalance } from "@/features/withdrawals/rules";
import { formatPrice } from "@/lib/utils";
import type { WalletTransactionReason } from "@/generated/prisma/enums";

/**
 * The only functions that change a wallet's `balance` or `reservedBalance`. All must run inside a
 * transaction: the wallet row is locked (`SELECT … FOR UPDATE`), new values are computed with the
 * pure rules, and every balance change writes a WalletTransaction with `balanceAfter`.
 *
 * Reservations (open withdrawal requests) do not touch `balance` and write no ledger row: they only
 * lower the *available* balance (balance − reservedBalance). The single payout debit happens when an
 * admin records the manual transfer. The database also enforces 0 ≤ reservedBalance ≤ balance.
 */

type Ref = { paymentId?: string | null; orderId?: string | null; description?: string };

export async function creditWallet(tx: TxClient, userId: string, amount: number, reason: WalletTransactionReason, ref: Ref = {}) {
  const wallet = await lockWallet(tx, userId);
  const balance = walletBalanceAfterCredit(wallet.balance, amount);
  await tx.wallet.update({ where: { id: wallet.id }, data: { balance } });
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, type: "CREDIT", reason, amount, balanceAfter: balance, paymentId: ref.paymentId ?? null, orderId: ref.orderId ?? null, description: ref.description ?? null },
  });
  return balance;
}

/** Spends from the *available* balance: funds reserved for withdrawal requests cannot be spent. */
export async function debitWallet(tx: TxClient, userId: string, amount: number, reason: WalletTransactionReason, ref: Ref = {}) {
  const wallet = await lockWallet(tx, userId);
  const available = availableBalance(wallet.balance, wallet.reservedBalance);
  try {
    walletBalanceAfterDebit(available, amount);
  } catch {
    throw new AppError(`موجودی قابل استفاده کیف پول کافی نیست (قابل استفاده: ${formatPrice(available)}).`, "INSUFFICIENT_BALANCE");
  }
  const balance = wallet.balance - amount;
  await tx.wallet.update({ where: { id: wallet.id }, data: { balance } });
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, type: "DEBIT", reason, amount, balanceAfter: balance, paymentId: ref.paymentId ?? null, orderId: ref.orderId ?? null, description: ref.description ?? null },
  });
  return balance;
}

/** Reserves part of the available balance for a withdrawal request. Returns the locked wallet id. */
export async function reserveWalletFunds(tx: TxClient, userId: string, amount: number) {
  const wallet = await lockWallet(tx, userId);
  const available = availableBalance(wallet.balance, wallet.reservedBalance);
  if (!Number.isInteger(amount) || amount <= 0) throw new AppError("مبلغ نامعتبر است.", "INVALID_AMOUNT");
  if (amount > available) {
    throw new AppError(`مبلغ درخواستی از موجودی قابل برداشت (${formatPrice(available)}) بیشتر است.`, "INSUFFICIENT_BALANCE");
  }
  await tx.wallet.update({ where: { id: wallet.id }, data: { reservedBalance: wallet.reservedBalance + amount } });
  return { walletId: wallet.id, available: available - amount };
}

/** Returns a reservation to the available balance (withdrawal rejected or cancelled). */
export async function releaseWalletReservation(tx: TxClient, userId: string, amount: number) {
  const wallet = await lockWallet(tx, userId);
  if (wallet.reservedBalance < amount) throw new AppError("مبلغ رزروشده کیف پول با درخواست برداشت همخوانی ندارد.", "LEDGER_MISMATCH");
  await tx.wallet.update({ where: { id: wallet.id }, data: { reservedBalance: wallet.reservedBalance - amount } });
}

/**
 * Pays out a reserved withdrawal: balance and reservation both drop by `amount` (available stays the
 * same) and one DEBIT ledger row is written. `withdrawalId` is unique on WalletTransaction, so the
 * same withdrawal can never be debited twice even if application checks were bypassed.
 */
export async function payOutReservedFunds(tx: TxClient, userId: string, amount: number, withdrawalId: string, description: string) {
  const wallet = await lockWallet(tx, userId);
  if (wallet.reservedBalance < amount || wallet.balance < amount) {
    throw new AppError("مبلغ رزروشده کیف پول با درخواست برداشت همخوانی ندارد.", "LEDGER_MISMATCH");
  }
  const balance = wallet.balance - amount;
  await tx.wallet.update({ where: { id: wallet.id }, data: { balance, reservedBalance: wallet.reservedBalance - amount } });
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, type: "DEBIT", reason: "WITHDRAWAL", amount, balanceAfter: balance, withdrawalId, description },
  });
  return balance;
}
