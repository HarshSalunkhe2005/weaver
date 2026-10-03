import { hasApiKey, runScraper } from "@/lib/brightdata";
import { fail, guard, json, readBody } from "@/lib/http";
import { BusyError, startJob } from "@/lib/jobs";
import { collectorIdSchema, runBody } from "@/lib/validate";

export const runtime = "nodejs";

/** POST /api/scrapers/:id/run   { url }   ->  202 { jobId, job } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = guard(req, { bucket: "run", limit: 20, windowMs: 10 * 60_000 });
  if ("response" in g) return g.response;
  if (!hasApiKey()) return fail(503, "This Weaver server isn't connected to Bright Data yet.", "not_configured");

  const id = collectorIdSchema.safeParse((await params).id);
  if (!id.success) return fail(400, id.error.issues[0].message, "invalid_input");
  const body = await readBody(req, runBody);
  if ("response" in body) return body.response;

  try {
    const job = startJob("run", g.ip, (ctx) => runScraper(id.data, body.data.url, ctx));
    return json({ jobId: job.id, job }, 202);
  } catch (err) {
    if (err instanceof BusyError) return fail(429, err.message, "busy");
    throw err;
  }
}
