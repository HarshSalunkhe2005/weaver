import { hasApiKey } from "@/lib/brightdata";
import { accessRequired } from "@/lib/guard";
import { json } from "@/lib/http";
import { activeJobs } from "@/lib/jobs";

export const runtime = "nodejs";

/** GET /api/health -> liveness plus what the UI needs to know (never any secrets). */
export function GET() {
  return json({ ok: true, brightDataConfigured: hasApiKey(), accessRequired: accessRequired(), activeJobs: activeJobs() });
}
