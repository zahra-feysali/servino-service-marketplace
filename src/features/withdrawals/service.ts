import { prisma, type TxClient } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { lockRow, lockWallet } from "@/lib/db-locks";
import { notify } from "@/features/notifications/service";
import { payOutReservedFunds, releaseWalletReservation, reserveWalletFunds } from "@/features/finance/wallet";
import { formatPrice, toPersianDigits } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import {
  WITHDRAWAL_ACTION_ERRORS,
  WITHDRAWAL_TRANSITIONS,
  maskSheba,
  type BankAccountInput,
  type WithdrawalAction,
  type WithdrawalStatusValue,
} from "./rules";

/**
 * Provider withdrawals (manual payouts).
 *
 * Accounting: a request *reserves* its amount on the wallet (Wallet.reservedBalance) without touching
 * the balance or the ledger. Reject/cancel releases the reservation. "Mark as paid" — recorded by an
 * admin after transferring the money outside the application — debits the balance once (one ledger
 * row, unique per withdrawal) and drops the reservation. So at any time:
 *   balance = Σ credits − Σ debits,  reservedBalance = Σ amount of PENDING + APPROVED withdrawals.
 *
 * Every state change runs in one transaction, locking the wallet first and then the withdrawal row
 * (same order everywhere → no deadlocks), and uses a guarded `updateMany(where status = …)`, so a
 * repeated or concurrent action can never apply twice (and never notifies twice).
 */

export const MIN_WITHDRAWAL_SETTING_KEY = "finance.minWithdrawal";
const PROVIDER_LINK = "/dashboard/provider/withdrawals";

export async function getMinWithdrawal(db: TxClient | typeof prisma = prisma): Promise<number> {
  const row = await db.siteSetting.findUnique({ where: { key: MIN_WITHDRAWAL_SETTING_KEY } });
  const v = row?.value;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0;
}

export async function setMinWithdrawal(amount: number) {
  await prisma.siteSetting.upsert({
    where: { key: MIN_WITHDRAWAL_SETTING_KEY },
    update: { value: amount },
    create: { key: MIN_WITHDRAWAL_SETTING_KEY, value: amount },
  });
}

/** The user must be an ACTIVE provider (re-checked from the DB, not only from the session). */
async function assertActiveProvider(db: TxClient | typeof prisma, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
  if (!user || user.role !== "PROVIDER") throw new ForbiddenError("این بخش فقط برای متخصصان است.");
  if (user.status !== "ACTIVE") throw new ForbiddenError("حساب کاربری شما فعال نیست.");
}

async function assertActiveAdmin(db: TxClient, adminId: string) {
  const admin = await db.user.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
  if (!admin || admin.role !== "ADMIN" || admin.status !== "ACTIVE") throw new ForbiddenError();
}

// ── Bank account ────────────────────────────────────────────────────────────

export async function saveBankAccount(userId: string, input: BankAccountInput) {
  await assertActiveProvider(prisma, userId);
  await prisma.providerBankAccount.upsert({
    where: { userId },
    update: { holderName: input.holderName, iban: input.iban },
    create: { userId, holderName: input.holderName, iban: input.iban },
  });
}

// ── Provider actions ────────────────────────────────────────────────────────

/**
 * Creates a withdrawal request and reserves its amount. Idempotent per `clientKey`: a double-submitted
 * form returns the request created by the first submission instead of reserving the amount twice.
 */
export async function requestWithdrawal(userId: string, input: { amount: number; clientKey: string }) {
  return prisma.$transaction(async (tx) => {
    await assertActiveProvider(tx, userId);
    const account = await tx.providerBankAccount.findUnique({ where: { userId }, select: { holderName: true, iban: true } });
    if (!account) throw new AppError("ابتدا اطلاعات حساب بانکی (شبا) خود را ثبت کنید.", "NO_BANK_ACCOUNT");

    // Wallet lock first: serializes all balance work of this user, including concurrent submissions,
    // so the idempotency check below sees any request committed by a parallel double-submit.
    await lockWallet(tx, userId);
    const existing = await tx.withdrawalRequest.findUnique({
      where: { userId_clientKey: { userId, clientKey: input.clientKey } },
      select: { id: true, code: true, amount: true, status: true },
    });
    if (existing) return { ...existing, duplicate: true as const };

    const min = await getMinWithdrawal(tx);
    if (min > 0 && input.amount < min) {
      throw new AppError(`حداقل مبلغ برداشت ${formatPrice(min)} است.`, "BELOW_MINIMUM");
    }
    const { walletId } = await reserveWalletFunds(tx, userId, input.amount);

    const created = await tx.withdrawalRequest.create({
      data: {
        userId,
        walletId,
        amount: input.amount,
        status: "PENDING",
        ibanSnapshot: account.iban,
        holderNameSnapshot: account.holderName,
        clientKey: input.clientKey,
      },
      select: { id: true, code: true, amount: true, status: true },
    });
    await tx.withdrawalEvent.create({
      data: { withdrawalId: created.id, type: "CREATED", actorId: userId, toStatus: "PENDING", metadata: { amount: input.amount, iban: maskSheba(account.iban) } },
    });
    await notify(tx, [
      {
        userId,
        type: "WITHDRAWAL_UPDATE",
        title: `درخواست برداشت ${toPersianDigits(created.code)} ثبت شد`,
        body: `${formatPrice(input.amount)} تا بررسی مدیر برای این درخواست رزرو شد. واریز به‌صورت دستی توسط مدیریت انجام می‌شود.`,
        link: PROVIDER_LINK,
      },
    ]);
    return { ...created, duplicate: false as const };
  });
}

/** Provider cancels their own request while it is still PENDING (before admin approval). */
export async function cancelWithdrawal(userId: string, withdrawalId: string) {
  return prisma.$transaction(async (tx) => {
    await assertActiveProvider(tx, userId);
    // Ownership in the WHERE clause: another provider's request is simply "not found".
    const w = await tx.withdrawalRequest.findFirst({ where: { id: withdrawalId, userId }, select: { id: true } });
    if (!w) throw new NotFoundError("درخواست برداشت یافت نشد.");
    return transition(tx, withdrawalId, "CANCEL", userId, {});
  });
}

// ── Admin actions ───────────────────────────────────────────────────────────

export async function approveWithdrawal(adminId: string, withdrawalId: string) {
  return prisma.$transaction(async (tx) => {
    await assertActiveAdmin(tx, adminId);
    return transition(tx, withdrawalId, "APPROVE", adminId, {});
  });
}

export async function rejectWithdrawal(adminId: string, withdrawalId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    await assertActiveAdmin(tx, adminId);
    return transition(tx, withdrawalId, "REJECT", adminId, { reason });
  });
}

/**
 * Records that the admin has transferred the money to the provider's bank account outside the
 * application. Does NOT initiate any transfer. Debits the wallet exactly once.
 */
export async function markWithdrawalPaid(adminId: string, withdrawalId: string, input: { reference: string; note: string | null }) {
  return prisma.$transaction(async (tx) => {
    await assertActiveAdmin(tx, adminId);
    const usedBy = await tx.withdrawalRequest.findUnique({ where: { payoutReference: input.reference }, select: { id: true, code: true } });
    if (usedBy && usedBy.id !== withdrawalId) {
      throw new AppError(`این کد پیگیری قبلاً برای درخواست ${toPersianDigits(usedBy.code)} ثبت شده است.`, "DUPLICATE_REFERENCE");
    }
    return transition(tx, withdrawalId, "PAY", adminId, { reference: input.reference, note: input.note });
  });
}

// ── Shared transition ───────────────────────────────────────────────────────

type TransitionData = { reason?: string; reference?: string; note?: string | null };

async function transition(tx: TxClient, withdrawalId: string, action: WithdrawalAction, actorId: string, data: TransitionData) {
  const current = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId }, select: { userId: true } });
  if (!current) throw new NotFoundError("درخواست برداشت یافت نشد.");

  // Lock order: wallet → withdrawal row (the same order as requestWithdrawal).
  await lockWallet(tx, current.userId);
  await lockRow(tx, "WithdrawalRequest", withdrawalId);
  const w = await tx.withdrawalRequest.findUniqueOrThrow({
    where: { id: withdrawalId },
    select: { id: true, code: true, userId: true, amount: true, status: true, ibanSnapshot: true },
  });
  const rule = WITHDRAWAL_TRANSITIONS[action];
  if (!rule.from.includes(w.status)) throw new AppError(WITHDRAWAL_ACTION_ERRORS[action], "INVALID_TRANSITION");

  const now = new Date();
  const fields: Prisma.WithdrawalRequestUpdateManyMutationInput & { reviewedById?: string; paidById?: string } = { status: rule.to };
  if (action === "APPROVE") Object.assign(fields, { approvedAt: now, reviewedById: actorId });
  if (action === "REJECT") Object.assign(fields, { rejectedAt: now, rejectionReason: data.reason, reviewedById: actorId });
  if (action === "PAY") Object.assign(fields, { paidAt: now, paidById: actorId, payoutReference: data.reference, adminNote: data.note ?? null });
  if (action === "CANCEL") Object.assign(fields, { cancelledAt: now });

  // Guarded update: only applies if the status is still the one we validated.
  const updated = await tx.withdrawalRequest.updateMany({ where: { id: w.id, status: w.status }, data: fields });
  if (updated.count !== 1) throw new AppError(WITHDRAWAL_ACTION_ERRORS[action], "INVALID_TRANSITION");

  const code = toPersianDigits(w.code);
  if (action === "REJECT" || action === "CANCEL") {
    await releaseWalletReservation(tx, w.userId, w.amount);
  } else if (action === "PAY") {
    await payOutReservedFunds(tx, w.userId, w.amount, w.id, `تسویه درخواست برداشت ${code} — انتقال دستی به ${maskSheba(w.ibanSnapshot)} (پیگیری ${data.reference})`);
  }

  await tx.withdrawalEvent.create({
    data: {
      withdrawalId: w.id,
      type: action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : action === "PAY" ? "PAID" : "CANCELLED",
      actorId,
      fromStatus: w.status,
      toStatus: rule.to,
      note: data.reason ?? data.note ?? null,
      metadata: action === "PAY" ? { reference: data.reference, amount: w.amount } : { amount: w.amount },
    },
  });

  const messages: Record<WithdrawalAction, { title: string; body: string }> = {
    APPROVE: {
      title: `درخواست برداشت ${code} تأیید شد`,
      body: `${formatPrice(w.amount)} در انتظار واریز دستی توسط مدیریت به حساب ${maskSheba(w.ibanSnapshot)} است.`,
    },
    REJECT: {
      title: `درخواست برداشت ${code} رد شد`,
      body: `دلیل: «${data.reason}» — مبلغ ${formatPrice(w.amount)} دوباره قابل برداشت است.`,
    },
    PAY: {
      title: `درخواست برداشت ${code} پرداخت شد`,
      body: `مدیریت انتقال ${formatPrice(w.amount)} به حساب ${maskSheba(w.ibanSnapshot)} را ثبت کرد (کد پیگیری: ${data.reference}).`,
    },
    CANCEL: {
      title: `درخواست برداشت ${code} لغو شد`,
      body: `مبلغ ${formatPrice(w.amount)} دوباره قابل برداشت است.`,
    },
  };
  await notify(tx, [{ userId: w.userId, type: "WITHDRAWAL_UPDATE", ...messages[action], link: PROVIDER_LINK }]);
  return { id: w.id, code: w.code, status: rule.to as WithdrawalStatusValue };
}
