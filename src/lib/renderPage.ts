/**
 * Fetches a target page and prepares it to be embedded, visually intact, in a
 * sandboxed iframe as the picker's clicking surface.
 *
 * Safety model: the iframe uses `sandbox="allow-same-origin"` and nothing
 * else, so none of the page's JavaScript ever runs. That sandbox is the real
 * boundary; the cleanup here is defense in depth:
 *   - scripts, inline `on*` handlers and `javascript:` links are removed
 *   - meta refresh, CSP meta tags, nested iframes and plugin embeds are removed
 *   - a `<base>` pointing at the page's final URL makes relative assets resolve
 *     to the real site, and a no-referrer policy keeps Weaver's address out of
 *     the third-party requests the preview makes
 *
 * Known limitation: pages that build their content with client-side JavaScript
 * look incomplete here, because scripts are deliberately never executed.
 */
import * as cheerio from "cheerio";
import { decodeHtml, safeFetch, type SafeFetchOptions } from "@/lib/net";

export interface RenderablePage {
  title: string;
  html: string;
  url: string;
  size: number;
}

export function sanitizeHtml(rawHtml: string, baseUrl: string): { title: string; html: string } {
  const $ = cheerio.load(rawHtml);
  const title = $("title").first().text().replace(/\s+/g, " ").trim() || baseUrl;

  $("script, iframe, frame, frameset, object, embed, applet, base").remove();
  $('meta[http-equiv="refresh" i], meta[http-equiv="Content-Security-Policy" i], meta[name="referrer" i]').remove();

  $("*").each((_, el) => {
    if (el.type !== "tag") return;
    for (const attr of Object.keys(el.attribs)) {
      if (/^on/i.test(attr)) $(el).removeAttr(attr);
    }
    for (const attr of ["href", "src", "action", "formaction", "xlink:href"]) {
      const value = $(el).attr(attr);
      if (value && /^\s*(javascript|vbscript):/i.test(value)) $(el).removeAttr(attr);
    }
  });

  // Attribute values are set through the DOM API, never string-concatenated.
  const head = $("head").first();
  head.prepend($("<meta>").attr({ name: "referrer", content: "no-referrer" }));
  head.prepend($("<base>").attr("href", baseUrl));

  return { title, html: $.html() };
}

export async function fetchRenderablePage(url: string, opts?: SafeFetchOptions): Promise<RenderablePage> {
  const { finalUrl, contentType, bytes } = await safeFetch(url, opts);
  const { title, html } = sanitizeHtml(decodeHtml(bytes, contentType), finalUrl);
  return { title, html, url: finalUrl, size: bytes.byteLength };
}
