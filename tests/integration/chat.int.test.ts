import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/** Customer ↔ provider chat against PostgreSQL: access control, messages, files, read state, unread counts. */
describe.skipIf(!DB_AVAILABLE)("chat (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { submitServiceRequest } = await import("@/features/requests/service");
  const { submitOffer, withdrawOffer } = await import("@/features/offers/service");
  const chat = await import("@/features/chat/service");
  const { deleteStoredFiles } = await import("@/lib/storage");

  const tag = randomUUID().slice(0, 8);
  const ids = {} as Record<string, string>;
  const users: string[] = [];
  let seq = Number(String(Date.now()).slice(-6)) * 10 + 5;
  const phone = () => `0939${String(seq++).padStart(7, "0").slice(-7)}`;
  type Actor = { id: string; role: "CUSTOMER" | "PROVIDER" | "ADMIN" };
  let customer: Actor, intruder: Actor, p1: Actor & { profileId: string }, p2: Actor & { profileId: string }, p3: Actor & { profileId: string };
  let requestId = "";
  let convId = "";

  async function mkUser(role: "CUSTOMER" | "PROVIDER", name: string) {
    const u = await prisma.user.create({ data: { fullName: name, phone: phone(), passwordHash: "x", role } });
    users.push(u.id);
    return { id: u.id, role } as Actor;
  }
  async function mkProvider(name: string) {
    const u = await mkUser("PROVIDER", name);
    const profile = await prisma.providerProfile.create({ data: { userId: u.id, displayName: name, verificationStatus: "APPROVED" } });
    await prisma.providerService.create({ data: { providerId: profile.id, serviceId: ids.service } });
    await prisma.serviceArea.create({ data: { providerId: profile.id, cityId: ids.city } });
    await prisma.subscription.create({
      data: {
        userId: u.id, planId: ids.plan, status: "ACTIVE", startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86_400_000),
        planSnapshot: { name: "t", price: 1, durationDays: 1, maxRequestsPerPeriod: null, maxOffersPerPeriod: null },
      },
    });
    return { ...u, profileId: profile.id };
  }
  const offer = (actor: Actor) =>
    submitOffer(actor.id, requestId, { price: 250_000, estimatedDuration: 2, estimatedDurationUnit: "HOUR", description: "پیشنهاد برای آزمون گفتگو" });

  beforeAll(async () => {
    const province = await prisma.province.create({ data: { name: `cprov-${tag}`, slug: `cprov-${tag}` } });
    const city = await prisma.city.create({ data: { name: `ccity-${tag}`, slug: `ccity-${tag}`, provinceId: province.id } });
    const category = await prisma.category.create({ data: { name: `ccat-${tag}`, slug: `ccat-${tag}` } });
    const service = await prisma.service.create({ data: { name: `csvc-${tag}`, slug: `csvc-${tag}`, categoryId: category.id } });
    const plan = await prisma.plan.create({ data: { name: `cplan-${tag}`, slug: `cplan-${tag}`, price: 1, durationDays: 1 } });
    Object.assign(ids, { province: province.id, city: city.id, category: category.id, service: service.id, plan: plan.id });
    customer = await mkUser("CUSTOMER", "مشتری گفتگو");
    intruder = await mkUser("CUSTOMER", "مشتری فضول");
    p1 = await mkProvider("متخصص یک");
    p2 = await mkProvider("متخصص دو");
    p3 = await mkProvider("متخصص سه");
    ({ requestId } = await submitServiceRequest(
      customer.id,
      { base: { serviceId: service.id, cityId: city.id, addressText: "تهران، خیابان آزمایشی گفتگو، پلاک ۴" }, answers: {} },
      [],
    ));
  });

  afterAll(async () => {
    const convs = await prisma.conversation.findMany({ where: { requestId }, select: { id: true } });
    const atts = await prisma.messageAttachment.findMany({ where: { message: { conversationId: { in: convs.map((c) => c.id) } } }, select: { storageKey: true } });
    await deleteStoredFiles(atts.map((a) => a.storageKey));
    await prisma.messageAttachment.deleteMany({ where: { message: { conversationId: { in: convs.map((c) => c.id) } } } });
    await prisma.message.deleteMany({ where: { conversationId: { in: convs.map((c) => c.id) } } });
    await prisma.conversation.deleteMany({ where: { requestId } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.requestMatch.deleteMany({ where: { requestId } });
    await prisma.providerOffer.deleteMany({ where: { requestId } });
    await prisma.requestStatusHistory.deleteMany({ where: { requestId } });
    await prisma.serviceRequest.deleteMany({ where: { id: requestId } });
    await prisma.subscription.deleteMany({ where: { userId: { in: users } } });
    await prisma.providerService.deleteMany({ where: { serviceId: ids.service } });
    await prisma.serviceArea.deleteMany({ where: { cityId: ids.city } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.plan.delete({ where: { id: ids.plan } });
    await prisma.service.delete({ where: { id: ids.service } });
    await prisma.category.delete({ where: { id: ids.category } });
    await prisma.city.deleteMany({ where: { provinceId: ids.province } });
    await prisma.province.delete({ where: { id: ids.province } });
    await prisma.$disconnect();
  });

  it("is only available after an offer, and only to the two parties", async () => {
    await expect(chat.startConversation(customer, requestId, p1.profileId)).rejects.toThrow("پیشنهاد");
    await expect(chat.startConversation(p1, requestId)).rejects.toThrow();
    await offer(p1);
    await offer(p3);
    await expect(chat.startConversation(intruder, requestId, p1.profileId)).rejects.toThrow();
    await expect(chat.startConversation(p2, requestId)).rejects.toThrow(); // matched but no offer

    const fromCustomer = await chat.startConversation(customer, requestId, p1.profileId);
    const fromProvider = await chat.startConversation(p1, requestId);
    expect(fromProvider.conversationId).toBe(fromCustomer.conversationId); // one conversation per request + provider
    convId = fromCustomer.conversationId;

    await expect(chat.getConversationForUser(intruder, convId)).rejects.toThrow();
    await expect(chat.getConversationForUser(p2, convId)).rejects.toThrow();
    await expect(chat.getConversationForUser({ id: randomUUID(), role: "ADMIN" }, convId)).rejects.toThrow();
    await expect(chat.sendMessage(p3, convId, "سلام", [])).rejects.toThrow();
    await expect(chat.readMessages(intruder, convId)).rejects.toThrow();
  });

  it("sends text and files, tracks unread counts and read state, and does not spam notifications", async () => {
    const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
    await expect(chat.sendMessage(customer, convId, null, [])).rejects.toThrow();
    const fake = new File([new TextEncoder().encode("not an image")], "x.png", { type: "image/png" });
    await expect(chat.sendMessage(customer, convId, null, [fake])).rejects.toThrow("مجاز نیست");

    const m1 = await chat.sendMessage(customer, convId, "سلام، چه زمانی می‌توانید بیایید؟", []);
    const m2 = await chat.sendMessage(customer, convId, null, [new File([PNG], "kitchen.png", { type: "image/png" }), new File([new TextEncoder().encode("%PDF-1.4")], "plan.pdf", { type: "application/pdf" })]);
    expect(m2.attachments.map((a) => a.mimeType).sort()).toEqual(["application/pdf", "image/png"]);

    expect(await chat.countUnreadMessages(p1.id)).toBe(2);
    expect(await chat.countUnreadMessages(customer.id)).toBe(0);
    expect(await prisma.notification.count({ where: { userId: p1.id, type: "NEW_MESSAGE" } })).toBe(1); // deduplicated

    const list = await chat.listConversations(p1);
    expect(list.find((c) => c.id === convId)?.unread).toBe(2);

    const read = await chat.readMessages(p1, convId);
    expect(read.messages.map((m) => m.id)).toEqual([m1.id, m2.id]);
    expect(await chat.countUnreadMessages(p1.id)).toBe(0);
    expect(await prisma.notification.count({ where: { userId: p1.id, type: "NEW_MESSAGE", readAt: null } })).toBe(0);

    const reply = await chat.sendMessage(p1, convId, "فردا ساعت ۱۰ صبح در خدمتم.", []);
    const custView = await chat.readMessages(customer, convId);
    expect(custView.counterpartReadAt).not.toBeNull(); // customer sees "seen" ticks
    const after = await chat.readMessages(customer, convId, { after: new Date(m2.createdAt) });
    expect(after.messages.map((m) => m.id)).toEqual([reply.id]);
  });

  it("serves attachments only to participants", async () => {
    const att = await prisma.messageAttachment.findFirstOrThrow({ where: { message: { conversationId: convId } } });
    expect(await chat.getChatAttachment(customer, att.id)).not.toBeNull();
    expect(await chat.getChatAttachment(p1, att.id)).not.toBeNull();
    expect(await chat.getChatAttachment(intruder, att.id)).toBeNull();
    expect(await chat.getChatAttachment(p3, att.id)).toBeNull();
  });

  it("becomes read-only when the provider withdraws the offer", async () => {
    const { conversationId } = await chat.startConversation(p3, requestId);
    await chat.sendMessage(p3, conversationId, "سؤالی دارید؟", []);
    const o = await prisma.providerOffer.findFirstOrThrow({ where: { requestId, providerId: p3.profileId } });
    await withdrawOffer(p3.id, o.id);
    await expect(chat.sendMessage(customer, conversationId, "بله", [])).rejects.toThrow("فقط قابل مشاهده");
    expect((await chat.readMessages(customer, conversationId)).messages).toHaveLength(1);
  });
});
