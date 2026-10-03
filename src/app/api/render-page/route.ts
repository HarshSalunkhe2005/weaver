import { fail, guard, json, readBody } from "@/lib/http";
import { FetchFailedError } from "@/lib/net";
import { fetchRenderablePage } from "@/lib/renderPage";
import { renderPageBody } from "@/lib/validate";

export const runtime = "nodejs";

/**
 * POST /api/render-page   { url }
 *
 * Fetches the page on the server (no CORS problems), sanitizes it, and returns
 * HTML for the picker's sandboxed iframe. The fetch is SSRF-guarded: see src/lib/net.ts.
 */
export async function POST(req: Request) {
  const g = guard(req, { bucket: "render", limit: 30, windowMs: 60_000 });
  if ("response" in g) return g.response;

  const body = await readBody(req, renderPageBody);
  if ("response" in body) return body.response;

  try {
    return json(await fetchRenderablePage(body.data.url));
  } catch (err) {
    if (err instanceof FetchFailedError) return fail(502, err.message, "fetch_failed");
    return fail(502, "Couldn't read that page.", "fetch_failed");
  }
}
