import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/** Admin city management against PostgreSQL: CRUD, deactivation without data loss, safe delete. */
describe.skipIf(!DB_AVAILABLE)("city management (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const loc = await import("@/features/locations/service");
  const { getActiveCitiesGrouped } = await import("@/features/requests/queries");
  const { submitServiceRequest } = await import("@/features/requests/service");
  const { setProviderAreas } = await import("@/features/providers/profile-service");

  const tag = randomUUID().slice(0, 8);
  const ids = {} as Record<string, string>;
  const users: string[] = [];

  beforeAll(async () => {
    await loc.saveProvince(null, { name: `استان ${tag}`, slug: `p-${tag}`, sortOrder: 0 });
    ids.province = (await prisma.province.findUniqueOrThrow({ where: { slug: `p-${tag}` } })).id;
    await loc.saveCity(null, ids.province, { name: `شهر الف ${tag}`, slug: `a-${tag}`, sortOrder: 0 });
    await loc.saveCity(null, ids.province, { name: `شهر ب ${tag}`, slug: `b-${tag}`, sortOrder: 1 });
    ids.a = (await prisma.city.findUniqueOrThrow({ where: { slug: `a-${tag}` } })).id;
    ids.b = (await prisma.city.findUniqueOrThrow({ where: { slug: `b-${tag}` } })).id;

    const category = await prisma.category.create({ data: { name: `lcat-${tag}`, slug: `lcat-${tag}` } });
    const service = await prisma.service.create({ data: { name: `lsvc-${tag}`, slug: `lsvc-${tag}`, categoryId: category.id } });
    Object.assign(ids, { category: category.id, service: service.id });
    const customer = await prisma.user.create({ data: { fullName: "مشتری شهر", phone: `0934${String(Date.now()).slice(-7)}`, passwordHash: "x", role: "CUSTOMER" } });
    const pUser = await prisma.user.create({ data: { fullName: "متخصص شهر", phone: `0932${String(Date.now()).slice(-7)}`, passwordHash: "x", role: "PROVIDER" } });
    users.push(customer.id, pUser.id);
    const profile = await prisma.providerProfile.create({ data: { userId: pUser.id, displayName: "متخصص شهر" } });
    Object.assign(ids, { customer: customer.id, providerUser: pUser.id, profile: profile.id });
  });

  afterAll(async () => {
    const reqs = await prisma.serviceRequest.findMany({ where: { serviceId: ids.service }, select: { id: true } });
    await prisma.requestStatusHistory.deleteMany({ where: { requestId: { in: reqs.map((r) => r.id) } } });
    await prisma.serviceRequest.deleteMany({ where: { serviceId: ids.service } });
    await prisma.serviceArea.deleteMany({ where: { providerId: ids.profile } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.service.delete({ where: { id: ids.service } });
    await prisma.category.delete({ where: { id: ids.category } });
    await prisma.city.deleteMany({ where: { provinceId: ids.province } });
    await prisma.province.deleteMany({ where: { id: ids.province } });
    await prisma.$disconnect();
  });

  it("creates and edits provinces and cities, rejecting duplicates", async () => {
    await expect(loc.saveCity(null, ids.province, { name: `شهر الف ${tag}`, slug: `a2-${tag}`, sortOrder: 0 })).rejects.toThrow("تکراری");
    await expect(loc.saveCity(null, ids.province, { name: "دیگر", slug: `a-${tag}`, sortOrder: 0 })).rejects.toThrow("تکراری");
    await expect(loc.saveCity(null, randomUUID(), { name: "x", slug: `x-${tag}`, sortOrder: 0 })).rejects.toThrow("استان");
    await loc.saveCity(ids.b, ids.province, { name: `شهر ب ویرایش ${tag}`, slug: `b-${tag}`, sortOrder: 2 });
    expect((await prisma.city.findUniqueOrThrow({ where: { id: ids.b } })).name).toBe(`شهر ب ویرایش ${tag}`);
    const active = await getActiveCitiesGrouped();
    expect(active.find((p) => p.id === ids.province)?.cities.map((c) => c.id)).toEqual([ids.a, ids.b]);
  });

  it("hides deactivated cities from forms but keeps existing data", async () => {
    await setProviderAreas(ids.providerUser, [ids.a, ids.b]);
    const { requestId } = await submitServiceRequest(ids.customer, { base: { serviceId: ids.service, cityId: ids.a, addressText: "نشانی آزمایشی برای شهرها، پلاک ۵" }, answers: {} }, []);

    await loc.setCityActive(ids.a, false);
    const active = await getActiveCitiesGrouped();
    expect(active.find((p) => p.id === ids.province)?.cities.map((c) => c.id)).toEqual([ids.b]);
    await expect(
      submitServiceRequest(ids.customer, { base: { serviceId: ids.service, cityId: ids.a, addressText: "نشانی آزمایشی برای شهرها، پلاک ۶" }, answers: {} }, []),
    ).rejects.toThrow("شهر");
    expect(await prisma.serviceRequest.count({ where: { id: requestId } })).toBe(1);

    // Provider saves areas while the city is inactive: the hidden area must survive.
    await setProviderAreas(ids.providerUser, [ids.b]);
    const areas = await prisma.serviceArea.findMany({ where: { providerId: ids.profile }, select: { cityId: true } });
    expect(areas.map((a) => a.cityId).sort()).toEqual([ids.a, ids.b].sort());
    await expect(setProviderAreas(ids.providerUser, [ids.a])).rejects.toThrow(); // cannot newly select an inactive city

    await loc.setProvinceActive(ids.province, false);
    expect((await getActiveCitiesGrouped()).some((p) => p.id === ids.province)).toBe(false);
    await loc.setProvinceActive(ids.province, true);
    await loc.setCityActive(ids.a, true);
  });

  it("only deletes unused cities and empty provinces", async () => {
    await expect(loc.deleteCity(ids.a)).rejects.toThrow("غیرفعال");
    await expect(loc.deleteProvince(ids.province)).rejects.toThrow();
    await loc.saveCity(null, ids.province, { name: `شهر خالی ${tag}`, slug: `empty-${tag}`, sortOrder: 9 });
    const empty = await prisma.city.findUniqueOrThrow({ where: { slug: `empty-${tag}` } });
    await loc.deleteCity(empty.id);
    expect(await prisma.city.count({ where: { id: empty.id } })).toBe(0);
  });
});
