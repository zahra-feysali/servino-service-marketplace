import { describe, expect, it } from "vitest";
import { markupToText, parseInline, parseMarkup, readingMinutes, SLUG_REGEX } from "@/features/blog/markup";
import { blogPostSchema } from "@/features/blog/schemas";
import { contactSchema } from "@/features/contact/schemas";

describe("blog markup", () => {
  it("parses headings, paragraphs, lists, quotes and bold text", () => {
    const blocks = parseMarkup(
      ["## تیتر", "خط اول", "خط دوم", "", "- یک", "- **دو**", "", "1. اول", "۲. دوم", "", "> نقل **مهم**", "### فرعی"].join("\n"),
    );
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "ol", "quote", "h3"]);
    expect(blocks[1]).toEqual({ type: "p", content: [{ text: "خط اول خط دوم", bold: false }] });
    expect(blocks[2]).toEqual({ type: "ul", items: [[{ text: "یک", bold: false }], [{ text: "دو", bold: true }]] });
    expect(blocks[3].type === "ol" && blocks[3].items).toHaveLength(2);
  });

  it("never produces HTML — tags stay plain text", () => {
    const blocks = parseMarkup('<script>alert("x")</script>\n<img src=x onerror=alert(1)>');
    expect(blocks).toEqual([{ type: "p", content: [{ text: '<script>alert("x")</script> <img src=x onerror=alert(1)>', bold: false }] }]);
  });

  it("handles inline bold edge cases", () => {
    expect(parseInline("a **b** c **d**")).toEqual([
      { text: "a ", bold: false },
      { text: "b", bold: true },
      { text: " c ", bold: false },
      { text: "d", bold: true },
    ]);
    expect(parseInline("**ناتمام")).toEqual([{ text: "**ناتمام", bold: false }]);
  });

  it("computes plain text and reading time", () => {
    expect(markupToText("## سلام\n- **یک** مورد")).toBe("سلام یک مورد");
    expect(readingMinutes("کلمه ".repeat(10))).toBe(1);
    expect(readingMinutes("کلمه ".repeat(900))).toBe(5);
  });

  it("validates slugs and post input", () => {
    expect(SLUG_REGEX.test("home-cleaning-tips")).toBe(true);
    expect(SLUG_REGEX.test("Home Cleaning")).toBe(false);
    expect(SLUG_REGEX.test("../etc")).toBe(false);
    const ok = blogPostSchema.safeParse({
      title: "عنوان آزمایشی مقاله",
      slug: "Test-Post",
      excerpt: "این یک خلاصه آزمایشی برای مقاله است.",
      content: "متن ".repeat(30),
      categoryId: "",
      coverAlt: "",
      seoTitle: "",
      seoDescription: "",
      status: "DRAFT",
      removeCover: false,
    });
    expect(ok.success && ok.data.slug).toBe("test-post");
    expect(ok.success && ok.data.categoryId).toBeNull();
  });
});

describe("contact form schema", () => {
  const base = { name: "زهرا", phone: "", email: "", subject: "پرسش درباره پرداخت", message: "سلام، سؤالی درباره پرداخت داشتم." };

  it("requires a phone or an email", () => {
    expect(contactSchema.safeParse(base).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, phone: "۰۹۱۲۱۲۳۴۵۶۷" }).success).toBe(true);
    expect(contactSchema.safeParse({ ...base, email: "a@b.co" }).success).toBe(true);
  });

  it("normalises digits and rejects invalid values", () => {
    const r = contactSchema.parse({ ...base, phone: "۰۹۱۲۱۲۳۴۵۶۷" });
    expect(r.phone).toBe("09121234567");
    expect(r.email).toBeNull();
    expect(contactSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, phone: "09121234567", message: "کوتاه" }).success).toBe(false);
  });
});
