# Weaver

A visual, self-healing web scraper built on [Bright Data Scraper Studio](https://brightdata.com/products/web-scraper/custom) for WeMakeDevs' [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) hackathon.

Point Weaver at a page, click what you want scraped, and it becomes a real Scraper Studio scraper — with a review screen that shows exactly what changed when the site breaks the scraper and Bright Data's self-healing engine repairs it.

**Status:** early build, see `context/project_state_and_workflows.md` for current progress.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in your BRIGHTDATA_API_KEY
npm run dev
```

## Deploying (Render)

Weaver shells out to the Bright Data CLI, and `create`/`heal` calls can take
60–70s — that ruled out serverless hosts (function timeouts) in favor of a
persistent Node process.

1. Push this repo to GitHub (already done if you're reading this here).
2. On [Render](https://render.com), **New → Blueprint**, point it at this repo — it will pick up `render.yaml` automatically.
3. In the created service's **Environment** tab, set `BRIGHTDATA_API_KEY` (never committed — `render.yaml` intentionally leaves it unset via `sync: false`).
4. Deploy. First request after idle on the free tier takes ~30–60s to wake the container — hit it once before a live demo.

## Context

See the `context/` folder for full project background:
- `context/requirements.md` — hackathon rules, judging criteria, and hard constraints
- `context/project_state_and_workflows.md` — living log of what's built, in progress, and decided
