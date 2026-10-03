import { createScraper, hasApiKey } from "@/lib/brightdata";
import { fail, guard, json, readBody } from "@/lib/http";
import { BusyError, startJob } from "@/lib/jobs";
import { createBody } from "@/lib/validate";

export const runtime = "nodejs";

/**
 * POST /api/scrapers   { url, description }   ->  202 { jobId, job }
 *
 * Starts `brightdata scraper create` as a background job (it takes one to
 * several minutes). Poll GET /api/jobs/:jobId for the outcome.
 */
export async function POST(req: Request) {
  const g = guard(req, { bucket: "create", limit: 4, windowMs: 10 * 60_000 });
  if ("response" in g) return g.response;
  if (!hasApiKey()) return fail(503, "This Weaver server isn't connected to Bright Data yet.", "not_configured");

  const body = await readBody(req, createBody);
  if ("response" in body) return body.response;

  try {
    const job = startJob("create", g.ip, (ctx) => createScraper(body.data.url, body.data.description, ctx));
    return json({ jobId: job.id, job }, 202);
  } catch (err) {
    if (err instanceof BusyError) return fail(429, err.message, "busy");
    throw err;
  }
}
