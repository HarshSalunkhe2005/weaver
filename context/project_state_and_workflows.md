# Weaver — Project State & Workflows

## Overview
Weaver is a visual front-end for Bright Data Scraper Studio: the user pastes a URL, sees a simplified/restructured view of the page's content, clicks the elements they want scraped, and Weaver turns that into a real Scraper Studio scraper (via the Bright Data CLI/API). When the target site's structure changes and extraction breaks, Weaver surfaces the self-healing repair as a reviewable diff (old vs. new selector/extraction) instead of a silent black-box fix, and lets the user approve/reject it.

**Status:** Day 2 of the hackathon. Repo just scaffolded. No code written yet.

## Technology Stack
- **Next.js (TypeScript), App Router, single full-stack web app.** Frontend (picker UI + healing-review dashboard) and backend (API routes shelling out to the Bright Data CLI) live in one codebase — chosen for solo-build speed and easy demo deployment.
- Still open:
  - Where run history / healing-activity log gets persisted (DB vs. flat files for hackathon scope)
  - Deployment target for the demo

## Core Product Flow (target design)
1. User pastes a target URL into Weaver's UI.
2. Backend fetches/parses the page, sends a simplified structural tree to the frontend (headings, tables, lists, text blocks as clickable regions) — not a pixel-perfect clone.
3. User clicks the elements they want (e.g. title, price, rating).
4. Weaver turns the selection into a plain-English field description and calls `bdata scraper create <URL> "<description>"`, storing the returned Collector ID.
5. Weaver runs the scraper (`bdata scraper run`) on demand or on a schedule (via the Collector ID's `POST /dca/trigger` API), storing structured output.
6. Weaver watches run output for signs of breakage (nulls, missing fields, schema drift vs. prior runs) — this detection logic is ours, not Bright Data's.
7. On detected breakage, Weaver auto-triggers `bdata scraper heal <id> "<what broke>"`.
8. **"Review the fix" screen** (the UI differentiator): shows the heal command's before/after extraction side by side, lets the user Approve (`bdata scraper approve`) or Reject (`bdata scraper approve --reject`).
9. A running **healing activity log** per scraper: timestamped history of what broke, what was healed, and who approved it.

## What Is Done
- Repo scaffolded with `context/requirements.md` and this file.
- Stack decided: Next.js (TS) full-stack.
- **Bright Data CLI verified end-to-end** (2026-08-18): `@brightdata/cli` installed, `BRIGHTDATA_API_KEY` auth confirmed (`brightdata budget` → $50 balance). Ran a real smoke test against `books.toscrape.com` (a scraping sandbox site, not our actual demo target):
  - `brightdata scraper create <url> "book title, price, and star rating"` → generated collector `c_msz54jq6b3lqmud8k` in ~70 polling steps (intent analysis → schema generation → code generation → preview).
  - `brightdata scraper run c_msz54jq6b3lqmud8k <url> --json` → returned clean structured JSON: `{"book_title": "A Light in the Attic", "price": {"value": 51.77, "currency": "GBP", "symbol": "£"}, "star_rating": "Three"}`.
  - **`heal`/`approve` also verified** (2026-08-18, after app scaffold): `brightdata scraper heal c_msz54jq6b3lqmud8k "star_rating sometimes returns null, please make it more robust" --url <url>` → returned `status: "awaiting_approval"` with `preview_result` (the proposed new extraction) and `diff_summary` — heal does **not** auto-commit, it's approval-gated by design. `brightdata scraper approve c_msz54jq6b3lqmud8k --url <url>` → `status: "done"`, healed version now live under the same collector ID. Full lifecycle (`create → run → heal → approve`) confirmed working against a real site before any UI was built around it.
  - **API key handling:** key lives only in `.env.local` (gitignored, confirmed not tracked by git) — never committed. `.env.local.example` (tracked) documents the required variable with no value.
- **Next.js app scaffolded** (2026-08-18): `create-next-app` with TypeScript, Tailwind, ESLint, App Router, `src/` dir, `@/*` import alias. Builds clean (`npm run build` succeeds, picks up `.env.local` automatically). Still just the default starter page — no product UI yet.
- **Scraper Studio glue layer built and smoke-tested** (2026-08-18):
  - `src/lib/brightdata.ts` — server-only wrapper shelling out to the `brightdata` CLI via `execFile` (never spawns a shell, never touches the API key client-side). Parses the CLI's final JSON line out of its stdout (it prints human-readable "Step: ... polling ..." progress lines first). Exports `createScraper`, `runScraper`, `healScraper`, `approveHeal` — typed against the *real* output shapes captured from the CLI tests above, not guessed from docs.
  - API routes, all in `src/app/api/scrapers/`:
    - `POST /api/scrapers` → create (`{url, description}`)
    - `POST /api/scrapers/[id]/run` → run (`{url}`)
    - `POST /api/scrapers/[id]/heal` → heal (`{issue, url}`)
    - `POST /api/scrapers/[id]/approve` → approve/reject (`{url, reject?}`)
  - `npm run build` registers all 4 routes correctly (confirmed in build output). Live smoke test: `curl -X POST localhost:3000/api/scrapers/c_msz54jq6b3lqmud8k/run` against the real collector returned correct structured JSON through Weaver's own API, not the raw CLI — confirms the whole chain (Next.js route → lib wrapper → CLI → Bright Data → back) works before any frontend exists.

## What Is Remaining
1. Pick the actual demo target site(s) — must be public data, and ideally something without an existing Bright Data pre-built scraper ("long tail" requirement). Not yet chosen. (Product itself stays general-purpose/any-URL regardless — this is only about what we demo/submit.)
2. Build the structural-picker UI (step 2–4 of the flow) — replace the default starter page. This is the next task.
3. Wire the picker UI to the now-working `/api/scrapers` create endpoint.
4. Build breakage-detection logic (step 6) — ours to design, not Bright Data's.
5. Build the heal-trigger + review/approve UI (step 7–8) — this is the project's centerpiece for judging. Backend (`/api/scrapers/[id]/heal` + `/approve`) is already built and verified; just needs a UI on top.
6. Build the healing activity log (step 9).
7. Write the README properly, capture example structured output, record the demo video, write the Scraper Studio usage explanation — all required submission materials.
8. Post build-progress on LinkedIn (tag WeMakeDevs) for the Daily Bugle track — separate from the core build, don't forget it.

## Decisions Made So Far
- **Name:** Weaver.
- **Stack:** Next.js (TypeScript), App Router, single full-stack web app (not mobile, not a separate frontend/backend split).
- **Solo entry**, not a team.
- **Core differentiator:** making the self-healing repair reviewable/explainable via UI (approve/reject a diff), rather than a black-box "it just works" toggle — chosen because it hits Suit-Up (UI) and Reliability/Self-Healing judging criteria simultaneously, and because the official kickoff guide's own "bonus" suggestion ("automate the whole heal loop") implies most entrants will stop at full automation without a review layer.
- **Terminal/CLI-first build**, not dashboard-first — matches the grand-prize criterion on coding-agent integration and the official "keep the terminal as your UI" best practice.
- Registration, Bright Data account signup, and starring the sponsor repo are already done (prerequisite steps, not project deliverables).

## Open Questions / Not Yet Decided
- Exact target site(s) for the demo.
- Whether breakage-detection + auto-heal-trigger runs as a scheduled job, a manual "check now" button, or both, for hackathon scope.
- Whether to persist run history in a real DB or keep it file-based given the short timeline.
