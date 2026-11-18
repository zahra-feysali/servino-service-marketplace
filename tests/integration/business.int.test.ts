import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/**
 * Phase 3 business features against PostgreSQL: subscriptions + simulated payments + wallet,
 * provider verification, support tickets, review moderation and featured ordering.
 */
describe.skipIf(!DB_AVAILABLE)("business features (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { purchaseSubscription, expireDueSubscriptions } = await import("@/features/subscriptions/service");
  const { completeSimulatedPayment, createTopUp } = await import("@/features/payments/service");
  const { submitForVerification, setProviderAreas, setProviderServices, updateProviderProfile } = await import("@/features/providers/profile-service");
  const { adminReviewProvider } = await import("@/features/users/admin-service");
  const { createTicket, replyToTicket, setTicketClosed } = await import("@/features/tickets/service");
  const { setReviewStatus } = await import("@/features/admin/service");
  const { listPublicProviders } = await import("@/features/providers/public-queries");

  const tag = randomUUID().slice(0, 8);
  const users: string[] = [];
  let seq = Number(String(Date.now()).slice(-6)) * 10;
  const phone = () => `0936${String(seq++).padStart(7, "0").slice(-7)}`;
  const ids = {} as Record<string, string>;

  async function user(role: "CUSTOMER" | "PROVIDER" | "ADMIN") {
    const u = await prisma.user.create({ data: { fullName: `کاربر ${role}`, phone: phone(), passwordHash: "x", role } });
    users.push(u.id);
    return u;
  }

  let provider: { id: string };
  let profileId: string;
  let admin: { id: string };
  let customer: { id: string };

  beforeAll(async () => {
    const plan = await prisma.plan.create({ data: { name: `plan-${tag}`, slug: `plan-${tag}`, price: 100_000, durationDays: 30, maxRequestsPerPeriod: 10, maxOffersPerPeriod: 10 } });
    const province = await prisma.province.create({ data: { name: `p-${tag}`, slug: `p-${tag}` } });
    const city = await prisma.city.create({ data: { name: `c-${tag}`, slug: `c-${tag}`, provinceId: province.id } });
    const category = await prisma.category.create({ data: { name: `cat-${tag}`, slug: `cat-${tag}` } });
    const service = await prisma.service.create({ data: { name: `svc-${tag}`, slug: `svc-${tag}`, categoryId: category.id } });
    Object.assign(ids, { plan: plan.id, province: province.id, city: city.id, category: category.id, service: service.id });
    provider = await user("PROVIDER");
    admin = await user("ADMIN");
    customer = await user("CUSTOMER");
    profileId = (await prisma.providerProfile.create({ data: { userId: provider.id, displayName: `متخصص ${tag}` } })).id;
  });

  afterAll(async () => {
    await prisma.featuredProvider.deleteMany({ where: { providerId: profileId } });
    await prisma.ticketMessage.deleteMany({ where: { ticket: { userId: { in: users } } } });
    await prisma.supportTicket.deleteMany({ where: { userId: { in: users } } });
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: users } } } });
    await prisma.payment.deleteMany({ where: { userId: { in: users } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: users } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.providerDocument.deleteMany({ where: { providerId: profileId } });
    await prisma.providerService.deleteMany({ where: { providerId: profileId } });
    await prisma.serviceArea.deleteMany({ where: { providerId: profileId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.plan.delete({ where: { id: ids.plan } });
    await prisma.service.delete({ where: { id: ids.service } });
    await prisma.category.delete({ where: { id: ids.category } });
    await prisma.city.delete({ where: { id: ids.city } });
    await prisma.province.delete({ where: { id: ids.province } });
    await prisma.$disconnect();
  });

  it("buys a subscription through the simulated gateway (success activates once)", async () => {
    const r = await purchaseSubscription(provider.id, ids.plan, "GATEWAY");
    expect(r.status).toBe("PENDING");
    const pending = await prisma.subscription.findFirstOrThrow({ where: { userId: provider.id } });
    expect(pending.status).toBe("PENDING");

    await expect(completeSimulatedPayment(customer.id, r.paymentId, "SUCCESS")).rejects.toThrow();
    await completeSimulatedPayment(provider.id, r.paymentId, "SUCCESS");
    // A repeated callback is idempotent: it reports the existing result and changes nothing.
    await expect(completeSimulatedPayment(provider.id, r.paymentId, "SUCCESS")).resolves.toMatchObject({ status: "SUCCEEDED", alreadySettled: true });
    await expect(completeSimulatedPayment(provider.id, r.paymentId, "FAIL")).resolves.toMatchObject({ status: "SUCCEEDED", alreadySettled: true });
    expect(await prisma.subscription.count({ where: { userId: provider.id, status: "ACTIVE" } })).toBe(1);

    const active = await prisma.subscription.findUniqueOrThrow({ where: { id: pending.id } });
    expect(active.status).toBe("ACTIVE");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: r.paymentId } });
    expect(payment).toMatchObject({ status: "SUCCEEDED", isSimulated: true, amount: 100_000 });
    expect(payment.trackingCode?.startsWith("SIM-")).toBe(true);
  });

  it("cancels the subscription when the simulated payment fails", async () => {
    const r = await purchaseSubscription(provider.id, ids.plan, "GATEWAY");
    await completeSimulatedPayment(provider.id, r.paymentId, "FAIL");
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: r.paymentId }, include: { subscription: true } });
    expect(p.status).toBe("FAILED");
    expect(p.subscription?.status).toBe("CANCELLED");
  });

  it("tops up the wallet and pays a renewal from it (stacked after the current one)", async () => {
    await expect(purchaseSubscription(provider.id, ids.plan, "WALLET")).rejects.toThrow("موجودی");
    const topUp = await createTopUp(provider.id, 150_000);
    await completeSimulatedPayment(provider.id, topUp.id, "SUCCESS");
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId: provider.id } })).balance).toBe(150_000);

    const r = await purchaseSubscription(provider.id, ids.plan, "WALLET");
    expect(r.status).toBe("SUCCEEDED");
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: provider.id }, include: { transactions: true } });
    expect(wallet.balance).toBe(50_000);
    expect(wallet.transactions.map((t) => t.type).sort()).toEqual(["CREDIT", "DEBIT"]);

    const subs = await prisma.subscription.findMany({ where: { userId: provider.id, status: "ACTIVE" }, orderBy: { startsAt: "asc" } });
    expect(subs).toHaveLength(2);
    expect(subs[1].startsAt!.getTime()).toBe(subs[0].endsAt!.getTime());
  });

  it("expires subscriptions past their end date", async () => {
    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: provider.id, status: "ACTIVE" } });
    await prisma.subscription.update({ where: { id: sub.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    expect(await expireDueSubscriptions()).toBeGreaterThanOrEqual(1);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("EXPIRED");
  });

  it("runs the provider verification workflow", async () => {
    await expect(submitForVerification(provider.id)).rejects.toThrow();
    await updateProviderProfile(provider.id, { displayName: `متخصص ${tag}`, bio: "توضیحات حرفه‌ای کامل برای بررسی توسط مدیر سیستم", yearsOfExperience: 5 });
    await setProviderServices(provider.id, [ids.service]);
    await setProviderAreas(provider.id, [ids.city]);
    await prisma.providerDocument.create({
      data: { providerId: profileId, type: "NATIONAL_ID", title: "کارت ملی", storageKey: `2026/11/${randomUUID()}.pdf`, fileName: "id.pdf", mimeType: "application/pdf", size: 10 },
    });
    await submitForVerification(provider.id);
    await expect(adminReviewProvider(admin.id, profileId, "REJECT", "")).rejects.toThrow();
    await adminReviewProvider(admin.id, profileId, "APPROVE");
    const p = await prisma.providerProfile.findUniqueOrThrow({ where: { id: profileId }, include: { documents: true } });
    expect(p.verificationStatus).toBe("APPROVED");
    expect(p.documents.every((d) => d.status === "APPROVED")).toBe(true);
  });

  it("orders featured providers first in public listings", async () => {
    await prisma.featuredProvider.create({
      data: { providerId: profileId, placement: "SEARCH", startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86_400_000) },
    });
    const list = await listPublicProviders({ serviceSlug: `svc-${tag}`, placement: "SEARCH" });
    expect(list[0]).toMatchObject({ id: profileId, isFeatured: true });
  });

  it("handles support tickets with ownership and status changes", async () => {
    const t = await createTicket({ id: customer.id, role: "CUSTOMER" }, { subject: "سؤال آزمایشی", category: "GENERAL", message: "متن پیام آزمایشی", orderId: null });
    await expect(replyToTicket({ id: provider.id, role: "PROVIDER" }, t.id, "دسترسی ندارد")).rejects.toThrow();
    await replyToTicket({ id: admin.id, role: "ADMIN" }, t.id, "پاسخ پشتیبانی");
    expect((await prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("ANSWERED");
    await setTicketClosed({ id: customer.id, role: "CUSTOMER" }, t.id, true);
    await replyToTicket({ id: customer.id, role: "CUSTOMER" }, t.id, "دوباره سؤال دارم");
    expect((await prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("CUSTOMER_REPLY");
  });

  it("recomputes provider rating when a review is hidden", async () => {
    // Minimal completed order + review fixture.
    const req = await prisma.serviceRequest.create({
      data: { customerId: customer.id, serviceId: ids.service, cityId: ids.city, answers: {}, formSnapshot: [], formVersion: 1, status: "COMPLETED" },
    });
    const offer = await prisma.providerOffer.create({ data: { requestId: req.id, providerId: profileId, price: 1000, estimatedDuration: 1, description: "پیشنهاد", status: "ACCEPTED" } });
    const order = await prisma.order.create({ data: { requestId: req.id, offerId: offer.id, customerId: customer.id, providerId: profileId, serviceId: ids.service, price: 1000, status: "COMPLETED" } });
    const review = await prisma.review.create({ data: { orderId: order.id, customerId: customer.id, providerId: profileId, rating: 2 } });
    await setReviewStatus(review.id, "PUBLISHED");
    expect((await prisma.providerProfile.findUniqueOrThrow({ where: { id: profileId } })).ratingCount).toBe(1);
    await setReviewStatus(review.id, "HIDDEN");
    const p = await prisma.providerProfile.findUniqueOrThrow({ where: { id: profileId } });
    expect(p).toMatchObject({ ratingCount: 0, ratingAverage: 0 });
    await prisma.review.delete({ where: { id: review.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.providerOffer.delete({ where: { id: offer.id } });
    await prisma.serviceRequest.delete({ where: { id: req.id } });
  });
});
