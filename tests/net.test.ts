import dns from "node:dns";
import { describe, expect, it } from "vitest";
import {
  FetchFailedError,
  UnsafeUrlError,
  decodeHtml,
  guardedLookup,
  isBlockedAddress,
  parsePublicUrl,
  safeFetch,
} from "@/lib/net";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "127.8.8.8",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::7f00:1",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "172.15.255.255", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    },
  );
});

describe("parsePublicUrl", () => {
  it("accepts ordinary public URLs", () => {
    expect(parsePublicUrl("https://books.toscrape.com/catalogue/").hostname).toBe("books.toscrape.com");
    expect(parsePublicUrl("http://example.com:8080/x?y=1").port).toBe("8080");
  });

  it.each([
    ["ftp://example.com/file", /http/],
    ["file:///etc/passwd", /http/],
    ["javascript:alert(1)", /http/],
    ["https://user:pass@example.com/", /credentials/],
    ["http://localhost:3000/", /private/],
    ["http://app.localhost/", /private/],
    ["http://127.0.0.1/", /private/],
    ["http://2130706433/", /private/], // 127.0.0.1 as a single integer
    ["http://0x7f.1/", /private/], // hex / short-form loopback
    ["http://[::1]/", /private/],
    ["http://169.254.169.254/latest/meta-data/", /private/],
    ["http://10.1.2.3/", /private/],
    ["not a url", /valid URL/],
  ])("rejects %s", (raw, message) => {
    expect(() => parsePublicUrl(raw)).toThrow(UnsafeUrlError);
    expect(() => parsePublicUrl(raw)).toThrow(message);
  });
});

describe("guardedLookup", () => {
  it("refuses hostnames that resolve to loopback", async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      guardedLookup("localhost", {}, (e) => resolve(e));
    });
    expect(err?.code).toBe("EBLOCKED");
  });

  it("passes DNS errors through", async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      guardedLookup("definitely-not-a-real-host.invalid", {}, (e) => resolve(e));
    });
    expect(err).toBeTruthy();
    expect(err?.code).not.toBe("EBLOCKED");
    void dns; // keep the import used for typing clarity
  });
});

const html = (body = "<p>hi</p>") => new Response(`<html><body>${body}</body></html>`, { headers: { "content-type": "text/html" } });
const redirect = (to: string, status = 302) => new Response(null, { status, headers: { location: to } });

describe("safeFetch", () => {
  it("returns the bytes and the final URL after redirects", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: URL) => {
      calls.push(url.href);
      return calls.length === 1 ? redirect("/final") : html();
    }) as never;
    const out = await safeFetch("https://example.com/start", { fetchImpl });
    expect(out.finalUrl).toBe("https://example.com/final");
    expect(new TextDecoder().decode(out.bytes)).toContain("<p>hi</p>");
  });

  it("refuses a redirect to an internal address", async () => {
    const fetchImpl = (async () => redirect("http://169.254.169.254/latest/meta-data/")) as never;
    await expect(safeFetch("https://example.com/", { fetchImpl })).rejects.toThrow(UnsafeUrlError);
  });

  it("stops redirect loops", async () => {
    const fetchImpl = (async () => redirect("/again")) as never;
    await expect(safeFetch("https://example.com/", { fetchImpl, maxRedirects: 3 })).rejects.toThrow(/redirects/i);
  });

  it("rejects non-HTML content", async () => {
    const fetchImpl = (async () => new Response("{}", { headers: { "content-type": "application/json" } })) as never;
    await expect(safeFetch("https://example.com/api", { fetchImpl })).rejects.toThrow(/isn't an HTML page/);
  });

  it("enforces the size cap on streamed bodies", async () => {
    const big = new Response("x".repeat(5000), { headers: { "content-type": "text/html" } });
    const fetchImpl = (async () => big) as never;
    await expect(safeFetch("https://example.com/", { fetchImpl, maxBytes: 1000 })).rejects.toThrow(/too large/);
  });

  it("reports HTTP errors readably", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 404, statusText: "Not Found" })) as never;
    await expect(safeFetch("https://example.com/missing", { fetchImpl })).rejects.toThrow(/404/);
  });

  it("explains DNS failures instead of saying 'fetch failed'", async () => {
    const fetchImpl = (async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND x" } });
    }) as never;
    await expect(safeFetch("https://nope.example/", { fetchImpl })).rejects.toThrow(/Couldn't find that site/);
    await expect(safeFetch("https://nope.example/", { fetchImpl })).rejects.toBeInstanceOf(FetchFailedError);
  });

  it("refuses internal URLs before making any request", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return html();
    }) as never;
    await expect(safeFetch("http://127.0.0.1:8080/admin", { fetchImpl })).rejects.toThrow(UnsafeUrlError);
    expect(called).toBe(false);
  });
});

describe("decodeHtml", () => {
  it("uses the charset from the header", () => {
    const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xe9]); // "café" in latin1
    expect(decodeHtml(bytes, "text/html; charset=iso-8859-1")).toBe("café");
  });

  it("falls back to a meta charset, then UTF-8", () => {
    const meta = new TextEncoder().encode('<meta charset="utf-8"><p>£5</p>');
    expect(decodeHtml(meta, "text/html")).toContain("£5");
    expect(decodeHtml(new TextEncoder().encode("plain £"), "")).toBe("plain £");
  });

  it("survives an unknown charset name", () => {
    expect(decodeHtml(new TextEncoder().encode("ok"), "text/html; charset=bogus-9")).toBe("ok");
  });
});
