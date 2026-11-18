import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/**
 * End-to-end core workflow against a real PostgreSQL database (requires `prisma migrate dev`):
 * request submission → matching → offers → concurrent selection → order lifecycle → review.
 * Creates isolated fixtures with unique slugs/phones and removes them afterwards.
 */
describe.skipIf(!DB_AVAILABLE)("core marketplace workflow (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { submitServiceRequest, cancelServiceRequest } = await import("@/features/requests/service");
  const { submitOffer, selectOffer, withdrawOffer } = await import("@/features/offers/service");
  const { changeOrderStatus } = await import("@/features/orders/service");
  const { submitReview } = await import("@/features/reviews/service");
  const { payOrderWithWallet } = await import("@/features/finance/service");

  const tag = randomUUID().slice(0, 8);
  const ids = {} as Record<string, string>;
  const users: string[] = [];
  let phoneSeq = Number(String(Date.now()).slice(-6)) * 10;
  const nextPhone = () => `0935${String(phoneSeq++).padStart(7, "0").slice(-7)}`;

  async function makeUser(role: "CUSTOMER" | "PROVIDER", name: string) {
    const user = await prisma.user.create({ data: { fullName: name, phone: nextPhone(), passwordHash: "x", role } });
    users.push(user.id);
    return user;
  }

  async function makeProvider(name: string, opts: { approved?: boolean; city?: string; withSub?: boolean; maxRequests?: number | null; maxOffers?: number | null; used?: number }) {
    const user = await makeUser("PROVIDER", name);
    const profile = await prisma.providerProfile.create({
      data: { userId: user.id, displayName: name, verificationStatus: opts.approved === false ? "PENDING" : "APPROVED" },
    });
    await prisma.providerService.create({ data: { providerId: profile.id, serviceId: ids.service } });
    await prisma.serviceArea.create({ data: { providerId: profile.id, cityId: opts.city ?? ids.city } });
    if (opts.withSub !== false) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: ids.plan,
          status: "ACTIVE",
          startsAt: new Date(Date.now() - 1000),
          endsAt: new Date(Date.now() + 86_400_000),
          requestsReceived: opts.used ?? 0,
          planSnapshot: {
            name: "t",
            price: 1,
            durationDays: 1,
            maxRequestsPerPeriod: opts.maxRequests === undefined ? 10 : opts.maxRequests,
            maxOffersPerPeriod: opts.maxOffers === undefined ? 10 : opts.maxOffers,
          },
        },
      });
    }
    return { user, profile };
  }

  let customer: { id: string };
  let intruder: { id: string };
  let p1: Awaited<ReturnType<typeof makeProvider>>;
  let p2: Awaited<ReturnType<typeof makeProvider>>;
  let p3: Awaited<ReturnType<typeof makeProvider>>;

  beforeAll(async () => {
    const province = await prisma.province.create({ data: { name: `prov-${tag}`, slug: `prov-${tag}` } });
    const city = await prisma.city.create({ data: { name: `city-${tag}`, slug: `city-${tag}`, provinceId: province.id } });
    const otherCity = await prisma.city.create({ data: { name: `city2-${tag}`, slug: `city2-${tag}`, provinceId: province.id } });
    const category = await prisma.category.create({ data: { name: `cat-${tag}`, slug: `cat-${tag}` } });
    const service = await prisma.service.create({ data: { name: `svc-${tag}`, slug: `svc-${tag}`, categoryId: category.id } });
    await prisma.serviceFormField.createMany({
      data: [
        { serviceId: service.id, name: "area", label: "متراژ", type: "NUMBER", isRequired: true, sortOrder: 0, config: { min: 10, max: 500 } },
        { serviceId: service.id, name: "kind", label: "نوع", type: "SELECT", isRequired: true, sortOrder: 1, options: [{ value: "a", label: "A" }] },
      ],
    });
    const plan = await prisma.plan.create({ data: { name: `plan-${tag}`, slug: `plan-${tag}`, price: 1, durationDays: 1 } });
    Object.assign(ids, { province: province.id, city: city.id, otherCity: otherCity.id, category: category.id, service: service.id, plan: plan.id });

    customer = await makeUser("CUSTOMER", "مشتری");
    intruder = await makeUser("CUSTOMER", "مشتری دیگر");
    p1 = await makeProvider("p1", {});
    p2 = await makeProvider("p2", { maxRequests: null, maxOffers: null });
    p3 = await makeProvider("p3", {});
    await makeProvider("pending", { approved: false });
    await makeProvider("other-city", { city: otherCity.id });
    await makeProvider("no-sub", { withSub: false });
    await makeProvider("exhausted", { maxRequests: 2, used: 2 });
  });

  afterAll(async () => {
    const requestIds = (await prisma.serviceRequest.findMany({ where: { serviceId: ids.service }, select: { id: true } })).map((r) => r.id);
    const orderIds = (await prisma.order.findMany({ where: { requestId: { in: requestIds } }, select: { id: true } })).map((o) => o.id);
    await prisma.review.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderSettlement.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: users } } } });
    await prisma.payment.deleteMany({ where: { userId: { in: users } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: users } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.providerOffer.deleteMany({ where: { requestId: { in: requestIds } } });
    await prisma.requestStatusHistory.deleteMany({ where: { requestId: { in: requestIds } } });
    await prisma.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: users } } });
    await prisma.providerService.deleteMany({ where: { serviceId: ids.service } });
    await prisma.serviceArea.deleteMany({ where: { cityId: { in: [ids.city, ids.otherCity] } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.plan.delete({ where: { id: ids.plan } });
    await prisma.service.delete({ where: { id: ids.service } });
    await prisma.category.delete({ where: { id: ids.category } });
    await prisma.city.deleteMany({ where: { provinceId: ids.province } });
    await prisma.province.delete({ where: { id: ids.province } });
    await prisma.$disconnect();
  });

  const submit = (customerId: string, answers: Record<string, unknown> = { area: 80, kind: "a" }) =>
    submitServiceRequest(customerId, { base: { serviceId: ids.service, cityId: ids.city, addressText: "تهران، خیابان آزمایشی، پلاک ۱" }, answers }, []);

  let requestId: string;

  it("rejects invalid dynamic answers", async () => {
    await expect(submit(customer.id, { area: 5, kind: "a" })).rejects.toThrow();
    await expect(submit(customer.id, { area: 80, kind: "zzz" })).rejects.toThrow();
  });

  it("stores the request with a form snapshot and matches only eligible providers", async () => {
    const result = await submit(customer.id);
    requestId = result.requestId;
    expect(result.matchedProviders).toBe(3);

    const req = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId }, include: { matches: true, history: true } });
    expect(req.status).toBe("OPEN");
    expect(Array.isArray(req.formSnapshot) && req.formSnapshot.length).toBe(2);
    expect(req.history.map((h) => h.toStatus)).toEqual(["OPEN"]);
    expect(new Set(req.matches.map((m) => m.providerId))).toEqual(new Set([p1.profile.id, p2.profile.id, p3.profile.id]));

    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: p1.user.id } });
    expect(sub.requestsReceived).toBe(1);
    expect(await prisma.notification.count({ where: { userId: p1.user.id, type: "NEW_REQUEST" } })).toBe(1);
  });

  it("keeps history readable after the service form changes", async () => {
    await prisma.serviceFormField.updateMany({ where: { serviceId: ids.service, name: "kind" }, data: { label: "تغییر کرد", isActive: false } });
    const req = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
    const snapshot = req.formSnapshot as { name: string; label: string }[];
    expect(snapshot.find((f) => f.name === "kind")?.label).toBe("نوع");
  });

  it("lets matched providers submit one offer each and blocks others", async () => {
    await submitOffer(p1.user.id, requestId, { price: 500_000, estimatedDuration: 2, estimatedDurationUnit: "HOUR", description: "پیشنهاد اول آزمایشی" });
    await submitOffer(p2.user.id, requestId, { price: 400_000, estimatedDuration: 1, estimatedDurationUnit: "DAY", description: "پیشنهاد دوم آزمایشی" });
    await submitOffer(p3.user.id, requestId, { price: 450_000, estimatedDuration: 3, estimatedDurationUnit: "HOUR", description: "پیشنهاد سوم آزمایشی" });

    await expect(
      submitOffer(p1.user.id, requestId, { price: 1, estimatedDuration: 1, estimatedDurationUnit: "HOUR", description: "دوباره ارسال شد" }),
    ).rejects.toThrow("قبلاً");

    const unmatched = await prisma.providerProfile.findFirstOrThrow({ where: { displayName: "other-city", userId: { in: users } }, include: { user: true } });
    await expect(
      submitOffer(unmatched.userId, requestId, { price: 1, estimatedDuration: 1, estimatedDurationUnit: "HOUR", description: "بدون تطابق" }),
    ).rejects.toThrow();

    const req = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(req.offerCount).toBe(3);
  });

  it("allows withdrawing a pending offer", async () => {
    const offer = await prisma.providerOffer.findFirstOrThrow({ where: { requestId, providerId: p3.profile.id } });
    await withdrawOffer(p3.user.id, offer.id);
    expect((await prisma.providerOffer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe("WITHDRAWN");
  });

  it("forbids selecting an offer on someone else's request", async () => {
    const offer = await prisma.providerOffer.findFirstOrThrow({ where: { requestId, providerId: p1.profile.id } });
    await expect(selectOffer(intruder.id, requestId, offer.id)).rejects.toThrow();
  });

  it("accepts exactly one offer under concurrent selection", async () => {
    const offers = await prisma.providerOffer.findMany({ where: { requestId, status: "PENDING" } });
    expect(offers).toHaveLength(2);
    const results = await Promise.allSettled(offers.map((o) => selectOffer(customer.id, requestId, o.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    const after = await prisma.providerOffer.findMany({ where: { requestId } });
    expect(after.filter((o) => o.status === "ACCEPTED")).toHaveLength(1);
    expect(await prisma.order.count({ where: { requestId } })).toBe(1);
    const req = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(req.status).toBe("PROVIDER_SELECTED");
  });

  it("enforces order transitions, ownership and records history", async () => {
    const order = await prisma.order.findUniqueOrThrow({ where: { requestId }, include: { offer: true, provider: true } });
    const accepted = order.offer;
    expect(order.price).toBe(accepted.price);
    const providerUser = { id: order.provider.userId, role: "PROVIDER" as const };
    const otherProvider = [p1, p2].find((p) => p.user.id !== order.provider.userId)!;

    await expect(changeOrderStatus({ id: customer.id, role: "CUSTOMER" }, order.id, "ACCEPTED")).rejects.toThrow();
    await expect(changeOrderStatus({ id: otherProvider.user.id, role: "PROVIDER" }, order.id, "ACCEPTED")).rejects.toThrow();
    await expect(changeOrderStatus(providerUser, order.id, "PROVIDER_COMPLETED")).rejects.toThrow();

    await changeOrderStatus(providerUser, order.id, "ACCEPTED");
    // Work cannot start before the customer pays (escrow).
    await expect(changeOrderStatus(providerUser, order.id, "IN_PROGRESS")).rejects.toThrow("پرداخت");
    await prisma.wallet.upsert({ where: { userId: customer.id }, update: { balance: order.price }, create: { userId: customer.id, balance: order.price } });
    await payOrderWithWallet(customer.id, order.id);
    await changeOrderStatus(providerUser, order.id, "IN_PROGRESS");
    await changeOrderStatus(providerUser, order.id, "PROVIDER_COMPLETED");
    await expect(submitReview(customer.id, order.id, { rating: 5 })).rejects.toThrow();
    await changeOrderStatus({ id: customer.id, role: "CUSTOMER" }, order.id, "COMPLETED");

    const done = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { history: true, request: true, provider: true } });
    expect(done.status).toBe("COMPLETED");
    expect(done.history.map((h) => h.toStatus)).toEqual([
      "PENDING_PROVIDER_CONFIRMATION",
      "ACCEPTED",
      "IN_PROGRESS",
      "PROVIDER_COMPLETED",
      "COMPLETED",
    ]);
    expect(done.request.status).toBe("COMPLETED");
    expect(done.provider.completedOrdersCount).toBe(1);
  });

  it("accepts a single review and updates the provider rating", async () => {
    const order = await prisma.order.findUniqueOrThrow({ where: { requestId } });
    await expect(submitReview(intruder.id, order.id, { rating: 1 })).rejects.toThrow();
    await submitReview(customer.id, order.id, { rating: 4, comment: "خوب بود" });
    await expect(submitReview(customer.id, order.id, { rating: 5 })).rejects.toThrow("قبلاً");
    const provider = await prisma.providerProfile.findUniqueOrThrow({ where: { id: order.providerId } });
    expect(provider.ratingAverage).toBe(4);
    expect(provider.ratingCount).toBe(1);
  });

  it("lets a customer cancel an open request and rejects its pending offers", async () => {
    const { requestId: second } = await submit(customer.id);
    await submitOffer(p1.user.id, second, { price: 300_000, estimatedDuration: 1, estimatedDurationUnit: "HOUR", description: "پیشنهاد برای لغو" });
    await expect(cancelServiceRequest(intruder.id, second, "x")).rejects.toThrow();
    await cancelServiceRequest(customer.id, second, "دیگر لازم نیست");
    const req = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: second }, include: { offers: true } });
    expect(req.status).toBe("CANCELLED");
    expect(req.offers.every((o) => o.status === "REJECTED")).toBe(true);
  });
});
