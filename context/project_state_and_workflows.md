# Weaver — Project State & Workflows

## Overview
Weaver is a visual front-end for Bright Data Scraper Studio: the user pastes a URL, sees a simplified/restructured view of the page's content, clicks the elements they want scraped, and Weaver turns that into a real Scraper Studio scraper (via the Bright Data CLI/API). When the target site's structure changes and extraction breaks, Weaver surfaces the self-healing repair as a reviewable diff (old vs. new selector/extraction) instead of a silent black-box fix, and lets the user approve/reject it.

**Status:** Day 2 of the hackathon. Repo just scaffolded. No code written yet.

## Technology Stack
- **TBD** — not yet decided. Needs a decision on:
  - Frontend framework for the picker UI + healing-review dashboard
  - Backend/glue language to shell out to the Bright Data CLI (or call its API directly)
  - Where run history / healing-activity log gets persisted (DB vs. flat files for hackathon scope)
  - Deployment target for the demo (if any) vs. purely local/CLI demo

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
- Nothing yet — repo scaffolded with `context/requirements.md` and this file only.

## What Is Remaining (everything)
1. Pick the actual demo target site(s) — must be public data, and ideally something without an existing Bright Data pre-built scraper ("long tail" requirement). Not yet chosen.
2. Set up Bright Data CLI locally/in this environment: `bdata login`, confirm credits, confirm `bdata scraper create/run/heal/approve` work end to end against a real URL before building UI around it.
3. Decide the stack (see Technology Stack above) and scaffold the app.
4. Build the structural-picker UI (step 2–4 of the flow).
5. Build the Scraper Studio glue layer (step 4–5).
6. Build breakage-detection logic (step 6) — ours to design, not Bright Data's.
7. Build the heal-trigger + review/approve UI (step 7–8) — this is the project's centerpiece for judging.
8. Build the healing activity log (step 9).
9. Write the README, capture example structured output, record the demo video, write the Scraper Studio usage explanation — all required submission materials.
10. Post build-progress on LinkedIn (tag WeMakeDevs) for the Daily Bugle track — separate from the core build, don't forget it.

## Decisions Made So Far
- **Name:** Weaver.
- **Solo entry**, not a team.
- **Core differentiator:** making the self-healing repair reviewable/explainable via UI (approve/reject a diff), rather than a black-box "it just works" toggle — chosen because it hits Suit-Up (UI) and Reliability/Self-Healing judging criteria simultaneously, and because the official kickoff guide's own "bonus" suggestion ("automate the whole heal loop") implies most entrants will stop at full automation without a review layer.
- **Terminal/CLI-first build**, not dashboard-first — matches the grand-prize criterion on coding-agent integration and the official "keep the terminal as your UI" best practice.
- Registration, Bright Data account signup, and starring the sponsor repo are already done (prerequisite steps, not project deliverables).

## Open Questions / Not Yet Decided
- Exact target site(s) for the demo.
- Stack choice.
- Whether breakage-detection + auto-heal-trigger runs as a scheduled job, a manual "check now" button, or both, for hackathon scope.
- Whether to persist run history in a real DB or keep it file-based given the short timeline.
