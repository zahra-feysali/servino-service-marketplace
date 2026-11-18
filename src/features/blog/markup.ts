/**
 * Blog content format — a tiny, safe subset of Markdown, parsed into plain data and rendered as
 * React text (never as raw HTML, so there is no XSS surface):
 *
 *   ## Heading            ### Sub-heading
 *   - item / * item        1. item
 *   > quote                **bold** inside any line
 *   blank line = paragraph break
 */

export type Inline = { text: string; bold: boolean };
export type Block =
  | { type: "h2" | "h3" | "p" | "quote"; content: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out.filter((s) => s.text.length > 0);
}

export function parseMarkup(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: Inline[][] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "p", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) blocks.push({ type: "quote", content: parseInline(quote.join(" ")) });
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushAll();
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushAll();
      blocks.push({ type: heading[1].length === 2 ? "h2" : "h3", content: parseInline(heading[2].trim()) });
      continue;
    }
    const bullet = /^[-*•]\s+(.+)$/.exec(line);
    const numbered = /^[0-9۰-۹]+[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(parseInline((bullet ?? numbered)![1].trim()));
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      flushParagraph();
      flushList();
      quote.push(q[1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line);
  }
  flushAll();
  return blocks;
}

/** Plain text (for excerpts, search and reading time). */
export function markupToText(source: string): string {
  return source
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{2,3}\s+/gm, "")
    .replace(/^[-*•>]\s?/gm, "")
    .replace(/^[0-9۰-۹]+[.)]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reading time in minutes at ~180 words per minute (Persian), minimum 1. */
export function readingMinutes(source: string): number {
  const words = markupToText(source).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
