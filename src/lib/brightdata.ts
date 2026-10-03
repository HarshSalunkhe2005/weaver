/**
 * Server-side wrapper around the Bright Data CLI (`brightdata`).
 *
 * The CLI already handles auth, polling and retries, so Weaver shells out to it
 * instead of reimplementing its HTTP calls. This module is the only place that
 * touches `child_process` or the API key, and it never uses a shell:
 *   - the CLI is started directly with `node <entry>` (works the same on
 *     Linux and Windows)
 *   - user text always goes after a `--` separator, so a value that begins
 *     with `-` can't be read as a flag
 *
 * Result shapes (src/lib/types.ts) were captured from real CLI output.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ApproveResult, CreateResult, HealResult, RunResult } from "@/lib/types";

export class CancelledError extends Error {
  constructor() {
    super("Cancelled.");
  }
}

export interface RunContext {
  onProgress?: (line: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12 * 60 * 1000; // create/heal can poll for several minutes
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

export function hasApiKey(): boolean {
  return Boolean(process.env.BRIGHTDATA_API_KEY);
}

/** `WEAVER_CLI_ENTRY` swaps in another script (used by the tests); otherwise the installed package, then PATH. */
function resolveCli(): { cmd: string; prefix: string[] } {
  const override = process.env.WEAVER_CLI_ENTRY;
  if (override) return { cmd: process.execPath, prefix: [override] };
  const pkgDir = path.join(process.cwd(), "node_modules", "@brightdata", "cli");
  try {
    const pkg = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));
    const bin: string | undefined = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.brightdata;
    if (bin) {
      const entry = path.join(pkgDir, bin);
      if (existsSync(entry)) return { cmd: process.execPath, prefix: [entry] };
    }
  } catch {
    // fall through to a globally installed CLI
  }
  return { cmd: "brightdata", prefix: [] };
}

/** Pulls the final JSON value out of CLI output that also contains progress text. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const lines = trimmed.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || (line[0] !== "{" && line[0] !== "[")) continue;
    try {
      return JSON.parse(line);
    } catch {
      // may be one line of a pretty-printed block; handled below
    }
  }
  // Pretty-printed JSON spans lines: try progressively earlier block starts.
  let tries = 0;
  for (let i = lines.length - 1; i >= 0 && tries < 8; i--) {
    const first = lines[i][0];
    if (first !== "{" && first !== "[") continue;
    tries++;
    try {
      return JSON.parse(lines.slice(i).join("\n"));
    } catch {
      // keep looking
    }
  }
  return undefined;
}

/** Turns raw CLI failure text into something a visitor can act on, without leaking internals. */
export function friendlyCliError(output: string): string {
  const text = output.replace(ANSI, "");
  if (/BRIGHTDATA_API_KEY.*(not set|missing)|no api key|not logged in/i.test(text)) {
    return "This Weaver server isn't connected to Bright Data (no API key configured).";
  }
  if (/invalid credentials|invalid or expired api key|\b401\b/i.test(text)) {
    return "Bright Data rejected the API key this server uses. The owner needs to check it.";
  }
  if (/suspended/i.test(text)) return "Bright Data reported the account as suspended.";
  if (/\b409\b|already in progress|another refactor/i.test(text)) {
    return "Another job is still running on this collector. Give it a minute, then try again.";
  }
  if (/\b429\b|concurrent|rate limit/i.test(text)) {
    return "Bright Data is busy with other jobs right now. Try again in a few minutes.";
  }
  const last = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .pop();
  return last ? `Bright Data error: ${last.slice(0, 300)}` : "The Bright Data CLI failed without a message.";
}

/** Runs the CLI with `options` (flags), then `--`, then `positionals`. Resolves with the final JSON value. */
export function runCli(
  subcommand: string[],
  options: string[],
  positionals: string[],
  ctx: RunContext = {},
): Promise<unknown> {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) return Promise.reject(new Error(friendlyCliError("BRIGHTDATA_API_KEY is not set")));

  const { cmd, prefix } = resolveCli();
  const args = [...prefix, ...subcommand, ...options, "--json", "--", ...positionals];

  return new Promise((resolve, reject) => {
    if (ctx.signal?.aborted) return reject(new CancelledError());

    const child = spawn(/*turbopackIgnore: true*/ cmd, args, {
      env: { ...process.env, BRIGHTDATA_API_KEY: apiKey },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const carry = { out: "", err: "" };

    const emit = (chunk: string, key: "out" | "err") => {
      carry[key] += chunk;
      const parts = carry[key].split("\n");
      carry[key] = parts.pop() ?? "";
      for (const raw of parts) {
        const line = raw.replace(ANSI, "").trim();
        if (!line || line[0] === "{" || line[0] === "[") continue;
        ctx.onProgress?.(line.slice(0, 200));
      }
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ctx.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    const kill = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    };
    const onAbort = () => {
      kill();
      finish(() => reject(new CancelledError()));
    };
    const timer = setTimeout(() => {
      kill();
      finish(() => reject(new Error("Bright Data took too long to answer (over 12 minutes), so Weaver gave up.")));
    }, ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    ctx.signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += d;
      emit(d, "out");
    });
    child.stderr.on("data", (d: string) => {
      if (stderr.length < 65536) stderr += d;
      emit(d, "err");
    });
    child.on("error", (err) => {
      finish(() => reject(new Error(`Couldn't start the Bright Data CLI: ${err.message}`)));
    });
    child.on("close", (code) => {
      finish(() => {
        if (code !== 0) return reject(new Error(friendlyCliError(`${stderr}\n${stdout}`)));
        const value = extractJson(stdout);
        if (value === undefined) return reject(new Error("The Bright Data CLI finished but returned no data."));
        resolve(value);
      });
    });
  });
}

export function createScraper(url: string, description: string, ctx?: RunContext) {
  return runCli(["scraper", "create"], [], [url, description], ctx) as Promise<CreateResult>;
}

export function runScraper(collectorId: string, url: string, ctx?: RunContext) {
  return runCli(["scraper", "run"], [], [collectorId, url], ctx) as Promise<RunResult>;
}

export function healScraper(collectorId: string, issue: string, url: string, ctx?: RunContext) {
  return runCli(["scraper", "heal"], ["--url", url], [collectorId, issue], ctx) as Promise<HealResult>;
}

/**
 * Approving always passes `--auto-save`. Without it the CLI finishes the review
 * job but never persists the fix to the live template (found and reproduced
 * against production: approve said "done", the next run still used the old
 * schema). Rejecting has nothing to save.
 */
export function approveHeal(collectorId: string, url: string, reject: boolean, ctx?: RunContext) {
  const options = ["--url", url, reject ? "--reject" : "--auto-save"];
  return runCli(["scraper", "approve"], options, [collectorId], ctx) as Promise<ApproveResult>;
}
