import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { DELETE as cancelJobRoute, GET as getJobRoute } from "@/app/api/jobs/[id]/route";
import { POST as approveRoute } from "@/app/api/scrapers/[id]/approve/route";
import { POST as healRoute } from "@/app/api/scrapers/[id]/heal/route";
import { POST as runRoute } from "@/app/api/scrapers/[id]/run/route";
import { POST as createRoute } from "@/app/api/scrapers/route";
import { POST as renderRoute } from "@/app/api/render-page/route";
import { resetRateLimits } from "@/lib/guard";
import { clearJobs } from "@/lib/jobs";
import type { JobView } from "@/lib/types";

const MOCK = path.resolve(__dirname, "fixtures", "mock-brightdata.mjs");
const URL_OK = "https://books.toscrape.com/";
const ID = "c_mock0000000000001";
const saved = { ...process.env };

function post(body: unknown, ip = "9.9.9.9", extra: Record<string, string> = {}) {
  return new Request("http://weaver.test/api", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...extra },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const get = (ip = "9.9.9.9") => new Request("http://weaver.test/api", { headers: { "x-forwarded-for": ip } });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(jobId: string): Promise<JobView> {
  for (let i = 0; i < 200; i++) {
    const res = await getJobRoute(get(), withId(jobId));
    const job = (await res.json()) as JobView;
    if (job.status !== "running") return job;
    await sleep(25);
  }
  throw new Error("job never finished");
}

beforeEach(() => {
  process.env.WEAVER_CLI_ENTRY = MOCK;
  process.env.BRIGHTDATA_API_KEY = "test-key";
  process.env.MOCK_STATE_FILE = path.join(mkdtempSync(path.join(tmpdir(), "weaver-api-")), "state.json");
  delete process.env.WEAVER_ACCESS_CODE;
  resetRateLimits();
  clearJobs();
});
afterEach(() => {
  clearJobs();
  process.env = { ...saved };
});

describe("job flow", () => {
  it("create -> poll -> result, without holding the request open", async () => {
    const res = await createRoute(post({ url: URL_OK, description: "title, price" }));
    expect(res.status).toBe(202);
    const { jobId, job } = await res.json();
    expect(job.status).toBe("running");

    const done = await waitFor(jobId);
    expect(done.status).toBe("succeeded");
    expect((done.result as { collector_id: string }).collector_id).toBe(ID);
    expect(done.steps.length).toBeGreaterThan(0);
    expect(done.latest).toMatch(/Step:/);
  });

  it("runs the whole heal cycle through the API", async () => {
    const heal = await healRoute(post({ url: URL_OK, issue: "rating missing" }), withId(ID));
    expect(heal.status).toBe(202);
    const healed = await waitFor((await heal.json()).jobId);
    expect(healed.status).toBe("succeeded");
    expect((healed.result as { diff_summary: string }).diff_summary).toMatch(/star_rating/);

    const approve = await approveRoute(post({ url: URL_OK }), withId(ID));
    expect((await waitFor((await approve.json()).jobId)).status).toBe("succeeded");

    const run = await runRoute(post({ url: URL_OK }), withId(ID));
    const ran = await waitFor((await run.json()).jobId);
    expect((ran.result as Record<string, unknown>[])[0]).toHaveProperty("star_rating");
  });

  it("reports CLI failures as a failed job with a friendly message", async () => {
    const res = await createRoute(post({ url: URL_OK, description: "FAIL it" }));
    const job = await waitFor((await res.json()).jobId);
    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/rejected the API key/);
    expect(job.error).not.toMatch(/401|Status:/);
  });

  it("can cancel a running job", async () => {
    const res = await createRoute(post({ url: URL_OK, description: "SLOW" }));
    const { jobId } = await res.json();
    const del = await cancelJobRoute(new Request("http://weaver.test/api", { method: "DELETE" }), withId(jobId));
    expect((await del.json()).cancelled).toBe(true);
    expect((await waitFor(jobId)).status).toBe("cancelled");
  });

  it("returns 404 for a job that does not exist", async () => {
    const res = await getJobRoute(get(), withId("nope"));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("job_gone");
  });
});

describe("input validation", () => {
  it("rejects bad JSON, bad URLs, long text and bad ids", async () => {
    expect((await createRoute(post("{not json"))).status).toBe(400);
    expect((await createRoute(post({ url: "ftp://x.test/", description: "a" }))).status).toBe(400);
    expect((await createRoute(post({ url: "http://127.0.0.1/", description: "a" }))).status).toBe(400);
    expect((await createRoute(post({ url: URL_OK, description: "x".repeat(501) }))).status).toBe(400);
    expect((await runRoute(post({ url: URL_OK }), withId("--help"))).status).toBe(400);
    expect((await healRoute(post({ url: URL_OK }), withId(ID))).status).toBe(400);
  });

  it("uses one error shape", async () => {
    const body = await (await createRoute(post({ url: "nope", description: "a" }))).json();
    expect(body).toEqual({ error: expect.any(String), code: "invalid_input" });
  });

  it("refuses internal addresses in render-page without fetching", async () => {
    const res = await renderRoute(post({ url: "http://169.254.169.254/latest/meta-data/" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/private or internal/);
  });

  it("returns 503 when Bright Data is not configured", async () => {
    delete process.env.BRIGHTDATA_API_KEY;
    const res = await createRoute(post({ url: URL_OK, description: "title" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("not_configured");
  });
});

describe("abuse protection", () => {
  it("rate limits job creation per visitor, with Retry-After", async () => {
    for (let i = 0; i < 4; i++) {
      const ok = await createRoute(post({ url: URL_OK, description: `job ${i}` }, "5.5.5.5"));
      expect(ok.status).toBe(202);
      await waitFor((await ok.json()).jobId);
    }
    const limited = await createRoute(post({ url: URL_OK, description: "one too many" }, "5.5.5.5"));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    // another visitor is unaffected
    expect((await createRoute(post({ url: URL_OK, description: "fine" }, "6.6.6.6"))).status).toBe(202);
  });

  it("caps concurrent jobs per visitor", async () => {
    expect((await createRoute(post({ url: URL_OK, description: "SLOW 1" }, "7.7.7.7"))).status).toBe(202);
    expect((await createRoute(post({ url: URL_OK, description: "SLOW 2" }, "7.7.7.7"))).status).toBe(202);
    const third = await createRoute(post({ url: URL_OK, description: "SLOW 3" }, "7.7.7.7"));
    expect(third.status).toBe(429);
    expect((await third.json()).code).toBe("busy");
  });

  it("requires the access code when one is configured", async () => {
    process.env.WEAVER_ACCESS_CODE = "letmein";
    const body = { url: URL_OK, description: "title" };
    expect((await createRoute(post(body))).status).toBe(401);
    expect((await createRoute(post(body, "9.9.9.9", { "x-weaver-code": "wrong" }))).status).toBe(401);
    expect((await createRoute(post(body, "9.9.9.9", { "x-weaver-code": "letmein" }))).status).toBe(202);
    expect((await getJobRoute(get(), withId("x"))).status).toBe(401);
  });

  it("keeps health open and secret-free", async () => {
    process.env.WEAVER_ACCESS_CODE = "letmein";
    const body = await (await health()).json();
    expect(body).toEqual({ ok: true, brightDataConfigured: true, accessRequired: true, activeJobs: 0 });
    expect(JSON.stringify(body)).not.toMatch(/test-key|letmein/);
  });
});
