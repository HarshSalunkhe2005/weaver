import { hasApiKey, healScraper } from "@/lib/brightdata";
import { fail, guard, json, readBody } from "@/lib/http";
import { BusyError, startJob } from "@/lib/jobs";
import { collectorIdSchema, healBody } from "@/lib/validate";

export const runtime = "nodejs";

/**
 * POST /api/scrapers/:id/heal   { issue, url }   ->  202 { jobId, job }
 *
 * Asks Bright Data to propose a fix. Nothing goes live: the result carries a
 * `preview_result` and `diff_summary` for review, and only /approve commits it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = guard(req, { bucket: "heal", limit: 6, windowMs: 10 * 60_000 });
  if ("response" in g) return g.response;
  if (!hasApiKey()) return fail(503, "This Weaver server isn't connected to Bright Data yet.", "not_configured");

  const id = collectorIdSchema.safeParse((await params).id);
  if (!id.success) return fail(400, id.error.issues[0].message, "invalid_input");
  const body = await readBody(req, healBody);
  if ("response" in body) return body.response;

  try {
    const job = startJob("heal", g.ip, (ctx) => healScraper(id.data, body.data.issue, body.data.url, ctx));
    return json({ jobId: job.id, job }, 202);
  } catch (err) {
    if (err instanceof BusyError) return fail(429, err.message, "busy");
    throw err;
  }
}
