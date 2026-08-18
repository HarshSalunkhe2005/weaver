# Weaver — Hackathon Requirements & Context

This file contains the foundational, mostly-fixed requirements gathered for **Weaver**, built solo for WeMakeDevs' **Into the Scrape-Verse** hackathon (sponsored by Bright Data).

## 1. Event Basics
- **Hackathon:** Into the Scrape-Verse — https://www.wemakedevs.org/hackathons/scrape-verse
- **Dates:** August 17–23, 2026 (we're building day-2 onward)
- **Format:** Online, solo entry
- **Total prizes:** $15,000
- **Rules page:** https://www.wemakedevs.org/hackathons/scrape-verse/rules

## 2. Core Goal
Build a **self-healing web scraper** that automatically repairs itself when a website's layout changes, using **Bright Data Scraper Studio** as the required underlying engine — wrapped in a custom visual UI where the user points at a page, clicks what they want scraped, and the app turns that into a Scraper Studio job.

## 3. Hard Requirements (non-negotiable)
- **Scraper Studio is mandatory** — every eligible project must use it to create and run a custom scraper.
- **Cannot rely only on Bright Data's 800+ pre-built scrapers** — must build/configure a genuinely custom one. "Build for the long tail": avoid targets that already have a pre-built scraper (mainstream e-commerce/social). If the obvious question is "why not use the pre-built one?", pick a different target.
- **Public data only** — no login-protected, paywalled, private, or personal information.
- **Coding must start after kickoff (Aug 17)** — pre-hackathon planning/architecture is fine, code is not. (We're clear of this — building from day 2.)
- **AI tool use is allowed but must be disclosed** — must understand and be able to explain all submitted code/technical decisions. Fully AI-generated work with no meaningful participant contribution may be rejected.
- **Terminal-first workflow encouraged**: build via Bright Data CLI + coding agent (Claude Code/Cursor/Codex), use the web dashboard only to check Collector IDs / configure schedules — not as the primary build surface.

## 4. Submission Requirements
Must include all of:
1. Public source code repository (this one)
2. Clear README documentation
3. Example structured output
4. Demo video of the working project
5. Explanation of how Bright Data Scraper Studio was used

No exact deadline time/timezone published — only "Aug 17–23, 2026"; notifications go out via Discord/email to registrants.

## 5. Judging Criteria (6 equally weighted)
1. Potential Impact — clear, useful problem-solving
2. Creativity and Innovation — original approach to web-data collection
3. Technical Excellence — complete, reliable, well-structured implementation
4. Use of Scraper Studio — central platform integration
5. Reliability and Self-Healing — accounts for site changes, missing data, extraction failures
6. Presentation — demo clarity: problem, scraper workflow, structured output, final product

## 6. Prizes / Tracks (all submissions auto-considered for all tracks)
| Track | Prize | Criteria |
|---|---|---|
| Web-Slinger (Grand Prize) | NVIDIA DGX Spark ($5K) or cash | Best Use of Bright Data — scraper design in Studio, coding-agent integration, self-healing response, structured-output application |
| Suit-Up | Apple iPad | Best UI — looks/feels like a finished product |
| Spider-Sense | Keychron Keyboard | Best Clean Code — readable, handles edge cases, newcomer-understandable |
| Daily Bugle | Samsung Galaxy Watch | Best build-progress post on LinkedIn (tag WeMakeDevs) |
| Raffle | Iron Man MK5 Helmet | Random, registration only, no submission needed |

## 7. Bright Data Access
- Sign up, free tier: 5,000 credits/month, no card required
- Promo code `wemakedevs` in Billing → +$50 credits
- $2,500 in credits split among top teams (separate from personal credits)

## 8. Bright Data CLI — command reference (confirmed working set)
```bash
npx -p @brightdata/cli        # or: npm install -g @brightdata/cli
bdata login                    # or: brightdata login

bdata scraper create <URL> "<data you need>"     # AI-generate a scraper
bdata scraper run <COLLECTOR_ID> <URL>           # run it, get structured data
bdata scraper heal <COLLECTOR_ID> "<what broke>" # AI proposes a fix (approval-gated)
bdata scraper approve <COLLECTOR_ID>             # commit the fix
bdata scraper approve <COLLECTOR_ID> --reject    # discard proposed fix
```
- Alias: `bdata` == `brightdata`
- Collector ID (`c_*`) is also triggerable as an HTTP API: `POST /dca/trigger` — this is our hook for scheduling/dashboards.
- Coding-agent integration: `brightdata add mcp --agent claude-code --global`, plus `brightdata skill add <name>` (skills: `search`, `scrape`, `data-feeds`, `bright-data-mcp`, `bright-data-best-practices`).
- Scraper types to understand before picking a target: **PDP, Discovery, Sitemap, Search**.

## 9. Design Aesthetics / Naming
- **Project name:** Weaver (weaving-metaphor: spins structured data out of unstructured pages, re-weaves when a page changes)
- Repo: https://github.com/HarshSalunkhe2005/weaver

## 10. Source docs kept for reference (not duplicated here)
- Official kickoff guide (project ideas, best practices, full prize list) was read in full during planning — see project_state_and_workflows.md "Decisions Made" for what we took from it.
