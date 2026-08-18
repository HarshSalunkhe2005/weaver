/**
 * Thin server-side wrapper around the Bright Data CLI (`brightdata` / `bdata`).
 *
 * We shell out to the CLI rather than reimplement its HTTP calls, per the
 * hackathon's own "keep the terminal as your UI" guidance — the CLI already
 * handles auth, polling, and retries for us. This module is the only place
 * in the app that should ever touch `child_process` or the API key.
 *
 * All shapes below (`CreateResult`, `RunResult`, `HealResult`, `ApproveResult`)
 * were captured from real CLI output against a live test scraper, not guessed
 * from docs — see context/project_state_and_workflows.md for the verification log.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

// Prefer the CLI installed as a real project dependency (node_modules/.bin) —
// this is what a fresh Render container actually has. Fall back to a global
// `brightdata` on PATH for local dev environments where it was installed
// with `npm install -g` instead.
function resolveCliBin(): string {
  const localBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "brightdata.cmd" : "brightdata"
  );
  return existsSync(localBin) ? localBin : "brightdata";
}

const CLI_BIN = resolveCliBin();
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // scraper create/heal can poll for minutes

function requireApiKey(): string {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) {
    throw new Error(
      "BRIGHTDATA_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  return key;
}

async function runCli(args: string[]): Promise<unknown> {
  const apiKey = requireApiKey();
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(CLI_BIN, [...args, "--json"], {
      env: { ...process.env, BRIGHTDATA_API_KEY: apiKey },
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    }));
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    // The CLI still prints progress lines to stdout before a final JSON blob
    // on success; on failure it throws with stderr carrying the real reason.
    throw new Error(
      `brightdata ${args.join(" ")} failed: ${e.stderr || e.message || "unknown error"}`
    );
  }

  // The CLI streams human-readable progress lines ("Step: ... polling ...")
  // to stdout before the final JSON object. Take the last line that parses
  // as JSON rather than assuming the whole stdout is JSON.
  const lines = stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      continue;
    }
  }
  throw new Error(`brightdata ${args.join(" ")}: no JSON found in output`);
}

export interface CreateResult {
  collector_id: string;
  name: string;
  status: string;
  completed_steps: string[];
  view_url: string;
  created_at: string;
}

export async function createScraper(
  url: string,
  description: string
): Promise<CreateResult> {
  return runCli(["scraper", "create", url, description]) as Promise<CreateResult>;
}

export type RunResult = Record<string, unknown>[];

export async function runScraper(
  collectorId: string,
  url: string
): Promise<RunResult> {
  return runCli(["scraper", "run", collectorId, url]) as Promise<RunResult>;
}

export interface HealResult {
  collector_id: string;
  status: "awaiting_approval" | string;
  completed_steps: string[];
  prompt: string;
  view_url: string;
  next_step: string;
  preview_result: Record<string, unknown>[];
  diff_summary: string;
}

export async function healScraper(
  collectorId: string,
  issue: string,
  url: string
): Promise<HealResult> {
  return runCli([
    "scraper",
    "heal",
    collectorId,
    issue,
    "--url",
    url,
  ]) as Promise<HealResult>;
}

export interface ApproveResult {
  collector_id: string;
  status: string;
  completed_steps: string[];
  view_url: string;
  next_step: string;
}

export async function approveHeal(
  collectorId: string,
  url: string,
  reject = false
): Promise<ApproveResult> {
  const args = ["scraper", "approve", collectorId, "--url", url];
  if (reject) args.push("--reject");
  return runCli(args) as Promise<ApproveResult>;
}
