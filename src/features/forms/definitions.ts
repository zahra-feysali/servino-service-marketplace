import { z } from "zod";

/**
 * Dynamic service form — shared types and admin-side validation for field definitions.
 * Pure module (no I/O): used by the admin form builder (client + server), the request
 * form renderer, request validation and historical snapshots.
 */

export const FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "SELECT",
  "RADIO",
  "CHECKBOX",
  "DATE",
  "BOOLEAN",
  "FILE",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "متن کوتاه",
  TEXTAREA: "متن بلند",
  NUMBER: "عدد",
  SELECT: "لیست کشویی",
  RADIO: "انتخاب تکی (رادیویی)",
  CHECKBOX: "انتخاب چندتایی",
  DATE: "تاریخ",
  BOOLEAN: "بله/خیر",
  FILE: "بارگذاری فایل",
};

export const OPTION_FIELD_TYPES: readonly FieldType[] = ["SELECT", "RADIO", "CHECKBOX"];
export const hasOptions = (type: FieldType) => OPTION_FIELD_TYPES.includes(type);

/** MIME types that may ever be uploaded (per-field `accept` must be a subset). */
export const UPLOADABLE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type UploadableMime = (typeof UPLOADABLE_MIME_TYPES)[number];
export const MAX_UPLOAD_MB = 5;
export const MAX_FILES_PER_FIELD = 5;

export type FieldOption = { value: string; label: string };

export type FieldConfig = {
  min?: number;
  max?: number;
  maxLength?: number;
  accept?: UploadableMime[];
  maxSizeMb?: number;
  maxFiles?: number;
};

/** The canonical shape of a field — also what is frozen into ServiceRequest.formSnapshot. */
export type FieldDefinition = {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  isRequired: boolean;
  options: FieldOption[] | null;
  defaultValue: unknown;
  helpText: string | null;
  placeholder: string | null;
  config: FieldConfig | null;
  sortOrder: number;
};

export const fieldOptionSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1, "مقدار گزینه الزامی است.")
    .max(64, "مقدار گزینه حداکثر ۶۴ کاراکتر است."),
  label: z.string().trim().min(1, "عنوان گزینه الزامی است.").max(150),
});

export const fieldConfigSchema = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    maxLength: z.number().int().min(1).max(5000).optional(),
    accept: z.array(z.enum(UPLOADABLE_MIME_TYPES)).min(1).optional(),
    maxSizeMb: z.number().min(0.1).max(MAX_UPLOAD_MB).optional(),
    maxFiles: z.number().int().min(1).max(MAX_FILES_PER_FIELD).optional(),
  })
  .refine((c) => c.min === undefined || c.max === undefined || c.min <= c.max, {
    path: ["max"],
    message: "حداکثر باید بزرگ‌تر یا مساوی حداقل باشد.",
  });

export const FIELD_NAME_REGEX = /^[a-z][a-z0-9_]{1,63}$/;

/** Admin input for creating/updating a form field. */
export const fieldInputSchema = z
  .object({
    label: z.string().trim().min(2, "عنوان فیلد الزامی است.").max(150),
    name: z
      .string()
      .trim()
      .regex(FIELD_NAME_REGEX, "نام فنی باید با حرف انگلیسی کوچک شروع شود و فقط شامل a-z، 0-9 و _ باشد."),
    type: z.enum(FIELD_TYPES),
    isRequired: z.boolean(),
    isActive: z.boolean(),
    options: z.array(fieldOptionSchema).max(50).optional(),
    defaultValue: z.unknown().optional(),
    helpText: z.string().trim().max(300).optional(),
    placeholder: z.string().trim().max(150).optional(),
    config: fieldConfigSchema.optional(),
  })
  .superRefine((f, ctx) => {
    if (hasOptions(f.type)) {
      if (!f.options || f.options.length === 0) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "برای این نوع فیلد حداقل یک گزینه لازم است." });
      } else {
        const values = f.options.map((o) => o.value);
        if (new Set(values).size !== values.length) {
          ctx.addIssue({ code: "custom", path: ["options"], message: "مقدار گزینه‌ها نباید تکراری باشد." });
        }
      }
    }
    if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== "") {
      const check = defaultValueIsValid(f.type, f.defaultValue, f.options ?? []);
      if (!check) {
        ctx.addIssue({ code: "custom", path: ["defaultValue"], message: "مقدار پیش‌فرض با نوع فیلد یا گزینه‌ها سازگار نیست." });
      }
    }
    if (f.type === "FILE" && f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== "") {
      ctx.addIssue({ code: "custom", path: ["defaultValue"], message: "فیلد فایل مقدار پیش‌فرض ندارد." });
    }
  });
export type FieldInput = z.input<typeof fieldInputSchema>;
export type FieldInputData = z.output<typeof fieldInputSchema>;

function defaultValueIsValid(type: FieldType, value: unknown, options: FieldOption[]): boolean {
  const values = new Set(options.map((o) => o.value));
  switch (type) {
    case "TEXT":
    case "TEXTAREA":
      return typeof value === "string";
    case "NUMBER":
      return typeof value === "number" && Number.isFinite(value);
    case "SELECT":
    case "RADIO":
      return typeof value === "string" && values.has(value);
    case "CHECKBOX":
      return Array.isArray(value) && value.every((v) => typeof v === "string" && values.has(v));
    case "DATE":
      return typeof value === "string" && isIsoDate(value);
    case "BOOLEAN":
      return typeof value === "boolean";
    case "FILE":
      return false;
  }
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Keeps only the config keys that make sense for a type (avoids stale settings after a type change). */
export function sanitizeConfig(type: FieldType, config: FieldConfig | undefined | null): FieldConfig | null {
  if (!config) return null;
  const out: FieldConfig = {};
  if (type === "NUMBER") {
    if (config.min !== undefined) out.min = config.min;
    if (config.max !== undefined) out.max = config.max;
  }
  if (type === "TEXT" || type === "TEXTAREA") {
    if (config.maxLength !== undefined) out.maxLength = config.maxLength;
  }
  if (type === "FILE") {
    if (config.accept?.length) out.accept = config.accept;
    if (config.maxSizeMb !== undefined) out.maxSizeMb = config.maxSizeMb;
    if (config.maxFiles !== undefined) out.maxFiles = config.maxFiles;
  }
  return Object.keys(out).length ? out : null;
}

/** Runtime parsing of a stored snapshot / DB row into a FieldDefinition (defensive against bad JSON). */
const storedFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  type: z.enum(FIELD_TYPES),
  isRequired: z.boolean(),
  options: z.array(fieldOptionSchema).nullable().optional(),
  defaultValue: z.unknown().optional(),
  helpText: z.string().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  config: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      maxLength: z.number().optional(),
      accept: z.array(z.enum(UPLOADABLE_MIME_TYPES)).optional(),
      maxSizeMb: z.number().optional(),
      maxFiles: z.number().optional(),
    })
    .nullable()
    .optional(),
  sortOrder: z.number(),
});

export function toFieldDefinition(raw: unknown): FieldDefinition {
  const f = storedFieldSchema.parse(raw);
  return {
    id: f.id,
    name: f.name,
    label: f.label,
    type: f.type,
    isRequired: f.isRequired,
    options: f.options ?? null,
    defaultValue: f.defaultValue ?? null,
    helpText: f.helpText ?? null,
    placeholder: f.placeholder ?? null,
    config: f.config ?? null,
    sortOrder: f.sortOrder,
  };
}

export function parseSnapshot(raw: unknown): FieldDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toFieldDefinition).sort((a, b) => a.sortOrder - b.sortOrder);
}
