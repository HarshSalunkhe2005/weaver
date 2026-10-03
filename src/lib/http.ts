import { NextResponse } from "next/server";
import type { z } from "zod";
import { accessRequired, clientIp, hasAccess, rateLimit } from "@/lib/guard";
import { parseWith } from "@/lib/validate";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

/** Errors always look like `{ error: "readable message", code: "machine_code" }`. */
export function fail(status: number, message: string, code = "error", headers: Record<string, string> = {}) {
  return json({ error: message, code }, status, headers);
}

export interface Limit {
  bucket: string;
  limit: number;
  windowMs: number;
}

/** Access code + per-visitor rate limit. Returns the visitor id, or a ready-made error response. */
export function guard(req: Request, limit: Limit): { ip: string } | { response: NextResponse } {
  if (!hasAccess(req.headers)) {
    const msg = accessRequired() ? "This Weaver instance needs an access code." : "Not allowed.";
    return { response: fail(401, msg, "access_required") };
  }
  const ip = clientIp(req.headers);
  const rl = rateLimit(`${limit.bucket}:${ip}`, limit.limit, limit.windowMs);
  if (!rl.ok) {
    return {
      response: fail(429, `Too many requests. Try again in ${rl.retryAfter}s.`, "rate_limited", {
        "Retry-After": String(rl.retryAfter),
      }),
    };
  }
  return { ip };
}

export async function readBody<T>(req: Request, schema: z.ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: fail(400, "Request body must be valid JSON.", "bad_json") };
  }
  const parsed = parseWith(schema, raw);
  if (!parsed.ok) return { response: fail(400, parsed.message, "invalid_input") };
  return { data: parsed.data };
}
