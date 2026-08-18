import { NextRequest, NextResponse } from "next/server";
import { runScraper } from "@/lib/brightdata";

/**
 * POST /api/scrapers/:id/run
 * Body: { url: string }
 *
 * Wraps `brightdata scraper run <id> <url>`. Weaver calls this on demand
 * and (later) on a schedule to pull fresh structured data, and also uses
 * its result to feed the breakage-detection logic (nulls / missing fields
 * / schema drift vs. the previous run).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;
  if (!url) {
    return NextResponse.json({ error: "'url' is required" }, { status: 400 });
  }

  try {
    const result = await runScraper(id, url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
