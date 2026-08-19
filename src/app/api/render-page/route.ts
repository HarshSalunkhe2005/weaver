import { NextRequest, NextResponse } from "next/server";
import { fetchRenderablePage } from "@/lib/renderPage";

/**
 * POST /api/render-page
 * Body: { url: string }
 *
 * Server-side fetch avoids CORS entirely. Returns sanitized HTML meant to
 * be embedded directly via an iframe's `srcDoc` on the client — this is
 * the picker's actual clicking surface (real layout), replacing the old
 * flattened text-list approach.
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
    const page = await fetchRenderablePage(url);
    return NextResponse.json(page);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
