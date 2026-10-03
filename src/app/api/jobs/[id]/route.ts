import { fail, guard, json } from "@/lib/http";
import { cancelJob, getJob } from "@/lib/jobs";

export const runtime = "nodejs";

const GONE = "That job is no longer available. The server may have restarted; start it again.";

/** GET /api/jobs/:id -> the job's current state (and its result once it has succeeded). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = guard(req, { bucket: "poll", limit: 300, windowMs: 60_000 });
  if ("response" in g) return g.response;
  const job = getJob((await params).id);
  return job ? json(job) : fail(404, GONE, "job_gone");
}

/** DELETE /api/jobs/:id -> cancels a running job (kills the CLI process). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = guard(req, { bucket: "poll", limit: 300, windowMs: 60_000 });
  if ("response" in g) return g.response;
  const id = (await params).id;
  const cancelled = cancelJob(id);
  const job = getJob(id);
  return job ? json({ cancelled, job }) : fail(404, GONE, "job_gone");
}
