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
    return NextResponse.json({ error: describeFetchError(err) }, { status: 502 });
  }
}

/**
 * Node's `fetch` collapses every network-level failure (DNS lookup
 * failure, connection refused, TLS error) into a bare `TypeError: fetch
 * failed` — the actually useful reason lives one level down in `err.cause`
 * (e.g. `ENOTFOUND`, `ECONNREFUSED`). Surface that instead of the generic
 * message so a user pasting a typo'd or dead domain sees something
 * actionable rather than just "fetch failed".
 */
function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error";
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message) {
    return `${err.message}: ${cause.message}`;
  }
  return err.message;
}
