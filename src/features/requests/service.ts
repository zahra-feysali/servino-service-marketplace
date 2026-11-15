import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { detectMimeType, sanitizeFileName } from "@/lib/files";
import { deleteStoredFiles, saveFile } from "@/lib/storage";
import type { Prisma } from "@/generated/prisma/client";
import { toFieldDefinition, type FieldDefinition, type UploadableMime } from "@/features/forms/definitions";
import { buildAnswersSchema, fileRules, validateFieldFiles } from "@/features/forms/answers";
import { matchProvidersForRequest } from "@/features/matching/service";
import { notify } from "@/features/notifications/service";
import { requestBaseSchema } from "./schemas";

const DEFAULT_EXPIRY_DAYS = 7;
const MAX_GENERAL_ATTACHMENTS = 5;

export type UploadedFile = { fieldName: string | null; file: File };

/** Loads an active service with its active fields (ordered) as FieldDefinitions. */
export async function getActiveServiceForm(where: { id: string } | { slug: string }) {
  const service = await prisma.service.findFirst({
    where: { ...where, isActive: true, category: { isActive: true } },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      icon: true,
      formVersion: true,
      formFields: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!service) return null;
  return { ...service, fields: service.formFields.map(toFieldDefinition) };
}

async function getExpiryDays(): Promise<number> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "requests.defaultExpiryDays" } });
  const n = typeof setting?.value === "number" ? setting.value : DEFAULT_EXPIRY_DAYS;
  return Number.isInteger(n) && n > 0 && n <= 90 ? n : DEFAULT_EXPIRY_DAYS;
}

type PreparedFile = { fieldName: string | null; fileName: string; mimeType: UploadableMime; size: number; bytes: Uint8Array };

/** Validates every uploaded file against its field rules and its real (magic-byte) type. */
async function prepareFiles(fields: FieldDefinition[], uploads: UploadedFile[]): Promise<PreparedFile[]> {
  const fileFields = new Map(fields.filter((f) => f.type === "FILE").map((f) => [f.name, f]));
  const groups = new Map<string | null, File[]>();
  for (const u of uploads) {
    if (u.fieldName !== null && !fileFields.has(u.fieldName)) {
      throw new AppError("فایل ارسال‌شده به فیلد نامعتبری تعلق دارد.", "INVALID_FILE");
    }
    groups.set(u.fieldName, [...(groups.get(u.fieldName) ?? []), u.file]);
  }

  const fieldErrors: Record<string, string[]> = {};
  for (const field of fileFields.values()) {
    const files = groups.get(field.name) ?? [];
    const error = validateFieldFiles(field, files);
    if (error) fieldErrors[field.name] = [error];
  }
  const general = groups.get(null) ?? [];
  const generalError =
    general.length > MAX_GENERAL_ATTACHMENTS
      ? `حداکثر ${MAX_GENERAL_ATTACHMENTS} پیوست مجاز است.`
      : validateFieldFiles({ config: { maxFiles: MAX_GENERAL_ATTACHMENTS }, isRequired: false, label: "پیوست‌ها" }, general);
  if (generalError) fieldErrors.attachments = [generalError];
  if (Object.keys(fieldErrors).length) throw new AppError("فایل‌های ارسالی معتبر نیستند.", "INVALID_FILE", fieldErrors);

  const prepared: PreparedFile[] = [];
  for (const [fieldName, files] of groups) {
    const rules = fileRules(fieldName ? fileFields.get(fieldName)! : null);
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const realType = detectMimeType(bytes);
      if (!realType || !rules.accept.includes(realType)) {
        throw new AppError(`محتوای فایل «${sanitizeFileName(file.name)}» با نوع‌های مجاز مطابقت ندارد.`, "INVALID_FILE", {
          [fieldName ?? "attachments"]: ["محتوای فایل با نوع‌های مجاز مطابقت ندارد."],
        });
      }
      prepared.push({ fieldName, fileName: sanitizeFileName(file.name), mimeType: realType, size: bytes.byteLength, bytes });
    }
  }
  return prepared;
}

/**
 * Customer request submission (spec §6 steps 2–3):
 * validate fixed fields + dynamic answers + files, store the request with an immutable
 * form snapshot, its attachments and status history, then match eligible providers —
 * all inside one transaction. Files written to disk are removed if the transaction fails.
 */
export async function submitServiceRequest(
  customerId: string,
  payload: { base: unknown; answers: unknown },
  uploads: UploadedFile[],
): Promise<{ requestId: string; matchedProviders: number }> {
  const base = requestBaseSchema.safeParse(payload.base);
  if (!base.success) {
    throw new AppError("اطلاعات درخواست معتبر نیست.", "VALIDATION", z.flattenError(base.error).fieldErrors);
  }

  const service = await getActiveServiceForm({ id: base.data.serviceId });
  if (!service) throw new NotFoundError("این خدمت در حال حاضر فعال نیست.");

  const city = await prisma.city.findFirst({
    where: { id: base.data.cityId, isActive: true, province: { isActive: true } },
    select: { id: true },
  });
  if (!city) throw new AppError("شهر انتخاب‌شده معتبر نیست.", "VALIDATION", { cityId: ["شهر انتخاب‌شده معتبر نیست."] });

  if (base.data.addressId) {
    const owned = await prisma.address.count({ where: { id: base.data.addressId, userId: customerId, cityId: city.id } });
    if (!owned) throw new AppError("نشانی انتخاب‌شده معتبر نیست.", "VALIDATION", { addressId: ["نشانی انتخاب‌شده معتبر نیست."] });
  }

  const answers = buildAnswersSchema(service.fields).safeParse(payload.answers ?? {});
  if (!answers.success) {
    throw new AppError("لطفاً خطاهای فرم را برطرف کنید.", "VALIDATION", z.flattenError(answers.error).fieldErrors);
  }

  const files = await prepareFiles(service.fields, uploads);
  const expiryDays = await getExpiryDays();

  const savedKeys: string[] = [];
  try {
    const storedFiles: (PreparedFile & { storageKey: string })[] = [];
    for (const f of files) {
      const key = await saveFile(f.bytes, f.mimeType);
      savedKeys.push(key);
      storedFiles.push({ ...f, storageKey: key });
    }

    return await prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const request = await tx.serviceRequest.create({
          data: {
            customerId,
            serviceId: service.id,
            cityId: city.id,
            addressId: base.data.addressId ?? null,
            addressText: base.data.addressText,
            description: base.data.description ?? null,
            preferredDate: base.data.preferredDate ? new Date(`${base.data.preferredDate}T00:00:00Z`) : null,
            answers: answers.data as Prisma.InputJsonObject,
            formSnapshot: service.fields as unknown as Prisma.InputJsonArray,
            formVersion: service.formVersion,
            status: "OPEN",
            expiresAt: new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000),
          },
          select: { id: true, code: true },
        });

        if (storedFiles.length) {
          await tx.requestAttachment.createMany({
            data: storedFiles.map((f) => ({
              requestId: request.id,
              uploaderId: customerId,
              fieldName: f.fieldName,
              fileName: f.fileName,
              storageKey: f.storageKey,
              mimeType: f.mimeType,
              size: f.size,
            })),
          });
        }

        await tx.requestStatusHistory.create({
          data: { requestId: request.id, fromStatus: null, toStatus: "OPEN", changedById: customerId, note: "ثبت درخواست" },
        });

        const matchedProviders = await matchProvidersForRequest(
          tx,
          { id: request.id, code: request.code, serviceId: service.id, cityId: city.id, serviceName: service.name },
          now,
        );

        return { requestId: request.id, matchedProviders };
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    await deleteStoredFiles(savedKeys);
    throw error;
  }
}

/** Customer cancels their own OPEN request; pending offers are rejected and their providers notified. */
export async function cancelServiceRequest(customerId: string, requestId: string, reason: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, "ServiceRequest", requestId))) throw new NotFoundError("درخواست یافت نشد.");
    const request = await tx.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { id: true, code: true, customerId: true, status: true },
    });
    if (request.customerId !== customerId) throw new ForbiddenError();
    if (request.status !== "OPEN") throw new AppError("فقط درخواست‌های باز قابل لغو هستند.", "INVALID_STATE");

    const pendingOffers = await tx.providerOffer.findMany({
      where: { requestId, status: "PENDING" },
      select: { id: true, provider: { select: { userId: true } } },
    });
    await tx.providerOffer.updateMany({ where: { requestId, status: "PENDING" }, data: { status: "REJECTED" } });
    await tx.serviceRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
    await tx.requestStatusHistory.create({
      data: { requestId, fromStatus: "OPEN", toStatus: "CANCELLED", changedById: customerId, note: reason },
    });
    await notify(
      tx,
      pendingOffers.map((o) => ({
        userId: o.provider.userId,
        type: "OFFER_REJECTED" as const,
        title: `درخواست ${request.code} توسط مشتری لغو شد`,
        body: "پیشنهاد شما برای این درخواست دیگر فعال نیست.",
        link: "/dashboard/provider/offers",
      })),
    );
  });
}
