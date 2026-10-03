#!/usr/bin/env node
/**
 * Runs the dev server against a mock Bright Data CLI, so the whole flow (read,
 * pick, create, run, heal, approve) works offline and spends no credits.
 *   npm run dev:mock
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  WEAVER_CLI_ENTRY: path.join(root, "tests", "fixtures", "mock-brightdata.mjs"),
  BRIGHTDATA_API_KEY: "mock-key",
  MOCK_DELAY_MS: process.env.MOCK_DELAY_MS ?? "1500",
  MOCK_STATE_FILE: path.join(mkdtempSync(path.join(tmpdir(), "weaver-mock-")), "state.json"),
};
const port = process.env.PORT ?? "3100";
console.log(`Weaver (mock Bright Data CLI) on http://localhost:${port}`);
const child = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", port], {
  cwd: root,
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
