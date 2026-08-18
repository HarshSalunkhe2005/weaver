import { NextRequest, NextResponse } from "next/server";
import { approveHeal } from "@/lib/brightdata";

/**
 * POST /api/scrapers/:id/approve
 * Body: { url: string, reject?: boolean }
 *
 * Wraps `brightdata scraper approve <id> --url <url>` (or `--reject`).
 * This is what the user's Approve/Reject click on the "review the fix"
 * screen actually calls. On approve, the healed scraper becomes live
 * under the same collector ID — no downstream code/URLs need to change.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { url?: string; reject?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, reject } = body;
  if (!url) {
    return NextResponse.json({ error: "'url' is required" }, { status: 400 });
  }

  try {
    const result = await approveHeal(id, url, Boolean(reject));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
