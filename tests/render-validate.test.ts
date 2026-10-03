import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "@/lib/renderPage";
import { detectBreakage } from "@/lib/detectBreakage";
import { approveBody, cleanText, collectorIdSchema, createBody, healBody, parseWith, renderPageBody } from "@/lib/validate";

describe("sanitizeHtml", () => {
  const dirty = `<!doctype html><html><head><title>  Shop \n page </title>
    <meta http-equiv="refresh" content="0;url=https://evil.test">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'">
    <base href="https://evil.test/"><script>alert(1)</script></head>
    <body onload="steal()"><h1 onclick="x()">Hello</h1>
    <a href="javascript:alert(1)">bad</a><a href="/ok">ok</a>
    <iframe src="https://evil.test"></iframe><object data="x"></object><embed src="y">
    <form action="javascript:bad()"><button formaction="vbscript:bad">go</button></form></body></html>`;

  const { title, html } = sanitizeHtml(dirty, "https://shop.test/p/1");

  it("extracts a tidy title", () => expect(title).toBe("Shop page"));
  it("removes scripts, frames and embeds", () => {
    expect(html).not.toMatch(/<script|<iframe|<object|<embed/i);
  });
  it("removes inline handlers and javascript: URLs", () => {
    expect(html).not.toMatch(/onload=|onclick=|javascript:|vbscript:/i);
    expect(html).toContain('href="/ok"');
  });
  it("removes meta refresh and CSP, and any other base tag", () => {
    expect(html).not.toMatch(/http-equiv/i);
    expect(html).not.toContain("evil.test");
  });
  it("sets exactly one base pointing at the final URL, plus no-referrer", () => {
    expect(html.match(/<base /g)).toHaveLength(1);
    expect(html).toContain('<base href="https://shop.test/p/1">');
    expect(html).toContain('name="referrer"');
  });

  it("cannot be broken out of through a hostile base URL", () => {
    const hostile = 'https://a.test/?q="><script>alert(1)</script>';
    const out = sanitizeHtml("<html><head></head><body>x</body></html>", hostile).html;
    const $ = cheerio.load(out);
    expect($("script")).toHaveLength(0); // nothing executable was injected
    expect($("base")).toHaveLength(1);
    expect($("base").attr("href")).toBe(hostile); // the value stayed inside its attribute
    expect(out).toContain("&quot;"); // and the quote was escaped
  });

  it("drops HTML comments, including IE conditional blocks that hide scripts", () => {
    const out = sanitizeHtml(
      '<html><head><!--[if lt IE 9]><script src="//x.test/shim.js"></script><![endif]--></head><body><!-- note --><p>hi</p></body></html>',
      "https://a.test/",
    ).html;
    expect(out).not.toMatch(/<!--|<script|shim\.js/i);
    expect(out).toContain("<p>hi</p>");
  });

  it("falls back to the URL when the page has no title", () => {
    expect(sanitizeHtml("<p>x</p>", "https://a.test/").title).toBe("https://a.test/");
  });
});

describe("detectBreakage", () => {
  it("is quiet for healthy results", () => {
    expect(detectBreakage([{ title: "A", price: 1, input: { url: "x" } }])).toBeNull();
    expect(detectBreakage([])).toBeNull();
    expect(detectBreakage(null)).toBeNull();
  });
  it("flags empty fields but ignores the input echo", () => {
    expect(detectBreakage([{ title: "A", price: null, rating: "", input: "" }])).toBe(
      "These fields came back empty: price, rating",
    );
  });
  it("flags an error field", () => {
    expect(detectBreakage([{ error: "account suspended" }])).toContain("error field");
  });
});

describe("validation", () => {
  it("cleans free text", () => {
    expect(cleanText("  price \n\t and\u0000 title  ")).toBe("price and title");
  });

  it("accepts a normal create body and normalises it", () => {
    const r = parseWith(createBody, { url: " https://books.toscrape.com/ ", description: "  title,   price " });
    expect(r).toEqual({ ok: true, data: { url: "https://books.toscrape.com/", description: "title, price" } });
  });

  it("enforces the CLI's 500 character limit", () => {
    const r = parseWith(createBody, { url: "https://a.test/", description: "x".repeat(501) });
    expect(r.ok).toBe(false);
    expect(parseWith(createBody, { url: "https://a.test/", description: "x".repeat(500) }).ok).toBe(true);
  });

  it("rejects empty text and wrong types", () => {
    expect(parseWith(createBody, { url: "https://a.test/", description: "   " }).ok).toBe(false);
    expect(parseWith(createBody, { url: 5, description: "x" }).ok).toBe(false);
    expect(parseWith(healBody, { url: "https://a.test/" }).ok).toBe(false);
    expect(parseWith(approveBody, { url: "https://a.test/", reject: "yes" }).ok).toBe(false);
  });

  it("rejects internal and non-http URLs with a readable message", () => {
    const r = parseWith(renderPageBody, { url: "http://169.254.169.254/" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/private or internal/);
    expect(parseWith(renderPageBody, { url: "file:///etc/passwd" }).ok).toBe(false);
  });

  it("only accepts real-looking collector ids", () => {
    expect(collectorIdSchema.safeParse("c_msz54jq6b3lqmud8k").success).toBe(true);
    for (const bad of ["--help", "c_", "C_ABC12345", "c_abc def", "../x", "c_" + "a".repeat(41), ""]) {
      expect(collectorIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});
