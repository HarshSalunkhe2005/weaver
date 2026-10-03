import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CancelledError,
  approveHeal,
  createScraper,
  extractJson,
  friendlyCliError,
  healScraper,
  runScraper,
} from "@/lib/brightdata";

const MOCK = path.resolve(__dirname, "fixtures", "mock-brightdata.mjs");
const URL_OK = "https://books.toscrape.com/";
const ID = "c_mock0000000000001";

const saved = { ...process.env };
beforeEach(() => {
  process.env.WEAVER_CLI_ENTRY = MOCK;
  process.env.BRIGHTDATA_API_KEY = "test-key";
  process.env.MOCK_STATE_FILE = path.join(mkdtempSync(path.join(tmpdir(), "weaver-")), "state.json");
});
afterEach(() => {
  process.env = { ...saved };
});

describe("extractJson", () => {
  it("takes the last JSON line after progress text", () => {
    expect(extractJson('Step: a ...\nStep: b ...\n{"ok":true}\n')).toEqual({ ok: true });
    expect(extractJson('{"old":1}\nnoise\n[{"n":2}]')).toEqual([{ n: 2 }]);
  });
  it("handles pretty-printed output", () => {
    expect(extractJson('working...\n{\n  "a": 1,\n  "b": [1, 2]\n}\n')).toEqual({ a: 1, b: [1, 2] });
  });
  it("returns undefined when there is no JSON", () => {
    expect(extractJson("just text")).toBeUndefined();
    expect(extractJson("")).toBeUndefined();
  });
});

describe("friendlyCliError", () => {
  it.each([
    ["Error: Invalid credentials\n  Status: 401", /rejected the API key/],
    ["409 Another refactor job is still in progress", /still running on this collector/],
    ["Status: 429 concurrent job cap", /busy/],
    ["Your account is currently suspended", /suspended/],
    ["BRIGHTDATA_API_KEY is not set", /isn't connected/],
    ["boom\nsomething odd happened", /Bright Data error: something odd happened/],
  ])("maps %j", (raw, expected) => {
    expect(friendlyCliError(raw)).toMatch(expected);
  });
});

describe("runCli through the CLI wrapper", () => {
  it("creates a scraper, streaming progress lines", async () => {
    const steps: string[] = [];
    const out = await createScraper(URL_OK, "title and price", { onProgress: (l) => steps.push(l) });
    expect(out.collector_id).toBe(ID);
    expect(steps).toEqual([
      "Step: intent analysis ...",
      "Step: schema generation ...",
      "Step: code generation ...",
      "Step: preview ...",
    ]);
  });

  it("passes user text after `--`, so a leading dash is data, not a flag", async () => {
    const out = (await createScraper(URL_OK, "-x --help price")) as unknown as { _echo: { description: string } };
    expect(out._echo.description).toBe("-x --help price");
  });

  it("runs, heals and approves; approval persists and a re-run shows the fix", async () => {
    expect((await runScraper(ID, URL_OK))[0]).not.toHaveProperty("star_rating");

    const heal = await healScraper(ID, "star_rating is missing", URL_OK);
    expect(heal.status).toBe("awaiting_approval");
    expect(heal.preview_result[0]).toHaveProperty("star_rating");
    expect((heal as unknown as { _echo: { url: string } })._echo.url).toBe(URL_OK);

    const approved = await approveHeal(ID, URL_OK, false);
    expect(approved.completed_steps).toContain("save_new_template"); // proves --auto-save was sent
    expect((await runScraper(ID, URL_OK))[0]).toHaveProperty("star_rating");
  });

  it("rejecting a fix does not save it", async () => {
    const rejected = await approveHeal(ID, URL_OK, true);
    expect(rejected.completed_steps).not.toContain("save_new_template");
    expect((await runScraper(ID, URL_OK))[0]).not.toHaveProperty("star_rating");
  });

  it("turns CLI failures into friendly errors", async () => {
    await expect(createScraper(URL_OK, "FAIL please")).rejects.toThrow(/rejected the API key/);
    await expect(healScraper(ID, "BUSY now", URL_OK)).rejects.toThrow(/still running on this collector/);
  });

  it("fails clearly when no API key is configured", async () => {
    delete process.env.BRIGHTDATA_API_KEY;
    await expect(createScraper(URL_OK, "title")).rejects.toThrow(/isn't connected to Bright Data/);
  });

  it("can be cancelled mid-flight", async () => {
    const controller = new AbortController();
    const started = Date.now();
    const p = createScraper(URL_OK, "SLOW job", { signal: controller.signal });
    setTimeout(() => controller.abort(), 300);
    await expect(p).rejects.toBeInstanceOf(CancelledError);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("gives up after the timeout", async () => {
    await expect(createScraper(URL_OK, "SLOW job", { timeoutMs: 400 })).rejects.toThrow(/took too long/);
  });

  it("reports a missing CLI binary", async () => {
    process.env.WEAVER_CLI_ENTRY = path.resolve(__dirname, "fixtures", "does-not-exist.mjs");
    await expect(createScraper(URL_OK, "title")).rejects.toThrow();
  });
});
