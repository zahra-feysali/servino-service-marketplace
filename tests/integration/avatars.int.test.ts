import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/** Profile pictures against PostgreSQL + private storage: validation, replace, delete, visibility. */
describe.skipIf(!DB_AVAILABLE)("avatars (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { setAvatar, removeAvatar, getAvatarForViewer } = await import("@/features/avatars/service");

  const users: string[] = [];
  let seq = Number(String(Date.now()).slice(-6)) * 10 + 7;
  const phone = () => `0937${String(seq++).padStart(7, "0").slice(-7)}`;
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const tag = randomUUID().slice(0, 6);

  let customer: { id: string };
  let provider: { id: string };
  let stranger: { id: string };
  let category: { id: string };

  beforeAll(async () => {
    const mk = async (role: "CUSTOMER" | "PROVIDER", name: string) => {
      const u = await prisma.user.create({ data: { fullName: name, phone: phone(), passwordHash: "x", role } });
      users.push(u.id);
      return u;
    };
    customer = await mk("CUSTOMER", "مشتری آواتار");
    provider = await mk("PROVIDER", "متخصص آواتار");
    stranger = await mk("PROVIDER", "متخصص غریبه");
    await prisma.providerProfile.create({ data: { userId: provider.id, displayName: "متخصص آواتار", verificationStatus: "PENDING" } });
    category = await prisma.category.create({ data: { name: `acat-${tag}`, slug: `acat-${tag}` } });
  });

  afterAll(async () => {
    for (const id of users) await removeAvatar(id).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.$disconnect();
  });

  it("rejects files whose real content is not an image, even with an image MIME type", async () => {
    const fake = new File([new TextEncoder().encode("<script>alert(1)</script>")], "a.png", { type: "image/png" });
    await expect(setAvatar(customer.id, fake)).rejects.toThrow("مجاز نیست");
    const big = new File([new Uint8Array(3 * 1024 * 1024)], "big.png", { type: "image/png" });
    await expect(setAvatar(customer.id, big)).rejects.toThrow("مگابایت");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).avatarKey).toBeNull();
  });

  it("uploads, replaces and deletes a picture", async () => {
    await setAvatar(customer.id, new File([PNG], "me.png", { type: "image/png" }));
    const first = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(first.avatarKey).toMatch(/\.png$/);
    expect(first.avatarUpdatedAt).not.toBeNull();

    await setAvatar(customer.id, new File([JPG], "me.jpg", { type: "image/jpeg" }));
    const second = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(second.avatarKey).toMatch(/\.jpg$/);
    expect(second.avatarKey).not.toBe(first.avatarKey);
    const self = await getAvatarForViewer({ id: customer.id, role: "CUSTOMER" }, customer.id);
    expect(self?.mime).toBe("image/jpeg");
    expect(Buffer.from(self!.bytes).equals(Buffer.from(JPG))).toBe(true);

    await removeAvatar(customer.id);
    const third = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(third.avatarKey).toBeNull();
    expect(third.avatarUpdatedAt).toBeNull();
    expect(await getAvatarForViewer({ id: customer.id, role: "CUSTOMER" }, customer.id)).toBeNull();
  });

  it("hides private pictures from unrelated users and shows approved provider pictures to everyone", async () => {
    await setAvatar(customer.id, new File([PNG], "c.png", { type: "image/png" }));
    await setAvatar(provider.id, new File([PNG], "p.png", { type: "image/png" }));
    expect(await getAvatarForViewer(null, customer.id)).toBeNull();
    expect(await getAvatarForViewer({ id: stranger.id, role: "PROVIDER" }, customer.id)).toBeNull();
    expect(await getAvatarForViewer({ id: randomUUID(), role: "ADMIN" }, customer.id)).not.toBeNull();
    // Pending provider → not public yet.
    expect(await getAvatarForViewer(null, provider.id)).toBeNull();
    await prisma.providerProfile.update({ where: { userId: provider.id }, data: { verificationStatus: "APPROVED" } });
    expect((await getAvatarForViewer(null, provider.id))?.isPublic).toBe(true);
  });
});
