"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { PagePicker } from "./PagePicker";

/**
 * Reveals `text` with a one-shot typewriter animation. Measures the text's
 * own natural pixel width after mount (via scrollWidth, which reports full
 * un-clipped content size even while overflow:hidden + width:0 are applied)
 * and animates to exactly that width — animating to a CSS `100%` instead
 * would race to the *container's* width and clip long strings mid-sentence.
 */
function Typewriter({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [measured, setMeasured] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tw-final-width", `${el.scrollWidth}px`);
    setMeasured(true);
  }, [text]);

  return (
    <p ref={ref} className={`typewriter ${className ?? ""}`} data-measured={measured}>
      {text}
    </p>
  );
}

interface RenderedPage {
  title: string;
  html: string;
}

interface CreateResult {
  collector_id: string;
  status: string;
  view_url: string;
}

interface HealResult {
  collector_id: string;
  status: string;
  prompt: string;
  view_url: string;
  preview_result: unknown;
  diff_summary: string;
}

interface HealLogEntry {
  id: string;
  timestamp: string;
  issue: string;
  outcome: "approved" | "rejected";
  diffSummary: string;
}

type Stage = "read" | "select" | "weave" | "run";

const STAGES: { key: Stage; label: string }[] = [
  { key: "read", label: "Read" },
  { key: "select", label: "Select" },
  { key: "weave", label: "Weave" },
  { key: "run", label: "Run" },
];

const TAGLINE = "Click what matters. Weaver builds the scraper.";
const SUBTITLE =
  "A real Bright Data Scraper Studio scraper, reviewable every time it has to heal itself.";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  const [renderedPage, setRenderedPage] = useState<RenderedPage | null>(null);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [selectionTags, setSelectionTags] = useState<Map<string, string>>(new Map());

  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [runResult, setRunResult] = useState<unknown | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [healIssue, setHealIssue] = useState("");
  const [healing, setHealing] = useState(false);
  const [healResult, setHealResult] = useState<HealResult | null>(null);
  const [healError, setHealError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [healLog, setHealLog] = useState<HealLogEntry[]>([]);

  const stage: Stage = createResult
    ? "run"
    : renderedPage
      ? "weave"
      : url
        ? "select"
        : "read";
  const stageOrder = STAGES.map((s) => s.key);
  const stageIndex = stageOrder.indexOf(stage);

  async function handleLoadPage(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setLoadingPage(true);
    setLoadError(null);
    setRenderedPage(null);
    setSelections(new Map());
    setSelectionTags(new Map());
    setCreateResult(null);
    setRunResult(null);
    try {
      const res = await fetch("/api/render-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that page");
      setRenderedPage(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingPage(false);
    }
  }

  function handlePickerToggle(id: string, guessLabel: string, tag: string) {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, guessLabel);
      }
      return next;
    });
    setSelectionTags((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, tag);
      }
      return next;
    });
  }

  function removeSelection(id: string) {
    setSelections((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setSelectionTags((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function updateLabel(id: string, label: string) {
    setSelections((prev) => new Map(prev).set(id, label));
  }

  async function handleCreateScraper() {
    if (!url || selections.size === 0) return;
    setCreating(true);
    setCreateError(null);
    setCreateResult(null);
    setRunResult(null);
    try {
      const description = Array.from(selections.values()).filter(Boolean).join(", ");
      const res = await fetch("/api/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create the scraper");
      setCreateResult(data);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  async function handleRunScraper() {
    if (!createResult) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const res = await fetch(`/api/scrapers/${createResult.collector_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't run the scraper");
      setRunResult(data);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  async function handleStartHeal(e: React.FormEvent) {
    e.preventDefault();
    if (!createResult || !healIssue) return;
    setHealing(true);
    setHealError(null);
    setHealResult(null);
    try {
      const res = await fetch(`/api/scrapers/${createResult.collector_id}/heal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue: healIssue, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start healing");
      setHealResult(data);
    } catch (err) {
      setHealError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setHealing(false);
    }
  }

  async function handleResolveHeal(reject: boolean) {
    if (!createResult || !healResult) return;
    setResolving(true);
    setHealError(null);
    try {
      const res = await fetch(`/api/scrapers/${createResult.collector_id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, reject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't resolve the fix");

      setHealLog((prev) => [
        {
          id: `${createResult.collector_id}-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          issue: healIssue,
          outcome: reject ? "rejected" : "approved",
          diffSummary: healResult.diff_summary,
        },
        ...prev,
      ]);
      setHealResult(null);
      setHealIssue("");

      // On approval the healed version is now live under the same collector
      // ID — re-run immediately so the "Scraper is live" panel reflects the
      // fix, rather than leaving stale pre-heal data on screen.
      if (!reject) {
        await handleRunScraper();
      }
    } catch (err) {
      setHealError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="masthead px-6 py-6 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-[0.68rem] tracking-[0.14em] uppercase text-muted">
            Scrape-Verse — self-healing scrapers
          </p>
          <h1 className="wordmark mt-1 text-3xl sm:text-4xl">Weaver</h1>
          <div className="masthead-rule mt-3 mb-3" />
          <Typewriter text={TAGLINE} className="text-[0.95rem]" />
          <p className="text-muted mt-1 max-w-xl text-[0.95rem]">{SUBTITLE}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 sm:px-10 space-y-8">
        <nav className="stepper" aria-label="Progress">
          {STAGES.map((s, i) => (
            <div
              key={s.key}
              className="stepper-cell"
              data-active={i === stageIndex}
              data-done={i < stageIndex}
            >
              <span className="stepper-label">
                <span className="stepper-index">0{i + 1}</span>
                {s.label}
              </span>
              <span className="stepper-rule" />
            </div>
          ))}
        </nav>

        {/* Stage: Read */}
        <section className="workbench-card space-y-3">
          <h2 className="text-base font-semibold">Read a page</h2>
          <form onSubmit={handleLoadPage} className="flex gap-2">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/product/123"
              className="field-input font-mono flex-1 text-sm"
            />
            <button type="submit" disabled={loadingPage} className="btn-primary">
              {loadingPage ? "Reading…" : "Read page"}
            </button>
          </form>
          {loadError && <p className="text-fray text-sm">{loadError}</p>}
        </section>

        {/* Stage: Select */}
        {renderedPage && (
          <section className="workbench-card space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold">Choose what to extract</h2>
              <span className="text-muted truncate text-xs">{renderedPage.title}</span>
            </div>
            <p className="text-muted text-sm">
              This is the real page — click directly on what you want. We
              don&apos;t execute its scripts (safety), so pages that render
              via client-side JavaScript may look incomplete here.
            </p>

            <PagePicker
              html={renderedPage.html}
              selections={selections}
              onToggle={handlePickerToggle}
            />

            {selections.size > 0 && (
              <div
                className="max-h-56 overflow-y-auto rounded-lg"
                style={{ border: "1px solid var(--border)" }}
              >
                {Array.from(selections.entries()).map(([id, label]) => (
                  <div key={id} className="element-row" data-selected="true">
                    <span className="tag-pill">{selectionTags.get(id)}</span>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => updateLabel(id, e.target.value)}
                      placeholder="field name"
                      className="field-input flex-1 text-xs"
                    />
                    <button
                      onClick={() => removeSelection(id)}
                      className="text-muted hover:text-fray shrink-0 text-xs"
                      aria-label="Remove field"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted text-xs">
                {selections.size} field{selections.size === 1 ? "" : "s"} in the weave
              </span>
              <button
                onClick={handleCreateScraper}
                disabled={selections.size === 0 || creating}
                className="btn-primary"
              >
                {creating ? "Weaving…" : "Create scraper"}
              </button>
            </div>
            {createError && <p className="text-fray text-sm">{createError}</p>}
            {creating && (
              <div className="space-y-1.5">
                <div className="weaving-progress" />
                <p className="text-muted text-xs">
                  Bright Data is generating and previewing the scraper —
                  usually under a minute.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Stage: Run */}
        {createResult && (
          <section className="result-panel space-y-3">
            <h2 className="text-mend text-base font-semibold">Scraper is live</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Collector</dt>
              <dd className="font-mono">{createResult.collector_id}</dd>
              <dt className="text-muted">Status</dt>
              <dd>{createResult.status}</dd>
              <dt className="text-muted">Studio</dt>
              <dd>
                <a
                  href={createResult.view_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-mend underline underline-offset-2"
                >
                  Open in Bright Data
                </a>
              </dd>
            </dl>

            <button onClick={handleRunScraper} disabled={running} className="btn-secondary">
              {running ? "Running…" : "Run scraper now"}
            </button>
            {runError && <p className="text-fray text-sm">{runError}</p>}
            {runResult != null && (
              <pre className="json-block font-mono">
                {JSON.stringify(runResult, null, 2)}
              </pre>
            )}
          </section>
        )}

        {/* Heal: report an issue, review the diff, approve or reject */}
        {createResult && (
          <section className="workbench-card space-y-3">
            <h2 className="text-base font-semibold">Heal it when it breaks</h2>
            <p className="text-muted text-sm">
              If the site changes and extraction starts failing, describe
              what broke — Bright Data proposes a fix you review before
              anything goes live.
            </p>

            {!healResult && (
              <form onSubmit={handleStartHeal} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={healIssue}
                  onChange={(e) => setHealIssue(e.target.value)}
                  placeholder="e.g. price is returning null"
                  className="field-input flex-1 text-sm"
                />
                <button type="submit" disabled={healing} className="btn-secondary">
                  {healing ? "Diagnosing…" : "Heal scraper"}
                </button>
              </form>
            )}
            {healing && (
              <div className="space-y-1.5">
                <div className="weaving-progress" />
                <p className="text-muted text-xs">
                  Bright Data is diagnosing and previewing a fix.
                </p>
              </div>
            )}
            {healError && <p className="text-fray text-sm">{healError}</p>}

            {healResult && (
              <div className="space-y-3">
                <p className="text-sm">{healResult.diff_summary}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-muted text-xs">Before (last run)</p>
                    <pre className="json-block font-mono">
                      {runResult != null
                        ? JSON.stringify(runResult, null, 2)
                        : "— no prior run to compare —"}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <p className="text-mend text-xs">Proposed fix</p>
                    <pre className="json-block font-mono">
                      {JSON.stringify(healResult.preview_result, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolveHeal(false)}
                    disabled={resolving}
                    className="btn-primary"
                  >
                    {resolving ? "Applying…" : "Approve fix"}
                  </button>
                  <button
                    onClick={() => handleResolveHeal(true)}
                    disabled={resolving}
                    className="btn-secondary"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {healLog.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-muted text-xs">Healing activity</p>
                <ul className="space-y-1.5">
                  {healLog.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-2 text-xs">
                      <span
                        className={entry.outcome === "approved" ? "text-mend" : "text-fray"}
                      >
                        {entry.outcome === "approved" ? "✓ approved" : "✕ rejected"}
                      </span>
                      <span className="font-mono text-muted">{entry.timestamp}</span>
                      <span className="text-muted">— {entry.issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
