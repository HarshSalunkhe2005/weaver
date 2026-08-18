import { NextRequest, NextResponse } from "next/server";
import { healScraper } from "@/lib/brightdata";

/**
 * POST /api/scrapers/:id/heal
 * Body: { issue: string, url: string }
 *
 * Wraps `brightdata scraper heal <id> "<issue>" --url <url>`. Triggered
 * either by the user manually or automatically by Weaver's own breakage
 * detector. Returns `preview_result` + `diff_summary` — this is what the
 * "review the fix" screen (Weaver's centerpiece UI) renders before the
 * user approves or rejects.
 *
 * IMPORTANT: this does not commit anything. Bright Data's heal step is
 * itself approval-gated — nothing changes on the live scraper until
 * /api/scrapers/:id/approve is called.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { issue?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { issue, url } = body;
  if (!issue || !url) {
    return NextResponse.json(
      { error: "Both 'issue' and 'url' are required" },
      { status: 400 }
    );
  }

  try {
    const result = await healScraper(id, issue, url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
