/**
 * Abuse protection for a public deployment. Weaver's routes spend real money
 * (Bright Data credits) and make outbound requests, so they get per-visitor
 * rate limits and an optional shared access code.
 *
 * State lives in memory, which is correct here: Weaver runs as one persistent
 * Node process. If it were ever scaled to several instances this would need a
 * shared store.
 */
import { timingSafeEqual } from "node:crypto";

interface Bucket {
  count: number;
  resetAt: number;
}

const g = globalThis as unknown as { __weaverBuckets?: Map<string, Bucket> };
const buckets = (g.__weaverBuckets ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

/** The visitor's address as seen by the platform proxy (first hop of X-Forwarded-For). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "local";
}

export function accessRequired(): boolean {
  return Boolean(process.env.WEAVER_ACCESS_CODE);
}

/** When WEAVER_ACCESS_CODE is set, every API call must send it in `x-weaver-code`. */
export function hasAccess(headers: Headers): boolean {
  const expected = process.env.WEAVER_ACCESS_CODE;
  if (!expected) return true;
  const given = headers.get("x-weaver-code") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
