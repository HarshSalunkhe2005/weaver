# Weaver

**Self-healing web scrapers you build by clicking.** Point Weaver at a page, click the fields you want, and it becomes a real [Bright Data Scraper Studio](https://brightdata.com/products/web-scraper/custom) scraper. When the site changes and extraction breaks, you describe the problem, Bright Data proposes a fix, and Weaver shows you exactly what would change before anything goes live.

**Live:** https://weaver-v4zo.onrender.com _(free tier: the first load after idle takes 30 to 60 seconds to wake up)_

Built for WeMakeDevs' [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) hackathon.

## How it works

```
Read    paste a URL; Weaver fetches and sanitizes the real page
Select  click the fields you want on the rendered page, or pick them from a list
Weave   your field names become a plain-English description sent to
        `brightdata scraper create`; a real Scraper Studio collector comes back
Run     pull structured data from the collector any time (table or JSON view)
Heal    describe what broke; Bright Data proposes a fix; review a before/after
        diff with every changed field highlighted, then approve or reject
```

Every step is a real Bright Data call made through their CLI, not a mock. `examples/` holds real captured output from a normal run and from a full heal cycle.

### Using Bright Data Scraper Studio

Weaver is a thin layer over Scraper Studio's own primitives. It does not reimplement scraping, unblocking or repair.

| Weaver action | CLI command |
| --- | --- |
| Create | `brightdata scraper create <url> "<description>"` |
| Run | `brightdata scraper run <id> <url>` |
| Heal | `brightdata scraper heal <id> "<issue>" --url <url>` (returns a preview; nothing changes yet) |
| Approve / reject | `brightdata scraper approve <id> --url <url> --auto-save` / `--reject` |

`--auto-save` matters: without it `approve` finishes the review job but never saves the fix to the live template. That was a real bug, found and reproduced against production.

### Why it runs on Render, not a serverless host

Creating and healing a scraper takes one to several minutes, and Weaver shells out to a CLI. That needs a persistent Node process, so Weaver runs as one on Render.

Holding a single HTTP request open that long gets cut by the hosting proxy at about five minutes, so the slow calls run as **background jobs**: the API starts the job and returns an id immediately, and the browser polls `/api/jobs/:id` for live progress (elapsed time and the CLI's own step messages). A refresh re-attaches to the running job, and a job can be cancelled.

## Run it locally

```bash
npm install
cp .env.example .env.local     # set BRIGHTDATA_API_KEY
npm run dev
```

No API key, or don't want to spend credits? Run the whole flow against a mock Bright Data CLI:

```bash
npm run dev:mock               # http://localhost:3100
```

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `BRIGHTDATA_API_KEY` | yes | Bright Data account key. Set it in the Render dashboard; never commit it. |
| `WEAVER_ACCESS_CODE` | no | When set, every API call needs it (header `x-weaver-code`) and the UI asks visitors for it. Useful for a public deployment that spends your credits. |
| `WEAVER_CLI_ENTRY` | no | Path to a script to run in place of the Bright Data CLI (used by the tests and `dev:mock`). |

## API

Every response is JSON. Errors look like `{ "error": "readable message", "code": "machine_code" }`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/render-page` | `{ url }` fetch and sanitize a page for the picker |
| `POST` | `/api/scrapers` | `{ url, description }` start creating a scraper; returns `202 { jobId }` |
| `POST` | `/api/scrapers/:id/run` | `{ url }` start a run; returns `202 { jobId }` |
| `POST` | `/api/scrapers/:id/heal` | `{ url, issue }` ask for a fix; returns `202 { jobId }` |
| `POST` | `/api/scrapers/:id/approve` | `{ url, reject? }` apply or discard a proposed fix; returns `202 { jobId }` |
| `GET` | `/api/jobs/:id` | job state: `running`, `succeeded` (with `result`), `failed` or `cancelled`, plus live steps |
| `DELETE` | `/api/jobs/:id` | cancel a running job |
| `GET` | `/api/health` | liveness and whether a key is configured (never returns secrets) |

## Security

- **SSRF guard.** Weaver fetches whatever URL a visitor pastes, so only `http(s)` URLs are allowed, private, loopback and link-local ranges (including the cloud metadata address) are blocked, and hostnames are checked on the actual connection so DNS tricks can't swap in an internal address. Redirects are followed one hop at a time with the same checks, and response size is capped.
- **Sandboxed preview.** The target page renders in an iframe with `sandbox="allow-same-origin"` and no `allow-scripts`, so none of its JavaScript ever runs. Scripts, handlers and `javascript:` links are also stripped as defense in depth.
- **No shell, no flag injection.** The CLI is started directly, and user text always goes after a `--` separator.
- **Validated input.** Every body is checked (URL shape, collector id format, the CLI's 500-character limit) and errors never leak CLI internals.
- **Abuse limits.** Per-visitor rate limits on every route, caps on concurrent jobs, and an optional shared access code.
- **Patched dependencies.** Production dependencies report zero known vulnerabilities (`npm audit --omit=dev`).

## Tests

```bash
npm test          # 116 tests: SSRF guard, sanitizer, validation, CLI wrapper, job API
npm run lint
npm run typecheck
```

The tests run the real API route handlers against a mock CLI (`tests/fixtures/mock-brightdata.mjs`), so the full create, run, heal and approve cycle is covered without spending credits.

## Deploying (Render)

1. Push this repo to GitHub.
2. On [Render](https://render.com), **New, Blueprint**, and point it at this repo. It picks up `render.yaml`.
3. In the service's **Environment** tab, set `BRIGHTDATA_API_KEY` (and optionally `WEAVER_ACCESS_CODE`). `render.yaml` leaves the key unset on purpose.
4. Deploy. `GET /api/health` is a good health-check path.

## Known limits

- Pages that build their content with client-side JavaScript look incomplete in the preview, because their scripts are never run. Server-rendered pages work best.
- Fonts hosted on another origin may not load in the preview (their CORS rules apply), so some icon glyphs can show as boxes.
- Jobs live in memory on a single instance. A server restart loses an in-flight job, and the UI says so.
