# Getting Started Guide For The Bright Data Hackathon

The Scrape-Verse Hackathon runs until August 23rd with $15,000 in prizes. Here's how to build a self-healing scraper with Bright Data's Scraper Studio, plus project ideas to steal.

Published: August 17, 2026
Author: Sachin Sharma
Tags: hackathon, technical
Source: https://www.wemakedevs.org/blogs/scrape-verse-kick-off

---

## Introduction

The web is constantly changing, and that makes building reliable web scrapers much harder to extract data from a page. A scraper can work perfectly when you first build it, but a website redesign, a renamed CSS class, or a small change in the page structure can leave your pipeline returning incomplete or empty results.

That's the problem we want you to solve in The Scrape-Verse Hackathon, which went live today and runs until August 23rd. [WeMakeDevs](https://www.wemakedevs.org/hackathons/scrape-verse) and [Bright Data](https://brightdata.com) are inviting developers, builders, and AI engineers to enter the Scrape-Verse and build web scrapers that don't just collect data, but can also adapt, recover, and keep working when the web changes.

## Why self-healing scrapers?

Websites constantly change as product pages are redesigned, documentation moves, and content structures evolve, which can easily break scrapers that rely on specific selectors even when the underlying data remains valuable.

Whether you're tracking prices, monitoring competitors, building a RAG knowledge base, or researching developer trends, the real challenge isn't just collecting data, but **keeping the collection pipeline running reliably**.

That's where self-healing comes in: instead of treating scraper maintenance as a future problem, build reliability into the scraper from day one.

## Bright Data Scraper Studio

Bright Data's Scraper Studio is an AI-powered platform for turning web data requirements into ready-to-run scrapers. Instead of building and maintaining every scraper from scratch, developers can describe what data they need, generate scraper code with AI, test it in a hosted IDE, and run it at scale.

The platform handles much of the infrastructure that makes web scraping difficult, including proxies, browser rendering, CAPTCHA solving, retries, unblocking, scheduling, and data delivery.

## Steps to build a custom scraper for any website

Using **Bright Data Scraper Studio and its CLI**, you can simplify building a web scraper from scratch. You can describe the data you want, let AI generate the scraper, run it directly from your terminal, and even self-heal it when the target website changes.

In this guide, we'll walk through the complete process of building a custom scraper: from creating your first scraper to running it and fixing it when it breaks. You can follow these steps using your regular terminal or coding agents like **Claude Code, Cursor, Codex, or VS Code**.

### Let's get started:

### Step 1. Bright Data CLI
```
npx -p @brightdata/cli
```
Run the Bright Data CLI without installing it globally. No global installs and no dashboard hopping.

### Step 2. Log in
```
bdata login
```
Connect your terminal to your Bright Data account.

### Step 3. Create the scraper
```
bdata scraper create <URL> "<data you need>"
```
Generate a scraper using AI from a URL and a simple description.

### Step 4. Run the scraper
```
bdata scraper run <COLLECTOR_ID> <URL>
```
Run the scraper and get structured data.

### Step 5. Heal the scraper
```
bdata scraper heal <COLLECTOR_ID> "<what broke>"
```
Generate a fix when the website changes.

### Step 6. Approve or reject the fix
```
bdata scraper approve <COLLECTOR_ID>
```
Approve the fix and update the existing scraper.

To discard the proposed fix and try a sharper prompt instead, reject it:
```
bdata scraper approve c_mpohus372o5tmid1jk --reject
```

## What can you build?

The theme is open-ended so participants can build anything that uses Scraper Studio to turn websites into structured data.

Here are some project ideas, feel free to pick any one of these if you are out of ideas:

### 1. One-prompt scraper
Paste one prompt into your coding agent, point it at a site, and get clean JSON back with a `bdata scraper create` + `bdata scraper run` flow.

Then build something small on top: a CLI tool, a Discord bot, a simple dashboard. Perfect if this is your first scraper.

**Scraper type**: PDP or Discovery

### 2. Prompt-to-production pipeline
Have your agent build the scraper AND the pipeline that feeds it: a script that triggers the Collector ID via `POST /dca/trigger`, saves the JSON to S3 or a database, and runs on a schedule. One prompt, one PR, fresh data every night.

**Scraper type**: Discovery + PDP

### 3. Set-a-goal-and-walk-away automation
Give your agent a goal like "scrape this site every day at 3am and save results to storage" and let it plan, build, schedule, and verify the whole thing. Show off what agentic engineering can do end to end.

**Scraper type**: Discovery + PDP

### 4. Self-healing scraper (the hero project)
Every scraping tutorial ends when the scraper runs. Make yours start when it breaks. Build a scraper, break it (or catch a real site change), then run `bdata scraper heal` with a description of what broke, approve the fix, and re-run. Same Collector ID, no downstream code touched. Bonus: automate the whole heal loop.

**Scraper type**: any

### 5. Scrapers in CI, no humans
Put `bdata scraper run` inside GitHub Actions on a cron. When the target site changes, have `claude -p` run `bdata scraper heal` automatically and re-run the job. The dream: a scraper that fixes itself while you sleep, with a wall of green checks to prove it.

**Scraper type**: any

### 6. Docs site → RAG pipeline
Point a Sitemap scraper at any docs site and get every page as structured JSON. Chunk it, embed it, and build a "chat with these docs" app that answers questions with real citations. One prompt from docs site to queryable knowledge base.

**Scraper type**: Sitemap

### 7. Competitive intel pipeline
Scrape 3 to 5 competitor changelogs or release-notes pages weekly, diff the results against last week, and deliver the changes to your inbox, Slack, or Discord every Monday. A tool you'd genuinely keep using after the hackathon.

**Scraper type**: Sitemap

### 8. Keyword-powered agent (no URLs needed)
Use the Search scraper type: your agent gets data from just a keyword and optional country, no URL required. Build an AI agent that researches products, prices, jobs, or listings on demand from a plain-English request.

**Scraper type**: Search

### 9. Parallel subagents battle
Spin up 3 subagents in 3 git worktrees, each building a scraper for a different site, then have a fourth agent judge the outputs and ship the winner. The flex project for multi-agent orchestration fans.

**Scraper type**: any

## Best practices

1. **Build for the long tail** — Bright Data already has 800+ pre-built scrapers for popular sites. Pick a target that doesn't already have one, like regional e-commerce, B2B catalogs, niche sites, documentation, or competitor changelogs. If the obvious question is "Why not use a pre-built scraper?", choose a different target.
2. **Keep the terminal as your UI** — Build from your coding agent, Claude Code, Cursor, or Codex. Use the dashboard only to check your Collector ID or configure a schedule.
3. **Show self-healing in action** — The key differentiator is owning the scraper code while AI can repair it when a website changes. Use `bdata scraper heal` in your demo to show the scraper recovering without breaking your workflow.
4. **Scrape public data only** — Stick to publicly available pages. No login-walled sites, paywalled content, or personal data. Never expose API tokens or `.env` files in your repo or demo.
5. **Use the Collector ID as an API** — Every scraper gets a `c_*` Collector ID that you can trigger via `POST /dca/trigger`. Connect it to something real, such as a cron job, database, agent, or dashboard, to show how your scraper fits into a larger workflow.

## The prizes

We're putting **$15,000 in prizes** on the line, including an NVIDIA DGX Spark, Apple iPads, Keychron keyboards, Samsung Galaxy Watch, Bright Data credits, swag, and more.

### 1. 🏆 Grand Prize - Web-Slinger Track
**NVIDIA DGX Spark - $5,000 value**: Awarded for the Best Use of Bright Data.

The judges will look at how effectively you use the platform — from the scraper you build in Scraper Studio, to how you drive it from your coding agent, how it handles website changes, and what you ultimately build with the structured output.

### 2. 🦸 Suit-Up Track
**Apple iPad - for every member of the winning team**: Awarded for Best UI.

Data is only useful when people can actually understand and interact with it. This track is for the project that looks and feels like a finished product.

### 3. 🕷️ Spider-Sense Track
**Keychron Keyboard - for every member of the winning team**: Awarded for Best Clean Code.

Readable, structured, reliable code that handles edge cases and makes it easy for someone else to understand and contribute to the project.

### 4. 🎟️ The Raffle
One lucky registration will win an **Iron Man MK5 Helmet - Black Edition**, complete with voice control.

You don't need to win a track, submit a project, or write a single line of code to enter. Just register for the hackathon.

### 5. Daily Bugle Track
**Samsung Galaxy Watch**: Awarded for Best LinkedIn Post.

Post about what you're building, an experiment that worked, or the story of your hackathon week, and tag WeMakeDevs. LinkedIn only: posts anywhere else don't count.

### 6. Bright Data Credits
There are also **$2,500 in Bright Data credits** being distributed across the top teams.

Every Participant gets **$50 in Bright Data credits**. All you need to do is create a Bright Data account and claim the free tier: 5,000 credits/month, no card required. Use promo code `wemakedevs` in Billing to get an extra $50 in credits.

---

## Notes on how this changes/confirms our plan

- Confirms the exact CLI command set already researched (`scraper create` / `run` / `heal` / `approve`, alias `bdata`), plus the reject flow: `bdata scraper approve <id> --reject`.
- **`POST /dca/trigger`** — the Collector ID (`c_*`) can be triggered as an HTTP API, not just via CLI. This is the hook for wiring a scraper into a scheduled pipeline, dashboard, or webhook-driven flow.
- **"Build for the long tail"** — avoid targets that already have one of Bright Data's 800+ pre-built scrapers (mainstream e-commerce/social sites). Pick something niche the judges can tell isn't already solved.
- **Daily Bugle Track** — Samsung Galaxy Watch for best LinkedIn post about build progress, LinkedIn-only, must tag WeMakeDevs.
- Confirms "keep the terminal as your UI" — dashboard is only for checking Collector ID / schedule, reinforcing that our actual build should be CLI/agent-driven, matching the grand-prize criterion about driving Scraper Studio from a coding agent.
- Scraper types referenced: **PDP, Discovery, Sitemap, Search** — worth understanding each type's shape before picking one for our project.
