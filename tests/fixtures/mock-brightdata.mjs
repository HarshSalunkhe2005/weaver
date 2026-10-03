#!/usr/bin/env node
/**
 * Stand-in for the Bright Data CLI, used by the tests and by local end-to-end
 * runs (WEAVER_CLI_ENTRY=tests/fixtures/mock-brightdata.mjs). It mimics the
 * real CLI's shape: progress text first, one JSON line last, non-zero exit on
 * failure. No network, no credits.
 *
 * Triggers (put these words in a description / issue):
 *   FAIL  -> exits 1 with a 401 "Invalid credentials" error
 *   SLOW  -> sleeps 60s (for cancel / timeout tests)
 *   BUSY  -> exits 1 with a 409 "another refactor job" error
 * State (has the heal been approved?) is kept in MOCK_STATE_FILE if set.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const dash = argv.indexOf("--");
const before = dash === -1 ? argv : argv.slice(0, dash);
const positionals = dash === -1 ? [] : argv.slice(dash + 1);
const [group, action] = before;
const delay = Number(process.env.MOCK_DELAY_MS ?? 20);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (line) => console.log(line);

const stateFile = process.env.MOCK_STATE_FILE;
const readState = () => (stateFile && existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {});
const writeState = (s) => stateFile && writeFileSync(stateFile, JSON.stringify(s));

const text = positionals.join(" ");
const option = (name) => {
  const i = before.indexOf(name);
  return i === -1 ? undefined : before[i + 1];
};

if (!process.env.BRIGHTDATA_API_KEY) {
  console.error("Error: BRIGHTDATA_API_KEY is not set");
  process.exit(1);
}
if (/\bFAIL\b/.test(text)) {
  console.error("Failed: Error: Invalid credentials\n  Status: 401");
  process.exit(1);
}
if (/\bBUSY\b/.test(text)) {
  console.error("Failed: Error: 409 Another refactor job is still in progress");
  process.exit(1);
}

async function steps(names) {
  for (const n of names) {
    log(`Step: ${n} ...`);
    await sleep(delay);
  }
}
if (/\bSLOW\b/.test(text)) await sleep(60_000);

const row = (healed, url = positionals[1]) => ({
  book_title: "A Light in the Attic",
  price: { value: 51.77, currency: "GBP", symbol: "£" },
  ...(healed ? { star_rating: "Three" } : {}),
  input: { url: url ?? "https://books.toscrape.com/" },
});

if (group !== "scraper") {
  console.error(`mock: unsupported command ${group} ${action}`);
  process.exit(2);
}

if (action === "create") {
  await steps(["intent analysis", "schema generation", "code generation", "preview"]);
  writeState({});
  log(
    JSON.stringify({
      collector_id: "c_mock0000000000001",
      name: "mock-scraper",
      status: "ready",
      completed_steps: ["intent", "schema", "code", "preview"],
      view_url: "https://brightdata.com/cp/scrapers/c_mock0000000000001",
      created_at: new Date().toISOString(),
      _echo: { url: positionals[0], description: positionals[1] },
    }),
  );
} else if (action === "run") {
  await steps(["triggering scrape", "polling"]);
  log(JSON.stringify([row(readState().healed)]));
} else if (action === "heal") {
  await steps(["diagnosing", "proposing a fix", "previewing the fix"]);
  log(
    JSON.stringify({
      collector_id: positionals[0],
      status: "awaiting_approval",
      view_url: "https://brightdata.com/cp/scrapers/" + positionals[0],
      next_step: "approve or reject",
      diff_summary: "proposed template adds the star_rating field",
      preview_result: [row(true, option("--url"))],
      _echo: { issue: positionals[1], url: option("--url") },
    }),
  );
} else if (action === "approve") {
  await steps(["reviewing", "saving the template"]);
  const reject = before.includes("--reject");
  if (!reject && before.includes("--auto-save")) writeState({ healed: true });
  log(
    JSON.stringify({
      collector_id: positionals[0],
      status: "done",
      completed_steps: reject ? ["review"] : ["review", "save_new_template"],
      view_url: "https://brightdata.com/cp/scrapers/" + positionals[0],
    }),
  );
} else {
  console.error(`mock: unsupported action ${action}`);
  process.exit(2);
}
