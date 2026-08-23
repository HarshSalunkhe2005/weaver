# Weaver

A visual, self-healing web scraper built on [Bright Data Scraper Studio](https://brightdata.com/products/web-scraper/custom), for WeMakeDevs' [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) hackathon.

**Live:** https://weaver-v4zo.onrender.com _(free tier — first load after idle takes ~30–60s to wake up)_

Point Weaver at a page. It renders the **real page** — actual HTML and CSS in a sandboxed preview, not a flattened list — so you click directly on what you want, the way you'd inspect it in a browser. Weaver turns your clicks into a real Bright Data Scraper Studio scraper. When the target site changes and extraction breaks, you describe the problem in plain English, Bright Data proposes a fix, and Weaver shows you a **before/after diff** before anything goes live — approve it or reject it, your call.

## Why this exists

Most scraper tutorials stop once the scraper runs once. The real problem is what happens six weeks later when the site redesigns its product page and your scraper starts returning nulls. Bright Data Scraper Studio's AI can diagnose and rewrite the broken extraction logic — Weaver's job is to make that repair something you can actually see and trust, rather than a black box that either "just works" or silently doesn't.

## How it works

```
Read   → paste a URL, Weaver fetches and sanitizes the real page
Select → click directly on the rendered page; name each field you pick
Weave  → your selections become a plain-English description sent to
         `brightdata scraper create` — a real Scraper Studio collector
         comes back
Run    → pull live structured data from the collector, any time
Heal   → describe what broke; Bright Data proposes a fix; you see the
         exact before/after JSON side by side before approving or
         rejecting it
```

Every step above is a real Bright Data Scraper Studio API call (via their CLI, shelled out to server-side — see `src/lib/brightdata.ts`), not a mock. See `examples/` for real captured output from both a normal run and a heal cycle.

## Using Bright Data Scraper Studio

Weaver is a thin, honest layer on top of Scraper Studio's actual primitives — it doesn't reimplement scraping, unblocking, or AI-based repair itself:

- **`brightdata scraper create <url> "<description>"`** — turns the field labels you typed while clicking into the plain-English description Scraper Studio's AI uses to generate a real scraper. Wrapped by `POST /api/scrapers`.
- **`brightdata scraper run <id> <url>`** — pulls fresh structured data from the collector. Wrapped by `POST /api/scrapers/:id/run`.
- **`brightdata scraper heal <id> "<issue>" --url <url>`** — Scraper Studio's own AI diagnoses and proposes a fix; nothing changes yet, it returns a `preview_result` for review. Wrapped by `POST /api/scrapers/:id/heal`.
- **`brightdata scraper approve <id> --auto-save --url <url>`** — commits the healed extraction logic to the live collector (the `--auto-save` flag matters — without it, approval completes the review job but doesn't actually persist the fix, a real bug we found and fixed during testing, see `context/project_state_and_workflows.md`). Wrapped by `POST /api/scrapers/:id/approve`.

The picker itself (`src/lib/renderPage.ts` + `src/app/PagePicker.tsx`) is ours — it fetches and sanitizes the target page (strips scripts, injects a `<base>` tag) and renders it in a sandboxed `<iframe sandbox="allow-same-origin">` so you can click the real layout safely; none of the target's JavaScript ever executes. Candidate detection runs client-side against the real rendered DOM.

## Example output

A real `run` against `books.toscrape.com`:

```json
[
  {
    "book_title": "A Light in the Attic",
    "price": { "value": 51.77, "currency": "GBP", "symbol": "£" },
    "input": { "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html" }
  }
]
```

See `examples/example-output.json` for the raw file, and `examples/example-heal-diff.json` for a full before → heal → approve → after cycle captured from a real test run.

## AI use disclosure

This project was built with Claude Code as a coding agent, in line with the hackathon's AI-use rules. I directed the architecture and decisions throughout (stack choice, the self-healing review UX as the core differentiator, the pivot from a flattened element list to a real sandboxed page preview, the demo target); Claude wrote code, ran real end-to-end tests against the live Bright Data API and the deployed app (not just local/mocked checks), and found and fixed several real bugs this way — including the missing `--auto-save` flag that silently broke the approve flow, and a race condition in the picker's candidate detection. Every claim about what works in `context/project_state_and_workflows.md` was verified by actually running it, not assumed.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in your BRIGHTDATA_API_KEY
npm run dev
```

## Deploying (Render)

Weaver shells out to the Bright Data CLI, and `create`/`heal` calls can take
anywhere from ~70s to several minutes — that ruled out serverless hosts
(function timeouts) in favor of a persistent Node process.

1. Push this repo to GitHub (already done if you're reading this here).
2. On [Render](https://render.com), **New → Blueprint**, point it at this repo — it will pick up `render.yaml` automatically.
3. In the created service's **Environment** tab, set `BRIGHTDATA_API_KEY` (never committed — `render.yaml` intentionally leaves it unset via `sync: false`).
4. Deploy. First request after idle on the free tier takes ~30–60s to wake the container — hit it once before a live demo.

## Context

See the `context/` folder for full project background:
- `context/requirements.md` — hackathon rules, judging criteria, and hard constraints
- `context/project_state_and_workflows.md` — living log of what's built, every bug found and fixed, and every decision made along the way
