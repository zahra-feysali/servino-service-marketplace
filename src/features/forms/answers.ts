import { z } from "zod";
import { toEnglishDigits } from "@/lib/utils";
import {
  MAX_FILES_PER_FIELD,
  MAX_UPLOAD_MB,
  UPLOADABLE_MIME_TYPES,
  isIsoDate,
  type FieldDefinition,
  type UploadableMime,
} from "./definitions";

/**
 * Builds the Zod schema that validates a customer's answers for a given set of (active) fields.
 * The exact same function runs in the browser (React Hook Form resolver) and on the server,
 * so both sides enforce identical rules. FILE fields are validated separately (see validateFieldFiles).
 * Unknown keys are stripped, so clients cannot smuggle extra data into `answers`.
 */
export function buildAnswersSchema(fields: FieldDefinition[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    if (field.type === "FILE") continue;
    shape[field.name] = fieldValueSchema(field);
  }
  return z.object(shape);
}

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const REQUIRED = "پر کردن این فیلد الزامی است.";

function fieldValueSchema(field: FieldDefinition): z.ZodType {
  const options = (field.options ?? []).map((o) => o.value);
  const cfg = field.config ?? {};

  switch (field.type) {
    case "TEXT":
    case "TEXTAREA": {
      const maxLength = cfg.maxLength ?? (field.type === "TEXT" ? 300 : 3000);
      const base = z.string({ error: REQUIRED }).trim().max(maxLength, `حداکثر ${maxLength} کاراکتر مجاز است.`);
      return field.isRequired
        ? z.preprocess(emptyToUndefined, base.min(1, REQUIRED))
        : z.preprocess(emptyToUndefined, base.optional());
    }
    case "NUMBER": {
      let base = z.number({ error: "یک عدد معتبر وارد کنید." }).finite();
      if (cfg.min !== undefined) base = base.min(cfg.min, `حداقل مقدار ${cfg.min} است.`);
      if (cfg.max !== undefined) base = base.max(cfg.max, `حداکثر مقدار ${cfg.max} است.`);
      const toNumber = (v: unknown) => {
        const e = emptyToUndefined(v);
        if (typeof e === "string") {
          const n = Number(toEnglishDigits(e).trim());
          return Number.isNaN(n) ? e : n;
        }
        return e;
      };
      return field.isRequired
        ? z.preprocess(toNumber, z.number({ error: REQUIRED }).pipe(base))
        : z.preprocess(toNumber, base.optional());
    }
    case "SELECT":
    case "RADIO": {
      const base = z.string({ error: REQUIRED }).refine((v) => options.includes(v), "گزینه انتخاب‌شده معتبر نیست.");
      return field.isRequired ? z.preprocess(emptyToUndefined, base) : z.preprocess(emptyToUndefined, base.optional());
    }
    case "CHECKBOX": {
      const base = z
        .array(z.string().refine((v) => options.includes(v), "گزینه انتخاب‌شده معتبر نیست."))
        .transform((arr) => Array.from(new Set(arr)));
      return field.isRequired
        ? z.preprocess((v) => v ?? [], base.refine((a) => a.length > 0, "حداقل یک گزینه را انتخاب کنید."))
        : z.preprocess((v) => v ?? [], base);
    }
    case "DATE": {
      const base = z.string({ error: REQUIRED }).refine(isIsoDate, "تاریخ معتبر نیست.");
      return field.isRequired ? z.preprocess(emptyToUndefined, base) : z.preprocess(emptyToUndefined, base.optional());
    }
    case "BOOLEAN": {
      // A required boolean means the customer must confirm it (e.g. "I agree …").
      const base = z.boolean();
      return field.isRequired
        ? z.preprocess((v) => v ?? false, base.refine((b) => b === true, "تأیید این گزینه الزامی است."))
        : z.preprocess((v) => v ?? false, base);
    }
    case "FILE":
      return z.never();
  }
}

/** Initial form values (admin-defined defaults) for the request form. */
export function defaultAnswers(fields: FieldDefinition[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "FILE") continue;
    if (f.defaultValue !== null && f.defaultValue !== undefined) values[f.name] = f.defaultValue;
    else if (f.type === "CHECKBOX") values[f.name] = [];
    else if (f.type === "BOOLEAN") values[f.name] = false;
    else values[f.name] = "";
  }
  return values;
}

// ── Files ─────────────────────────────────────────────────────────────────────

export type IncomingFile = { name: string; size: number; type: string };

export function fileRules(field: Pick<FieldDefinition, "config"> | null) {
  const cfg = field?.config ?? {};
  return {
    accept: (cfg.accept?.length ? cfg.accept : [...UPLOADABLE_MIME_TYPES]) as UploadableMime[],
    maxBytes: Math.min(cfg.maxSizeMb ?? MAX_UPLOAD_MB, MAX_UPLOAD_MB) * 1024 * 1024,
    maxFiles: Math.min(cfg.maxFiles ?? MAX_FILES_PER_FIELD, MAX_FILES_PER_FIELD),
  };
}

/**
 * Checks declared file metadata against a field's rules (count, size, declared MIME type).
 * The server additionally verifies the real content type from the file bytes (see lib/files).
 * Returns a Persian error message, or null when valid.
 */
export function validateFieldFiles(
  field: Pick<FieldDefinition, "config" | "isRequired" | "label"> | null,
  files: IncomingFile[],
): string | null {
  const rules = fileRules(field);
  if (field?.isRequired && files.length === 0) return `بارگذاری فایل برای «${field.label}» الزامی است.`;
  if (files.length > rules.maxFiles) return `حداکثر ${rules.maxFiles} فایل مجاز است.`;
  for (const file of files) {
    if (file.size <= 0) return `فایل «${file.name}» خالی است.`;
    if (file.size > rules.maxBytes) {
      return `حجم فایل «${file.name}» بیش از ${Math.round(rules.maxBytes / 1024 / 1024)} مگابایت است.`;
    }
    if (!rules.accept.includes(file.type as UploadableMime)) return `نوع فایل «${file.name}» مجاز نیست.`;
  }
  return null;
}
