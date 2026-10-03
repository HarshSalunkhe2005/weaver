/**
 * Server-side fetching of user-supplied URLs, hardened against SSRF.
 *
 * Weaver fetches whatever URL a visitor pastes, so without these checks it
 * could be pointed at the host's own network (cloud metadata endpoints,
 * localhost services, private ranges). Three layers:
 *   1. only http(s) URLs without embedded credentials
 *   2. literal IP hosts are checked up front
 *   3. hostnames are resolved by a custom `lookup` that runs on the actual
 *      connection, so the address that was checked is the address connected
 *      to (no DNS-rebinding gap between "check" and "use")
 * Redirects are followed manually so every hop goes through the same checks,
 * and the body is read through a hard byte cap.
 */
import dns from "node:dns";
import { BlockList, isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

export class UnsafeUrlError extends Error {}
export class FetchFailedError extends Error {}

const blocked = new BlockList();
const V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
for (const [net, prefix] of V4) blocked.addSubnet(net, prefix, "ipv4");
const V6: [string, number][] = [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
];
for (const [net, prefix] of V6) blocked.addSubnet(net, prefix, "ipv6");

/** True when the address is loopback, private, link-local, multicast or otherwise not public. */
export function isBlockedAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "");
  const kind = isIP(ip);
  if (kind === 4) return blocked.check(ip, "ipv4");
  if (kind === 6) {
    // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) wrap an IPv4 address.
    const mapped = ip.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return blocked.check(mapped[1], "ipv4");
    const hex = ip.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hex) {
      const a = parseInt(hex[1], 16);
      const b = parseInt(hex[2], 16);
      return blocked.check(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`, "ipv4");
    }
    return blocked.check(ip, "ipv6");
  }
  return true; // not an IP at all: refuse rather than guess
}

/** Parses and validates a user-supplied URL. Throws UnsafeUrlError with a user-facing message. */
export function parsePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http:// and https:// URLs can be read.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) throw new UnsafeUrlError("That URL has no host.");
  if (isIP(host) && isBlockedAddress(host)) {
    throw new UnsafeUrlError("That address is private or internal, so Weaver won't fetch it.");
  }
  if (host.toLowerCase() === "localhost" || host.toLowerCase().endsWith(".localhost")) {
    throw new UnsafeUrlError("That address is private or internal, so Weaver won't fetch it.");
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

export function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      const e: NodeJS.ErrnoException = new Error("blocked: resolves to a private or internal address");
      e.code = "EBLOCKED";
      return callback(e, "", 0);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

const agent = new Agent({
  connect: { lookup: guardedLookup as never, timeout: 10_000 },
  headersTimeout: 15_000,
  bodyTimeout: 15_000,
});

export interface SafeFetchOptions {
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  /** Test seam: replaces the network layer. */
  fetchImpl?: typeof undiciFetch;
}

export interface SafeFetchResult {
  finalUrl: string;
  contentType: string;
  bytes: Uint8Array;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? 3 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 5;
  const doFetch = opts.fetchImpl ?? undiciFetch;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 20_000);

  let url = parsePublicUrl(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let res;
    try {
      res = await doFetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal,
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
      });
    } catch (err) {
      throw new FetchFailedError(describeNetworkError(err, url));
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!location) throw new FetchFailedError(`${url.href} redirected without a destination.`);
      url = parsePublicUrl(new URL(location, url).href);
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new FetchFailedError(`The site answered ${res.status} ${res.statusText || ""}`.trim());
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
      await res.body?.cancel().catch(() => {});
      throw new FetchFailedError(`That URL isn't an HTML page (it serves ${contentType.split(";")[0]}).`);
    }

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
      await res.body?.cancel().catch(() => {});
      throw new FetchFailedError("That page is too large to preview (over 3 MB).");
    }

    const bytes = await readCapped(res.body, maxBytes);
    return { finalUrl: url.href, contentType, bytes };
  }
  throw new FetchFailedError("Too many redirects.");
}

async function readCapped(body: { getReader(): ReadableStreamDefaultReader<Uint8Array> } | null, maxBytes: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new FetchFailedError("That page is too large to preview (over 3 MB).");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Node reports every network failure as "fetch failed"; the useful reason is in `cause`. */
export function describeNetworkError(err: unknown, url?: URL): string {
  const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code;
  const where = url ? ` (${url.hostname})` : "";
  if (code === "EBLOCKED") return "That address is private or internal, so Weaver won't fetch it.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `Couldn't find that site${where}. Check the spelling of the address.`;
  if (code === "ECONNREFUSED") return `The site refused the connection${where}.`;
  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "UND_ERR_HEADERS_TIMEOUT" || (err as Error)?.name === "TimeoutError") {
    return `The site took too long to respond${where}.`;
  }
  if (code && /CERT|SSL|TLS/i.test(code)) return `The site's security certificate was rejected${where}.`;
  return cause?.message ? `Couldn't reach the site${where}: ${cause.message}` : `Couldn't reach the site${where}.`;
}

/** Decodes bytes using the charset from the header, falling back to a <meta> sniff, then UTF-8. */
export function decodeHtml(bytes: Uint8Array, contentType: string): string {
  let charset = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  if (!charset) {
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
    charset = head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1];
  }
  try {
    return new TextDecoder(charset ?? "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
