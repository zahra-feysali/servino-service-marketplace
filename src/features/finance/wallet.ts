import type { TxClient } from "@/lib/prisma";
import { lockWallet } from "@/lib/db-locks";
import { AppError } from "@/lib/errors";
import { walletBalanceAfterCredit, walletBalanceAfterDebit } from "@/features/payments/rules";
import { formatPrice } from "@/lib/utils";
import type { WalletTransactionReason } from "@/generated/prisma/enums";

/**
 * The only two functions that change a wallet balance. Both must run inside a transaction:
 * the wallet row is locked (`SELECT … FOR UPDATE`), the new balance is computed with the pure
 * rules (never negative), and a WalletTransaction with `balanceAfter` is always written.
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

export async function debitWallet(tx: TxClient, userId: string, amount: number, reason: WalletTransactionReason, ref: Ref = {}) {
  const wallet = await lockWallet(tx, userId);
  let balance: number;
  try {
    balance = walletBalanceAfterDebit(wallet.balance, amount);
  } catch {
    throw new AppError(`موجودی کیف پول کافی نیست (موجودی: ${formatPrice(wallet.balance)}).`, "INSUFFICIENT_BALANCE");
  }
  await tx.wallet.update({ where: { id: wallet.id }, data: { balance } });
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, type: "DEBIT", reason, amount, balanceAfter: balance, paymentId: ref.paymentId ?? null, orderId: ref.orderId ?? null, description: ref.description ?? null },
  });
  return balance;
}
