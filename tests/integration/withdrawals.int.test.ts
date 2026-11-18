import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/**
 * Provider withdrawals against a real PostgreSQL database: reservation, approval, manual payout,
 * rejection, cancellation, ownership, idempotency, concurrency, rollback and ledger reconciliation.
 */
describe.skipIf(!DB_AVAILABLE)("provider withdrawals (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { creditWallet, debitWallet, reserveWalletFunds } = await import("@/features/finance/wallet");
  const svc = await import("@/features/withdrawals/service");
  const { getWithdrawalBalances, findWalletLedgerMismatches, adminListWithdrawals } = await import("@/features/withdrawals/queries");

  const IBAN_A = "IR050170000000123456789012";
  const IBAN_B = "IR360120000000000987654321";
  const users: string[] = [];
  let seq = Number(String(Date.now()).slice(-6)) * 10 + 7;
  const phone = () => `0938${String(seq++).padStart(7, "0").slice(-7)}`;
  let previousMin: unknown = undefined;

  let admin = "";
  let p1 = "";
  let p2 = "";
  let customer = "";

  async function mkUser(role: "CUSTOMER" | "PROVIDER" | "ADMIN", name: string) {
    const u = await prisma.user.create({ data: { fullName: name, phone: phone(), passwordHash: "x", role } });
    users.push(u.id);
    if (role === "PROVIDER") await prisma.providerProfile.create({ data: { userId: u.id, displayName: name, verificationStatus: "APPROVED" } });
    return u.id;
  }
  const fund = (userId: string, amount: number) =>
    prisma.$transaction((tx) => creditWallet(tx, userId, amount, "ORDER_EARNING", { description: "سهم آزمایشی" }));
  const balances = (userId: string) => getWithdrawalBalances(userId);
  const request = (userId: string, amount: number, clientKey = randomUUID()) => svc.requestWithdrawal(userId, { amount, clientKey });
  const ledgerOf = async (userId: string) => {
    const txs = await prisma.walletTransaction.findMany({ where: { wallet: { userId } }, select: { type: true, amount: true } });
    return txs.reduce((a, t) => a + (t.type === "CREDIT" ? t.amount : -t.amount), 0);
  };
  const notifications = (userId: string, title: string) =>
    prisma.notification.count({ where: { userId, type: "WITHDRAWAL_UPDATE", title: { contains: title } } });

  beforeAll(async () => {
    previousMin = (await prisma.siteSetting.findUnique({ where: { key: svc.MIN_WITHDRAWAL_SETTING_KEY } }))?.value;
    await prisma.siteSetting.deleteMany({ where: { key: svc.MIN_WITHDRAWAL_SETTING_KEY } });
    admin = await mkUser("ADMIN", "مدیر برداشت");
    p1 = await mkUser("PROVIDER", "متخصص برداشت یک");
    p2 = await mkUser("PROVIDER", "متخصص برداشت دو");
    customer = await mkUser("CUSTOMER", "مشتری برداشت");
    await svc.saveBankAccount(p1, { holderName: "متخصص برداشت یک", iban: IBAN_A });
    await svc.saveBankAccount(p2, { holderName: "متخصص برداشت دو", iban: IBAN_B });
    await fund(p1, 2_000_000);
    await fund(p2, 1_000_000);
  });

  afterAll(async () => {
    const reqs = await prisma.withdrawalRequest.findMany({ where: { userId: { in: users } }, select: { id: true } });
    const reqIds = reqs.map((r) => r.id);
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: users } } } });
    await prisma.withdrawalEvent.deleteMany({ where: { withdrawalId: { in: reqIds } } });
    await prisma.withdrawalRequest.deleteMany({ where: { id: { in: reqIds } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.providerBankAccount.deleteMany({ where: { userId: { in: users } } });
    await prisma.providerProfile.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (previousMin !== undefined) {
      await prisma.siteSetting.upsert({
        where: { key: svc.MIN_WITHDRAWAL_SETTING_KEY },
        update: { value: previousMin as number },
        create: { key: svc.MIN_WITHDRAWAL_SETTING_KEY, value: previousMin as number },
      });
    }
    await prisma.$disconnect();
  });

  it("creates a request that reserves the amount without touching the balance or the ledger", async () => {
    const created = await request(p1, 500_000);
    expect(created.status).toBe("PENDING");
    const b = await balances(p1);
    expect(b).toMatchObject({ balance: 2_000_000, reserved: 500_000, available: 1_500_000, openCount: 1 });
    expect(await ledgerOf(p1)).toBe(2_000_000);

    const row = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({ amount: 500_000, ibanSnapshot: IBAN_A, holderNameSnapshot: "متخصص برداشت یک" });
    const events = await prisma.withdrawalEvent.findMany({ where: { withdrawalId: created.id } });
    expect(events.map((e) => [e.type, e.actorId])).toEqual([["CREATED", p1]]);
    expect(await notifications(p1, "ثبت شد")).toBe(1);
  });

  it("refuses amounts above the available balance, without a bank account, or below the minimum", async () => {
    await expect(request(p1, 1_500_001)).rejects.toThrow("موجودی قابل برداشت");
    await svc.setMinWithdrawal(100_000);
    await expect(request(p1, 50_000)).rejects.toThrow("حداقل");
    await svc.setMinWithdrawal(0);
    const noBank = await mkUser("PROVIDER", "متخصص بدون حساب");
    await fund(noBank, 100_000);
    await expect(request(noBank, 10_000)).rejects.toThrow("حساب بانکی");
    expect((await balances(p1)).reserved).toBe(500_000); // nothing changed
  });

  it("keeps the bank details snapshot when the provider changes the account later", async () => {
    const created = await request(p1, 100_000);
    await svc.saveBankAccount(p1, { holderName: "حساب دوم", iban: IBAN_B });
    const row = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.ibanSnapshot).toBe(IBAN_A);
    expect(row.holderNameSnapshot).toBe("متخصص برداشت یک");
    await svc.saveBankAccount(p1, { holderName: "متخصص برداشت یک", iban: IBAN_A });
    await svc.cancelWithdrawal(p1, created.id);
  });

  it("enforces ownership and roles", async () => {
    const own = await request(p1, 10_000);
    await expect(svc.cancelWithdrawal(p2, own.id)).rejects.toThrow("یافت نشد"); // another provider: not found
    await expect(request(customer, 1_000)).rejects.toThrow(); // customers cannot withdraw
    await expect(svc.saveBankAccount(customer, { holderName: "مشتری", iban: IBAN_A })).rejects.toThrow();
    await expect(svc.approveWithdrawal(p1, own.id)).rejects.toThrow(); // provider is not an admin
    await expect(svc.markWithdrawalPaid(p2, own.id, { reference: "REF-X1", note: null })).rejects.toThrow();
    await expect(svc.rejectWithdrawal(customer, own.id, "دسترسی ندارد")).rejects.toThrow();
    expect((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: own.id } })).status).toBe("PENDING");

    // A suspended provider cannot create or cancel requests.
    await prisma.user.update({ where: { id: p1 }, data: { status: "SUSPENDED" } });
    await expect(request(p1, 1_000)).rejects.toThrow("فعال نیست");
    await expect(svc.cancelWithdrawal(p1, own.id)).rejects.toThrow("فعال نیست");
    await prisma.user.update({ where: { id: p1 }, data: { status: "ACTIVE" } });
    await svc.cancelWithdrawal(p1, own.id);
  });

  it("rejection releases the reservation and a rejected request can never be paid", async () => {
    const before = await balances(p1);
    const r = await request(p1, 300_000);
    expect((await balances(p1)).available).toBe(before.available - 300_000);
    await svc.rejectWithdrawal(admin, r.id, "نام صاحب حساب با متخصص یکسان نیست");
    const after = await balances(p1);
    expect(after.available).toBe(before.available);
    expect(after.balance).toBe(before.balance);
    const row = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(row).toMatchObject({ status: "REJECTED", reviewedById: admin, rejectionReason: "نام صاحب حساب با متخصص یکسان نیست" });
    expect(row.rejectedAt).not.toBeNull();

    await expect(svc.approveWithdrawal(admin, r.id)).rejects.toThrow();
    await expect(svc.markWithdrawalPaid(admin, r.id, { reference: "REF-REJ-1", note: null })).rejects.toThrow();
    await expect(svc.rejectWithdrawal(admin, r.id, "دوباره رد")).rejects.toThrow();
    expect((await balances(p1)).available).toBe(before.available); // released exactly once
  });

  it("approval keeps funds reserved; payout debits exactly once; retries change nothing", async () => {
    const before = await balances(p1);
    const r = await request(p1, 400_000);
    await expect(svc.markWithdrawalPaid(admin, r.id, { reference: "REF-EARLY", note: null })).rejects.toThrow(); // must approve first
    await svc.approveWithdrawal(admin, r.id);
    await expect(svc.approveWithdrawal(admin, r.id)).rejects.toThrow(); // retry
    let b = await balances(p1);
    expect(b).toMatchObject({ balance: before.balance, reserved: before.reserved + 400_000 });
    await expect(svc.cancelWithdrawal(p1, r.id)).rejects.toThrow("پیش از تأیید"); // provider cannot cancel after approval

    await svc.markWithdrawalPaid(admin, r.id, { reference: "BANK-778899", note: "پایا" });
    b = await balances(p1);
    // Available already dropped when the request was made; the payout itself leaves it unchanged.
    expect(b).toMatchObject({ balance: before.balance - 400_000, reserved: before.reserved, available: before.available - 400_000, paidTotal: before.paidTotal + 400_000 });

    // Retried / concurrent payment attempts cannot debit again or notify again.
    const retries = await Promise.allSettled([
      svc.markWithdrawalPaid(admin, r.id, { reference: "BANK-778899", note: null }),
      svc.markWithdrawalPaid(admin, r.id, { reference: "BANK-778800", note: null }),
    ]);
    expect(retries.every((x) => x.status === "rejected")).toBe(true);
    await expect(svc.rejectWithdrawal(admin, r.id, "پس از پرداخت")).rejects.toThrow(); // paid cannot be rejected
    await expect(svc.cancelWithdrawal(p1, r.id)).rejects.toThrow();

    const debits = await prisma.walletTransaction.findMany({ where: { withdrawalId: r.id } });
    expect(debits).toHaveLength(1);
    expect(debits[0]).toMatchObject({ type: "DEBIT", reason: "WITHDRAWAL", amount: 400_000, balanceAfter: before.balance - 400_000 });
    expect(await balances(p1)).toMatchObject({ balance: before.balance - 400_000 });
    expect(await ledgerOf(p1)).toBe(before.balance - 400_000);

    const row = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(row).toMatchObject({ status: "PAID", paidById: admin, payoutReference: "BANK-778899", adminNote: "پایا" });
    const events = await prisma.withdrawalEvent.findMany({ where: { withdrawalId: r.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.type)).toEqual(["CREATED", "APPROVED", "PAID"]);
    const code = (await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: r.id } })).code.toLocaleString("fa-IR", { useGrouping: false });
    expect(await notifications(p1, `${code} تأیید شد`)).toBe(1);
    expect(await notifications(p1, `${code} پرداخت شد`)).toBe(1);
  });

  it("rolls back completely when a step fails", async () => {
    const before = await balances(p2);
    // 1) A failing transaction after reserving leaves no reservation behind.
    await expect(
      prisma.$transaction(async (tx) => {
        await reserveWalletFunds(tx, p2, 200_000);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await balances(p2)).toMatchObject({ reserved: before.reserved, balance: before.balance });

    // 2) Paying with a transfer reference already used by another request fails and changes nothing.
    const r = await request(p2, 150_000);
    await svc.approveWithdrawal(admin, r.id);
    await expect(svc.markWithdrawalPaid(admin, r.id, { reference: "BANK-778899", note: null })).rejects.toThrow("قبلاً");
    expect((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("APPROVED");
    expect(await balances(p2)).toMatchObject({ balance: before.balance, reserved: before.reserved + 150_000 });
    expect(await prisma.walletTransaction.count({ where: { withdrawalId: r.id } })).toBe(0);

    // 3) The database itself refuses a reservation larger than the balance (CHECK constraint).
    await expect(prisma.wallet.update({ where: { userId: p2 }, data: { reservedBalance: 999_999_999 } })).rejects.toThrow();
    await svc.rejectWithdrawal(admin, r.id, "آزمایش بازگشت");
  });

  it("double submissions with the same key create one request", async () => {
    const before = await balances(p2);
    const key = randomUUID();
    const results = await Promise.all([request(p2, 50_000, key), request(p2, 50_000, key), request(p2, 50_000, key)]);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect((await balances(p2)).reserved).toBe(before.reserved + 50_000);
    await svc.cancelWithdrawal(p2, results[0].id);
  });

  it("concurrent requests cannot overspend the available balance", async () => {
    const start = await balances(p2);
    expect(start.available).toBe(1_000_000);
    const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => request(p2, 300_000)));
    const ok = outcomes.filter((o) => o.status === "fulfilled");
    expect(ok).toHaveLength(3); // 3 × 300,000 ≤ 1,000,000 < 4 × 300,000
    const b = await balances(p2);
    expect(b).toMatchObject({ balance: 1_000_000, reserved: 900_000, available: 100_000 });
  });

  it("concurrent spending and withdrawals stay consistent (reserved funds cannot be spent)", async () => {
    // p2: balance 1,000,000, reserved 900,000, available 100,000.
    await expect(prisma.$transaction((tx) => debitWallet(tx, p2, 150_000, "FEATURED_PURCHASE", { description: "آزمایش" }))).rejects.toThrow("قابل استفاده");

    const ops = await Promise.allSettled([
      prisma.$transaction((tx) => debitWallet(tx, p2, 80_000, "FEATURED_PURCHASE", { description: "آزمایش هم‌زمان" })),
      request(p2, 80_000),
      request(p2, 80_000),
      prisma.$transaction((tx) => creditWallet(tx, p2, 10_000, "ADJUSTMENT", { description: "آزمایش هم‌زمان" })),
    ]);
    const b = await balances(p2);
    expect(b.balance).toBeGreaterThanOrEqual(b.reserved);
    expect(b.available).toBeGreaterThanOrEqual(0);
    expect(await ledgerOf(p2)).toBe(b.balance);
    const open = await prisma.withdrawalRequest.aggregate({ where: { userId: p2, status: { in: ["PENDING", "APPROVED"] } }, _sum: { amount: true } });
    expect(open._sum.amount ?? 0).toBe(b.reserved);
    // Of the 80k debit and two 80k requests, at most one could fit into 100k (+10k credit, order-dependent).
    expect(ops.filter((o) => o.status === "fulfilled").length).toBeLessThanOrEqual(3);
  });

  it("reconciles: balance = Σ credits − Σ debits and reserved = Σ open withdrawals; admin search works", async () => {
    const mismatches = await findWalletLedgerMismatches();
    const ours = await prisma.wallet.findMany({ where: { userId: { in: users } }, select: { id: true } });
    expect(mismatches.filter((m) => ours.some((w) => w.id === m.walletId))).toEqual([]);

    const byName = await adminListWithdrawals({ q: "متخصص برداشت دو" });
    expect(byName.items.length).toBeGreaterThan(0);
    expect(byName.items.every((w) => w.user.fullName === "متخصص برداشت دو")).toBe(true);
    const one = byName.items[0];
    const byCode = await adminListWithdrawals({ q: one.code.toLocaleString("fa-IR", { useGrouping: false }) });
    expect(byCode.items.map((w) => w.id)).toContain(one.id);
    const paid = await adminListWithdrawals({ status: "PAID", q: "متخصص برداشت یک" });
    expect(paid.items.every((w) => w.status === "PAID")).toBe(true);
  });
});
