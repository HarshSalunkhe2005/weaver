import { NextRequest, NextResponse } from "next/server";
import { createScraper } from "@/lib/brightdata";

/**
 * POST /api/scrapers
 * Body: { url: string, description: string }
 *
 * Wraps `brightdata scraper create <url> "<description>"`. This is step 4
 * of Weaver's flow: turns the user's element picks (already reduced to a
 * plain-English description by the picker UI) into a real Scraper Studio
 * collector.
 */
export async function POST(req: NextRequest) {
  let body: { url?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, description } = body;
  if (!url || !description) {
    return NextResponse.json(
      { error: "Both 'url' and 'description' are required" },
      { status: 400 }
    );
  }

  try {
    const result = await createScraper(url, description);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
