import { NextRequest, NextResponse } from "next/server";
import { fetchAndParsePage } from "@/lib/parsePage";

/**
 * POST /api/parse-page
 * Body: { url: string }
 *
 * Server-side fetch avoids CORS entirely (the browser never talks to the
 * target site directly). This is step 2 of Weaver's flow: turns a raw URL
 * into the structural element list the picker UI renders as clickable rows.
 */
export async function POST(req: NextRequest) {
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
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const parsed = await fetchAndParsePage(url);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
