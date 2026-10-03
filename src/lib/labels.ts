/** Suggests a field name for a clicked element so the visitor mostly just confirms it. */
export function guessLabel(tag: string, text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (tag === "img") return "image";
  if (/^[£$€₹¥]\s?\d|^\d[\d,.]*\s?(usd|eur|gbp|inr)\b/i.test(t)) return "price";
  if (/\b(star|stars|rating|rated)\b/i.test(t) && t.length < 40) return "rating";
  if (/\b(in stock|out of stock|available|availability)\b/i.test(t) && t.length < 60) return "availability";
  if (tag === "h1") return "title";
  if (tag === "a") return `${slug(t.split(" ").slice(0, 2).join(" "))}_link` || "link";
  return slug(t.split(" ").slice(0, 3).join(" ")) || tag;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
}

/** The plain-English description sent to Bright Data: unique, non-empty field names. Max 500 characters. */
export function buildDescription(labels: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = raw.replace(/\s+/g, " ").trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out.join(", ");
}

export const MAX_DESCRIPTION = 500;
