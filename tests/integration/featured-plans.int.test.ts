import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/** Self-service featured plans against PostgreSQL: wallet/gateway purchase, activation, renewal, expiry. */
describe.skipIf(!DB_AVAILABLE)("featured plans (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const svc = await import("@/features/featured/purchase-service");
  const { getLiveFeatured } = await import("@/features/featured/service");
  const { completeSimulatedPayment } = await import("@/features/payments/service");

  const tag = randomUUID().slice(0, 8);
  const users: string[] = [];
  let seq = Number(String(Date.now()).slice(-6)) * 10 + 9;
  const phone = () => `0933${String(seq++).padStart(7, "0").slice(-7)}`;
  let provider = { userId: "", profileId: "" };
  let pending = { userId: "" };
  let homePlan = "";
  let searchPlan = "";
  const DAY = 86_400_000;

  beforeAll(async () => {
    const mk = async (name: string, status: "APPROVED" | "PENDING") => {
      const u = await prisma.user.create({ data: { fullName: name, phone: phone(), passwordHash: "x", role: "PROVIDER" } });
      users.push(u.id);
      const p = await prisma.providerProfile.create({ data: { userId: u.id, displayName: name, verificationStatus: status } });
      return { userId: u.id, profileId: p.id };
    };
    provider = await mk("متخصص ویژه", "APPROVED");
    pending = await mk("متخصص در انتظار", "PENDING");
    homePlan = (await prisma.featuredPlan.create({ data: { name: `home ${tag}`, slug: `home-${tag}`, placement: "HOME", durationDays: 30, price: 200_000 } })).id;
    searchPlan = (await prisma.featuredPlan.create({ data: { name: `search ${tag}`, slug: `search-${tag}`, placement: "SEARCH", durationDays: 7, price: 50_000 } })).id;
  });

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: users } } } });
    await prisma.payment.deleteMany({ where: { userId: { in: users } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: users } } });
    await prisma.featuredProvider.deleteMany({ where: { providerId: provider.profileId } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.featuredPlan.deleteMany({ where: { id: { in: [homePlan, searchPlan] } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it("refuses unapproved providers and insufficient wallet balance (nothing is created)", async () => {
    await expect(svc.purchaseFeaturedPlan(pending.userId, homePlan, "WALLET")).rejects.toThrow("تأیید");
    await expect(svc.purchaseFeaturedPlan(provider.userId, homePlan, "WALLET")).rejects.toThrow("موجودی");
    expect(await prisma.featuredProvider.count({ where: { providerId: provider.profileId } })).toBe(0);
    expect(await prisma.payment.count({ where: { userId: provider.userId } })).toBe(0);
  });

  it("buys with the wallet and activates immediately; a renewal stacks after the running period", async () => {
    await prisma.wallet.upsert({ where: { userId: provider.userId }, update: { balance: 500_000 }, create: { userId: provider.userId, balance: 500_000 } });
    const first = await svc.purchaseFeaturedPlan(provider.userId, homePlan, "WALLET");
    expect(first.status).toBe("SUCCEEDED");
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId: provider.userId } })).balance).toBe(300_000);
    const live = await getLiveFeatured("HOME");
    expect(live.some((f) => f.providerId === provider.profileId)).toBe(true);

    await svc.purchaseFeaturedPlan(provider.userId, homePlan, "WALLET");
    const entries = await prisma.featuredProvider.findMany({ where: { providerId: provider.profileId, placement: "HOME" }, orderBy: { startsAt: "asc" } });
    expect(entries).toHaveLength(2);
    expect(entries[1].startsAt.getTime()).toBe(entries[0].endsAt.getTime());
    expect(entries[1].endsAt.getTime() - entries[1].startsAt.getTime()).toBe(30 * DAY);
    const { entries: listed } = await svc.listProviderFeatured(provider.userId);
    expect(listed.map((e) => e.state).sort()).toEqual(["ACTIVE", "SCHEDULED"]);
  });

  it("activates a gateway purchase exactly once and leaves failed payments inactive", async () => {
    const ok = await svc.purchaseFeaturedPlan(provider.userId, searchPlan, "GATEWAY");
    expect(ok.status).toBe("PENDING");
    let entry = await prisma.featuredProvider.findFirstOrThrow({ where: { payments: { some: { id: ok.paymentId } } } });
    expect(entry.isActive).toBe(false);
    expect((await getLiveFeatured("SEARCH")).some((f) => f.providerId === provider.profileId)).toBe(false);

    await completeSimulatedPayment(provider.userId, ok.paymentId, "SUCCESS");
    await completeSimulatedPayment(provider.userId, ok.paymentId, "SUCCESS"); // repeated callback
    entry = await prisma.featuredProvider.findUniqueOrThrow({ where: { id: entry.id } });
    expect(entry.isActive).toBe(true);
    expect(entry.paidAt).not.toBeNull();
    expect(entry.endsAt.getTime() - entry.startsAt.getTime()).toBe(7 * DAY);
    expect((await getLiveFeatured("SEARCH")).some((f) => f.providerId === provider.profileId)).toBe(true);

    const bad = await svc.purchaseFeaturedPlan(provider.userId, searchPlan, "GATEWAY");
    await completeSimulatedPayment(provider.userId, bad.paymentId, "FAIL");
    const failed = await prisma.featuredProvider.findFirstOrThrow({ where: { payments: { some: { id: bad.paymentId } } } });
    expect(failed.isActive).toBe(false);
    expect(failed.paidAt).toBeNull();
    const { entries } = await svc.listProviderFeatured(provider.userId);
    expect(entries.find((e) => e.id === failed.id)?.state).toBe("PAYMENT_FAILED");
  });

  it("expires automatically when the period ends", async () => {
    const entry = await prisma.featuredProvider.findFirstOrThrow({ where: { providerId: provider.profileId, placement: "SEARCH", paidAt: { not: null } } });
    await prisma.featuredProvider.update({ where: { id: entry.id }, data: { startsAt: new Date(Date.now() - 8 * DAY), endsAt: new Date(Date.now() - DAY) } });
    expect((await getLiveFeatured("SEARCH")).some((f) => f.providerId === provider.profileId)).toBe(false);
    const { entries } = await svc.listProviderFeatured(provider.userId);
    expect(entries.find((e) => e.id === entry.id)?.state).toBe("EXPIRED");
  });

  it("keeps used plans for history (deactivates instead of deleting)", async () => {
    expect(await svc.deleteFeaturedPlan(homePlan)).toBe("DEACTIVATED");
    expect((await prisma.featuredPlan.findUniqueOrThrow({ where: { id: homePlan } })).isActive).toBe(false);
    await expect(svc.purchaseFeaturedPlan(provider.userId, homePlan, "WALLET")).rejects.toThrow("در دسترس");
    const unused = await prisma.featuredPlan.create({ data: { name: "unused", slug: `unused-${tag}`, placement: "HOME", durationDays: 1, price: 1 } });
    expect(await svc.deleteFeaturedPlan(unused.id)).toBe("DELETED");
  });
});
