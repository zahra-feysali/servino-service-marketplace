import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/**
 * Finance against a real PostgreSQL database: wallet top-up, order payment by wallet and by the
 * simulated gateway, frozen commission, escrow release on completion, refunds on cancellation,
 * idempotent callbacks and concurrent payment attempts.
 */
describe.skipIf(!DB_AVAILABLE)("finance: wallet, order payments and escrow (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { submitServiceRequest } = await import("@/features/requests/service");
  const { submitOffer, selectOffer } = await import("@/features/offers/service");
  const { changeOrderStatus } = await import("@/features/orders/service");
  const { createTopUp, completeSimulatedPayment } = await import("@/features/payments/service");
  const { payOrderWithWallet, startOrderGatewayPayment, COMMISSION_SETTING_KEY } = await import("@/features/finance/service");
  const { getFinanceSummary } = await import("@/features/finance/queries");

  const tag = randomUUID().slice(0, 8);
  const ids = {} as Record<string, string>;
  const users: string[] = [];
  let phoneSeq = Number(String(Date.now()).slice(-6)) * 10 + 3;
  const nextPhone = () => `0936${String(phoneSeq++).padStart(7, "0").slice(-7)}`;
  let previousCommission: unknown = undefined;

  let customer: { id: string };
  let intruder: { id: string };
  let admin: { id: string };
  let provider: { userId: string; profileId: string };

  const balanceOf = async (userId: string) => (await prisma.wallet.findUnique({ where: { userId } }))?.balance ?? 0;
  const providerActor = () => ({ id: provider.userId, role: "PROVIDER" as const });
  const customerActor = () => ({ id: customer.id, role: "CUSTOMER" as const });

  async function makeUser(role: "CUSTOMER" | "PROVIDER" | "ADMIN", name: string) {
    const user = await prisma.user.create({ data: { fullName: name, phone: nextPhone(), passwordHash: "x", role } });
    users.push(user.id);
    return user;
  }

  async function setCommission(bps: number) {
    await prisma.siteSetting.upsert({ where: { key: COMMISSION_SETTING_KEY }, update: { value: bps }, create: { key: COMMISSION_SETTING_KEY, value: bps } });
  }

  /** Creates a request, an offer for `price` and selects it → returns the new order id. */
  async function makeOrder(price: number) {
    const { requestId } = await submitServiceRequest(
      customer.id,
      { base: { serviceId: ids.service, cityId: ids.city, addressText: "تهران، خیابان آزمایشی مالی، پلاک ۲" }, answers: { area: 60 } },
      [],
    );
    await submitOffer(provider.userId, requestId, { price, estimatedDuration: 2, estimatedDurationUnit: "HOUR", description: "پیشنهاد آزمایشی بخش مالی" });
    const offer = await prisma.providerOffer.findFirstOrThrow({ where: { requestId } });
    await selectOffer(customer.id, requestId, offer.id);
    const order = await prisma.order.findUniqueOrThrow({ where: { requestId }, select: { id: true } });
    await changeOrderStatus(providerActor(), order.id, "ACCEPTED");
    return order.id;
  }

  beforeAll(async () => {
    previousCommission = (await prisma.siteSetting.findUnique({ where: { key: COMMISSION_SETTING_KEY } }))?.value;
    const province = await prisma.province.create({ data: { name: `fprov-${tag}`, slug: `fprov-${tag}` } });
    const city = await prisma.city.create({ data: { name: `fcity-${tag}`, slug: `fcity-${tag}`, provinceId: province.id } });
    const category = await prisma.category.create({ data: { name: `fcat-${tag}`, slug: `fcat-${tag}` } });
    const service = await prisma.service.create({ data: { name: `fsvc-${tag}`, slug: `fsvc-${tag}`, categoryId: category.id } });
    await prisma.serviceFormField.create({
      data: { serviceId: service.id, name: "area", label: "متراژ", type: "NUMBER", isRequired: true, sortOrder: 0, config: { min: 10, max: 500 } },
    });
    const plan = await prisma.plan.create({ data: { name: `fplan-${tag}`, slug: `fplan-${tag}`, price: 1, durationDays: 1 } });
    Object.assign(ids, { province: province.id, city: city.id, category: category.id, service: service.id, plan: plan.id });

    customer = await makeUser("CUSTOMER", "مشتری مالی");
    intruder = await makeUser("CUSTOMER", "مشتری غریبه");
    admin = await makeUser("ADMIN", "مدیر مالی");
    const pUser = await makeUser("PROVIDER", "متخصص مالی");
    const profile = await prisma.providerProfile.create({ data: { userId: pUser.id, displayName: "متخصص مالی", verificationStatus: "APPROVED" } });
    await prisma.providerService.create({ data: { providerId: profile.id, serviceId: service.id } });
    await prisma.serviceArea.create({ data: { providerId: profile.id, cityId: city.id } });
    await prisma.subscription.create({
      data: {
        userId: pUser.id, planId: plan.id, status: "ACTIVE", startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86_400_000),
        planSnapshot: { name: "t", price: 1, durationDays: 1, maxRequestsPerPeriod: null, maxOffersPerPeriod: null },
      },
    });
    provider = { userId: pUser.id, profileId: profile.id };
    await setCommission(1_250); // 12.5 %
  });

  afterAll(async () => {
    const requestIds = (await prisma.serviceRequest.findMany({ where: { serviceId: ids.service }, select: { id: true } })).map((r) => r.id);
    const orderIds = (await prisma.order.findMany({ where: { requestId: { in: requestIds } }, select: { id: true } })).map((o) => o.id);
    await prisma.orderSettlement.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: users } } } });
    await prisma.withdrawalEvent.deleteMany({ where: { withdrawal: { userId: { in: users } } } });
    await prisma.withdrawalRequest.deleteMany({ where: { userId: { in: users } } });
    await prisma.payment.deleteMany({ where: { userId: { in: users } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: users } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.requestMatch.deleteMany({ where: { requestId: { in: requestIds } } });
    await prisma.providerOffer.deleteMany({ where: { requestId: { in: requestIds } } });
    await prisma.requestStatusHistory.deleteMany({ where: { requestId: { in: requestIds } } });
    await prisma.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: users } } });
    await prisma.providerService.deleteMany({ where: { serviceId: ids.service } });
    await prisma.serviceArea.deleteMany({ where: { cityId: ids.city } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.plan.delete({ where: { id: ids.plan } });
    await prisma.service.delete({ where: { id: ids.service } });
    await prisma.category.delete({ where: { id: ids.category } });
    await prisma.city.deleteMany({ where: { provinceId: ids.province } });
    await prisma.province.delete({ where: { id: ids.province } });
    if (previousCommission === undefined) await prisma.siteSetting.deleteMany({ where: { key: COMMISSION_SETTING_KEY } });
    else await prisma.siteSetting.update({ where: { key: COMMISSION_SETTING_KEY }, data: { value: previousCommission as number } });
    await prisma.$disconnect();
  });

  it("tops up the customer wallet once, even when the gateway callback repeats", async () => {
    const topUp = await createTopUp(customer.id, 1_000_000);
    await expect(completeSimulatedPayment(intruder.id, topUp.id, "SUCCESS")).rejects.toThrow();
    await completeSimulatedPayment(customer.id, topUp.id, "SUCCESS");
    const again = await completeSimulatedPayment(customer.id, topUp.id, "SUCCESS");
    expect(again).toMatchObject({ alreadySettled: true });
    expect(await balanceOf(customer.id)).toBe(1_000_000);
    const txs = await prisma.walletTransaction.findMany({ where: { paymentId: topUp.id } });
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ type: "CREDIT", reason: "TOP_UP", amount: 1_000_000, balanceAfter: 1_000_000 });
  });

  it("rejects wallet payment with insufficient balance and by non-owners", async () => {
    const orderId = await makeOrder(5_000_000);
    await expect(payOrderWithWallet(customer.id, orderId)).rejects.toThrow("موجودی");
    await expect(payOrderWithWallet(intruder.id, orderId)).rejects.toThrow();
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("UNPAID");
    expect(await balanceOf(customer.id)).toBe(1_000_000);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
    // Cancelling an unpaid order moves no money.
    await changeOrderStatus(customerActor(), orderId, "CANCELLED", "منصرف شدم");
    expect(await prisma.orderSettlement.count({ where: { orderId } })).toBe(0);
    expect(await balanceOf(customer.id)).toBe(1_000_000);
  });

  let walletOrderId: string;

  it("pays from the wallet exactly once under concurrent attempts and freezes the commission", async () => {
    walletOrderId = await makeOrder(400_000);
    const results = await Promise.allSettled([payOrderWithWallet(customer.id, walletOrderId), payOrderWithWallet(customer.id, walletOrderId)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balanceOf(customer.id)).toBe(600_000);
    await expect(payOrderWithWallet(customer.id, walletOrderId)).rejects.toThrow();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: walletOrderId }, include: { settlement: true } });
    expect(order.paymentStatus).toBe("PAID");
    expect(order.settlement).toMatchObject({ status: "HELD", grossAmount: 400_000, commissionRateBps: 1_250, commissionAmount: 50_000, providerAmount: 350_000 });
    // Changing the global rate later does not affect an already-paid order.
    await setCommission(2_000);
  });

  it("releases the provider share only when the customer confirms completion", async () => {
    expect(await balanceOf(provider.userId)).toBe(0);
    await changeOrderStatus(providerActor(), walletOrderId, "IN_PROGRESS");
    await changeOrderStatus(providerActor(), walletOrderId, "PROVIDER_COMPLETED");
    expect(await balanceOf(provider.userId)).toBe(0);
    expect((await prisma.orderSettlement.findUniqueOrThrow({ where: { orderId: walletOrderId } })).status).toBe("HELD");

    await changeOrderStatus(customerActor(), walletOrderId, "COMPLETED");
    const s = await prisma.orderSettlement.findUniqueOrThrow({ where: { orderId: walletOrderId } });
    expect(s.status).toBe("RELEASED");
    expect(s.releasedAt).not.toBeNull();
    expect(await balanceOf(provider.userId)).toBe(350_000);
    const earning = await prisma.walletTransaction.findMany({ where: { orderId: walletOrderId, reason: "ORDER_EARNING" } });
    expect(earning).toHaveLength(1);
    expect(earning[0].amount).toBe(350_000);
  });

  let gatewayOrderId: string;

  it("pays an order through the simulated gateway idempotently, at the new commission rate", async () => {
    gatewayOrderId = await makeOrder(300_000);
    const first = await startOrderGatewayPayment(customer.id, gatewayOrderId);
    const reused = await startOrderGatewayPayment(customer.id, gatewayOrderId);
    expect(reused.paymentId).toBe(first.paymentId);
    await expect(startOrderGatewayPayment(intruder.id, gatewayOrderId)).rejects.toThrow();

    await completeSimulatedPayment(customer.id, first.paymentId, "SUCCESS");
    await completeSimulatedPayment(customer.id, first.paymentId, "SUCCESS");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: gatewayOrderId }, include: { settlement: true } });
    expect(order.paymentStatus).toBe("PAID");
    expect(order.settlement).toMatchObject({ commissionRateBps: 2_000, commissionAmount: 60_000, providerAmount: 240_000, status: "HELD" });
    expect(await prisma.orderSettlement.count({ where: { orderId: gatewayOrderId } })).toBe(1);
    expect(await balanceOf(customer.id)).toBe(600_000); // gateway money does not touch the wallet
  });

  it("refunds the full amount to the customer wallet when a paid order is cancelled after a dispute", async () => {
    await changeOrderStatus(providerActor(), gatewayOrderId, "IN_PROGRESS");
    await changeOrderStatus(customerActor(), gatewayOrderId, "DISPUTED", "کار انجام نشد");
    await changeOrderStatus({ id: admin.id, role: "ADMIN" }, gatewayOrderId, "CANCELLED", "بررسی شد؛ بازپرداخت");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: gatewayOrderId }, include: { settlement: true } });
    expect(order.paymentStatus).toBe("REFUNDED");
    expect(order.settlement?.status).toBe("REFUNDED");
    expect(await balanceOf(customer.id)).toBe(900_000);
    expect(await balanceOf(provider.userId)).toBe(350_000);
  });

  it("credits a stale gateway payment back to the wallet instead of charging twice", async () => {
    const orderId = await makeOrder(100_000);
    const gw = await startOrderGatewayPayment(customer.id, orderId);
    await payOrderWithWallet(customer.id, orderId); // wallet wins first
    expect(await balanceOf(customer.id)).toBe(800_000);
    await completeSimulatedPayment(customer.id, gw.paymentId, "SUCCESS"); // gateway callback arrives later
    expect(await balanceOf(customer.id)).toBe(900_000);
    expect(await prisma.orderSettlement.count({ where: { orderId } })).toBe(1);
    const refund = await prisma.walletTransaction.findFirstOrThrow({ where: { paymentId: gw.paymentId } });
    expect(refund).toMatchObject({ type: "CREDIT", reason: "REFUND", amount: 100_000 });
  });

  it("keeps every wallet balance equal to its transaction history", async () => {
    for (const userId of [customer.id, provider.userId]) {
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId }, include: { transactions: { orderBy: { createdAt: "asc" } } } });
      const sum = wallet.transactions.reduce((acc, t) => acc + (t.type === "CREDIT" ? t.amount : -t.amount), 0);
      expect(sum).toBe(wallet.balance);
      expect(wallet.transactions.at(-1)?.balanceAfter).toBe(wallet.balance);
    }
    const summary = await getFinanceSummary({});
    expect(summary.commissionEarned).toBeGreaterThanOrEqual(50_000);
    expect(summary.heldGross).toBeGreaterThanOrEqual(100_000);
  });

  it("lets the provider withdraw released earnings without changing commission or platform revenue", async () => {
    const { saveBankAccount, requestWithdrawal, approveWithdrawal, markWithdrawalPaid } = await import("@/features/withdrawals/service");
    const before = await getFinanceSummary({});
    const balance = await balanceOf(provider.userId);
    expect(balance).toBeGreaterThan(0); // released order earnings

    // Customers' order payments and pending escrow cannot be withdrawn by the provider: only the wallet balance.
    await saveBankAccount(provider.userId, { holderName: "متخصص آزمون مالی", iban: "IR050170000000123456789012" });
    await expect(requestWithdrawal(provider.userId, { amount: balance + 1, clientKey: randomUUID() })).rejects.toThrow();
    const w = await requestWithdrawal(provider.userId, { amount: balance, clientKey: randomUUID() });
    await approveWithdrawal(admin.id, w.id);
    await markWithdrawalPaid(admin.id, w.id, { reference: `FIN-${tag}`, note: null });
    expect(await balanceOf(provider.userId)).toBe(0);

    const after = await getFinanceSummary({});
    expect(after.commissionEarned).toBe(before.commissionEarned);
    expect(after.platformRevenue).toBe(before.platformRevenue); // payouts are not revenue
    expect(after.payoutsTotal).toBe(before.payoutsTotal + balance);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: provider.userId }, include: { transactions: true } });
    expect(wallet.transactions.reduce((acc, t) => acc + (t.type === "CREDIT" ? t.amount : -t.amount), 0)).toBe(wallet.balance);
  });
});
