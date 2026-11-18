import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/** Multi-file request submission against PostgreSQL + private storage. */
describe.skipIf(!DB_AVAILABLE)("multi-file uploads (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { submitServiceRequest } = await import("@/features/requests/service");
  const { deleteStoredFiles, readStoredFile } = await import("@/lib/storage");

  const tag = randomUUID().slice(0, 8);
  const ids = {} as Record<string, string>;
  let customerId = "";
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9]);
  const PDF = new TextEncoder().encode("%PDF-1.4 test");
  const png = (n: string) => new File([PNG], n, { type: "image/png" });
  const pdf = (n: string) => new File([PDF], n, { type: "application/pdf" });

  beforeAll(async () => {
    const province = await prisma.province.create({ data: { name: `uprov-${tag}`, slug: `uprov-${tag}` } });
    const city = await prisma.city.create({ data: { name: `ucity-${tag}`, slug: `ucity-${tag}`, provinceId: province.id } });
    const category = await prisma.category.create({ data: { name: `ucat-${tag}`, slug: `ucat-${tag}` } });
    const service = await prisma.service.create({ data: { name: `usvc-${tag}`, slug: `usvc-${tag}`, categoryId: category.id } });
    await prisma.serviceFormField.create({
      data: { serviceId: service.id, name: "photos", label: "عکس‌ها", type: "FILE", isRequired: true, sortOrder: 0, config: { maxFiles: 3, accept: ["image/png", "image/jpeg"] } },
    });
    const customer = await prisma.user.create({ data: { fullName: "مشتری آپلود", phone: `0938${String(Date.now()).slice(-7)}`, passwordHash: "x", role: "CUSTOMER" } });
    customerId = customer.id;
    Object.assign(ids, { province: province.id, city: city.id, category: category.id, service: service.id });
  });

  afterAll(async () => {
    const reqs = await prisma.serviceRequest.findMany({ where: { serviceId: ids.service }, select: { id: true, attachments: { select: { storageKey: true } } } });
    await deleteStoredFiles(reqs.flatMap((r) => r.attachments.map((a) => a.storageKey)));
    await prisma.requestAttachment.deleteMany({ where: { requestId: { in: reqs.map((r) => r.id) } } });
    await prisma.requestStatusHistory.deleteMany({ where: { requestId: { in: reqs.map((r) => r.id) } } });
    await prisma.serviceRequest.deleteMany({ where: { serviceId: ids.service } });
    await prisma.user.delete({ where: { id: customerId } });
    await prisma.service.delete({ where: { id: ids.service } });
    await prisma.category.delete({ where: { id: ids.category } });
    await prisma.city.deleteMany({ where: { provinceId: ids.province } });
    await prisma.province.delete({ where: { id: ids.province } });
    await prisma.$disconnect();
  });

  const submit = (uploads: { fieldName: string | null; file: File }[]) =>
    submitServiceRequest(customerId, { base: { serviceId: ids.service, cityId: ids.city, addressText: "تهران، خیابان آزمایشی آپلود، پلاک ۳" }, answers: {} }, uploads);

  it("stores every file of a multi-file field and of the general attachments", async () => {
    const { requestId } = await submit([
      { fieldName: "photos", file: png("a.png") },
      { fieldName: "photos", file: png("b.png") },
      { fieldName: "photos", file: png("c.png") },
      { fieldName: null, file: pdf("invoice.pdf") },
      { fieldName: null, file: png("extra.png") },
    ]);
    const attachments = await prisma.requestAttachment.findMany({ where: { requestId }, orderBy: { fileName: "asc" } });
    expect(attachments.map((a) => [a.fieldName, a.fileName, a.mimeType])).toEqual([
      ["photos", "a.png", "image/png"],
      ["photos", "b.png", "image/png"],
      ["photos", "c.png", "image/png"],
      [null, "extra.png", "image/png"],
      [null, "invoice.pdf", "application/pdf"],
    ]);
    const bytes = await readStoredFile(attachments[0].storageKey);
    expect(Buffer.from(bytes).equals(Buffer.from(PNG))).toBe(true);
  });

  it("enforces required, count, type and real content — and stores nothing when one file is bad", async () => {
    const before = await prisma.serviceRequest.count({ where: { serviceId: ids.service } });
    await expect(submit([])).rejects.toThrow(); // required field
    await expect(submit([1, 2, 3, 4].map((i) => ({ fieldName: "photos", file: png(`${i}.png`) })))).rejects.toThrow();
    await expect(submit([{ fieldName: "photos", file: pdf("x.pdf") }])).rejects.toThrow(); // PDF not accepted by this field
    const disguised = new File([new TextEncoder().encode("MZ fake exe")], "fake.png", { type: "image/png" });
    await expect(submit([{ fieldName: "photos", file: png("ok.png") }, { fieldName: "photos", file: disguised }])).rejects.toThrow("مطابقت");
    await expect(submit([{ fieldName: "unknown", file: png("u.png") }])).rejects.toThrow();
    expect(await prisma.serviceRequest.count({ where: { serviceId: ids.service } })).toBe(before);
  });
});
