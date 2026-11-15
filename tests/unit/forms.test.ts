import { describe, expect, it } from "vitest";
import { buildAnswersSchema, defaultAnswers, validateFieldFiles } from "@/features/forms/answers";
import { fieldInputSchema, parseSnapshot, sanitizeConfig, type FieldDefinition } from "@/features/forms/definitions";

const base = { helpText: null, placeholder: null, defaultValue: null, options: null, config: null } as const;
let order = 0;
const f = (partial: Partial<FieldDefinition> & Pick<FieldDefinition, "name" | "type">): FieldDefinition => ({
  ...base,
  id: `id-${partial.name}`,
  label: partial.name,
  isRequired: false,
  sortOrder: order++,
  ...partial,
});

const opts = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

describe("buildAnswersSchema", () => {
  const fields = [
    f({ name: "title", type: "TEXT", isRequired: true, config: { maxLength: 10 } }),
    f({ name: "notes", type: "TEXTAREA" }),
    f({ name: "area", type: "NUMBER", isRequired: true, config: { min: 20, max: 100 } }),
    f({ name: "rooms", type: "SELECT", isRequired: true, options: opts }),
    f({ name: "kind", type: "RADIO", options: opts }),
    f({ name: "parts", type: "CHECKBOX", isRequired: true, options: opts }),
    f({ name: "when", type: "DATE" }),
    f({ name: "agree", type: "BOOLEAN", isRequired: true }),
    f({ name: "extra", type: "BOOLEAN" }),
    f({ name: "photo", type: "FILE", isRequired: true }),
  ];
  const schema = buildAnswersSchema(fields);
  const valid = { title: "hello", area: "50", rooms: "a", parts: ["a", "b", "a"], agree: true };

  it("accepts valid answers and normalizes values", () => {
    const r = schema.safeParse({ ...valid, notes: "", when: "2026-12-01" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.area).toBe(50);
      expect(r.data.parts).toEqual(["a", "b"]);
      expect(r.data.notes).toBeUndefined();
      expect(r.data.extra).toBe(false);
      expect(r.data).not.toHaveProperty("photo");
    }
  });

  it("accepts Persian digits for numbers", () => {
    const r = schema.safeParse({ ...valid, area: "۶۰" });
    expect(r.success && r.data.area).toBe(60);
  });

  it("strips unknown keys (no data smuggling)", () => {
    const r = schema.safeParse({ ...valid, isAdmin: true, price: 1 });
    expect(r.success && Object.keys(r.data)).not.toContain("isAdmin");
  });

  it.each([
    ["missing required text", { title: "" }],
    ["text too long", { title: "x".repeat(11) }],
    ["number below min", { area: 10 }],
    ["number above max", { area: 101 }],
    ["not a number", { area: "abc" }],
    ["option not in list", { rooms: "zzz" }],
    ["radio not in list", { kind: "zzz" }],
    ["empty required checkbox", { parts: [] }],
    ["checkbox invalid option", { parts: ["a", "evil"] }],
    ["invalid date", { when: "2026-02-31" }],
    ["required boolean not confirmed", { agree: false }],
  ])("rejects %s", (_label, override) => {
    expect(schema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("produces defaults for every non-file field", () => {
    const withDefault = [...fields, f({ name: "pre", type: "TEXT", defaultValue: "x" })];
    const d = defaultAnswers(withDefault);
    expect(d).toMatchObject({ title: "", parts: [], agree: false, pre: "x" });
    expect(d).not.toHaveProperty("photo");
  });
});

describe("validateFieldFiles", () => {
  const field = { label: "عکس", isRequired: true, config: { accept: ["image/png" as const], maxSizeMb: 1, maxFiles: 2 } };
  const png = { name: "a.png", size: 1000, type: "image/png" };

  it("enforces required, count, size and type", () => {
    expect(validateFieldFiles(field, [])).toContain("الزامی");
    expect(validateFieldFiles(field, [png, png, png])).toContain("حداکثر");
    expect(validateFieldFiles(field, [{ ...png, size: 2 * 1024 * 1024 }])).toContain("حجم");
    expect(validateFieldFiles(field, [{ ...png, type: "application/pdf" }])).toContain("نوع");
    expect(validateFieldFiles(field, [{ ...png, size: 0 }])).toContain("خالی");
    expect(validateFieldFiles(field, [png])).toBeNull();
  });

  it("never allows more than the global 5 MB limit", () => {
    const big = { label: "x", isRequired: false, config: { maxSizeMb: 50 } };
    expect(validateFieldFiles(big, [{ name: "a.pdf", size: 6 * 1024 * 1024, type: "application/pdf" }])).not.toBeNull();
  });
});

describe("fieldInputSchema (admin form builder)", () => {
  const ok = { label: "متراژ", name: "area_m2", type: "NUMBER" as const, isRequired: true, isActive: true };

  it("accepts a valid field", () => {
    expect(fieldInputSchema.safeParse(ok).success).toBe(true);
  });

  it("validates technical names", () => {
    expect(fieldInputSchema.safeParse({ ...ok, name: "Area" }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ ...ok, name: "1area" }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ ...ok, name: "area-m2" }).success).toBe(false);
  });

  it("requires unique options for option fields", () => {
    expect(fieldInputSchema.safeParse({ ...ok, type: "SELECT" }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ ...ok, type: "SELECT", options: [opts[0], opts[0]] }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ ...ok, type: "SELECT", options: opts }).success).toBe(true);
  });

  it("checks default values against the type and options", () => {
    expect(fieldInputSchema.safeParse({ ...ok, defaultValue: 5 }).success).toBe(true);
    expect(fieldInputSchema.safeParse({ ...ok, defaultValue: "five" }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ ...ok, type: "SELECT", options: opts, defaultValue: "zzz" }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ ...ok, type: "CHECKBOX", options: opts, defaultValue: ["a"] }).success).toBe(true);
    expect(fieldInputSchema.safeParse({ ...ok, type: "FILE", defaultValue: "x" }).success).toBe(false);
  });

  it("rejects min > max", () => {
    expect(fieldInputSchema.safeParse({ ...ok, config: { min: 10, max: 5 } }).success).toBe(false);
  });
});

describe("sanitizeConfig & snapshots", () => {
  it("drops config keys that do not apply to the type", () => {
    expect(sanitizeConfig("TEXT", { min: 1, maxLength: 20 })).toEqual({ maxLength: 20 });
    expect(sanitizeConfig("SELECT", { min: 1 })).toBeNull();
    expect(sanitizeConfig("FILE", { accept: ["image/png"], maxFiles: 2, maxLength: 3 })).toEqual({ accept: ["image/png"], maxFiles: 2 });
  });

  it("parses stored snapshots in field order and survives garbage", () => {
    const snapshot = [f({ name: "b", type: "TEXT", sortOrder: 2 }), f({ name: "a", type: "TEXT", sortOrder: 1 })];
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot))).map((x) => x.name)).toEqual(["a", "b"]);
    expect(parseSnapshot(null)).toEqual([]);
  });
});
