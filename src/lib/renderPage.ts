/**
 * Fetches a target page and prepares it to be embedded, visually intact, in
 * a sandboxed iframe as the picker's actual clicking surface — real layout,
 * real CSS, instead of a flattened text list.
 *
 * Safety model: the iframe is rendered with `sandbox="allow-same-origin"`
 * and NOTHING else — no `allow-scripts`. That alone is what makes it safe to
 * embed an arbitrary third-party page's HTML: none of its JavaScript ever
 * runs, in our origin or any other. Everything below is defense in depth on
 * top of that, not the actual safety boundary:
 *   - strip <script> tags and inline `on*=` handlers, so there's nothing
 *     inert-but-confusing left in the DOM
 *   - strip <meta http-equiv="refresh"> so the sandboxed doc can't try to
 *     navigate itself
 *   - strip any CSP meta tag the target page sets, since it was authored
 *     for the target's own origin/resources and would otherwise just cause
 *     broken loads inside ours
 *   - strip nested <iframe>s to avoid recursive/confusing embeds
 *
 * A <base> tag pointing at the page's own URL is injected so that every
 * relative image/stylesheet/link in the markup resolves back to the real
 * site — this is what makes the layout come out looking right without us
 * proxying every asset ourselves.
 *
 * Known, accepted limitation: pages that render their real content via
 * client-side JavaScript (SPAs) will look broken here, because we
 * deliberately never execute the target's scripts. Server-rendered pages
 * render essentially as-is.
 */
import * as cheerio from "cheerio";

export interface RenderablePage {
  title: string;
  html: string;
}

export async function fetchRenderablePage(url: string): Promise<RenderablePage> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Fetching ${url} failed: HTTP ${res.status}`);
  }

  const rawHtml = await res.text();
  const $ = cheerio.load(rawHtml);

  const title = $("title").first().text().trim() || url;

  $("script").remove();
  $("iframe").remove();
  $('meta[http-equiv="refresh" i]').remove();
  $('meta[http-equiv="Content-Security-Policy" i]').remove();
  $("base").remove();

  // Strip inline event handlers and javascript: URLs from every element —
  // inert under our sandbox regardless, this just keeps the DOM clean.
  $("*").each((_, el) => {
    if (el.type !== "tag") return;
    for (const attr of Object.keys(el.attribs)) {
      if (/^on/i.test(attr)) $(el).removeAttr(attr);
    }
    const href = $(el).attr("href");
    if (href && /^\s*javascript:/i.test(href)) $(el).removeAttr("href");
  });

  $("head").prepend(`<base href="${url}">`);

  return { title, html: $.html() };
}
