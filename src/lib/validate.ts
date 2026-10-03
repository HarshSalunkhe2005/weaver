import { z } from "zod";
import { UnsafeUrlError, parsePublicUrl } from "@/lib/net";

/** Bright Data collector ids look like `c_msz54jq6b3lqmud8k`. */
export const collectorIdSchema = z.string().regex(/^c_[a-z0-9]{6,40}$/, "That doesn't look like a valid collector id.");

/** Collapses whitespace and drops control characters so free text is safe to pass to the CLI. */
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

const urlSchema = z
  .string()
  .max(2048, "That URL is too long.")
  .transform((value, ctx) => {
    try {
      return parsePublicUrl(value.trim()).href;
    } catch (err) {
      ctx.addIssue({ code: "custom", message: err instanceof UnsafeUrlError ? err.message : "Invalid URL." });
      return z.NEVER;
    }
  });

/** Free text sent to the CLI. The CLI rejects descriptions over 500 characters. */
const textSchema = (label: string) =>
  z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(1, `${label} is required.`).max(500, `${label} must be 500 characters or fewer.`));

export const renderPageBody = z.object({ url: urlSchema });
export const createBody = z.object({ url: urlSchema, description: textSchema("Description") });
export const runBody = z.object({ url: urlSchema });
export const healBody = z.object({ url: urlSchema, issue: textSchema("Issue") });
export const approveBody = z.object({ url: urlSchema, reject: z.boolean().optional() });

export type ParseResult<T> = { ok: true; data: T } | { ok: false; message: string };

export function parseWith<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
}
