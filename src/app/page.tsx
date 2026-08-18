"use client";

import { useState } from "react";

interface PageElement {
  id: string;
  tag: string;
  text: string;
}

interface ParsedPage {
  title: string;
  elements: PageElement[];
}

interface CreateResult {
  collector_id: string;
  status: string;
  view_url: string;
}

type Stage = "read" | "select" | "weave" | "run";

const STAGES: { key: Stage; label: string }[] = [
  { key: "read", label: "Read" },
  { key: "select", label: "Select" },
  { key: "weave", label: "Weave" },
  { key: "run", label: "Run" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  const [parsed, setParsed] = useState<ParsedPage | null>(null);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());

  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [runResult, setRunResult] = useState<unknown | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const stage: Stage = createResult
    ? "run"
    : parsed
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
    setParsed(null);
    setSelections(new Map());
    setCreateResult(null);
    setRunResult(null);
    try {
      const res = await fetch("/api/parse-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that page");
      setParsed(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingPage(false);
    }
  }

  function toggleElement(el: PageElement) {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.has(el.id)) {
        next.delete(el.id);
      } else {
        const guess = el.text.split(/\s+/).slice(0, 4).join(" ");
        next.set(el.id, guess);
      }
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="masthead px-6 py-6 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-[0.7rem] tracking-[0.14em] uppercase text-muted">
            Scrape-Verse — self-healing scrapers
          </p>
          <h1 className="font-display mt-1 text-3xl italic tracking-tight sm:text-4xl">
            Weaver
          </h1>
          <div className="masthead-rule mt-3 mb-3" />
          <p className="max-w-xl text-[0.95rem] text-muted">
            Point it at a page, choose what to pull, and it becomes a real
            Bright Data Scraper Studio scraper — reviewable, not a black box,
            every time it has to heal itself.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 sm:px-10 space-y-6">
        <div className="stepper" aria-label="Progress">
          {STAGES.map((s, i) => (
            <div
              key={s.key}
              className="stepper-cell"
              data-active={i === stageIndex}
              data-done={i < stageIndex}
            >
              <span className="stepper-index">0{i + 1}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Stage: Read */}
        <section className="workbench-card space-y-3">
          <h2 className="font-display text-lg">Read a page</h2>
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
        {parsed && (
          <section className="workbench-card space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg">Choose what to extract</h2>
              <span className="text-muted truncate text-xs">{parsed.title}</span>
            </div>
            <p className="text-muted text-sm">
              Click a row to select it, then name the field — this becomes the
              schema Scraper Studio builds against.
            </p>

            <div
              className="max-h-96 overflow-y-auto rounded-lg"
              style={{ border: "1px solid var(--border)" }}
            >
              {parsed.elements.map((el) => {
                const selected = selections.has(el.id);
                return (
                  <div
                    key={el.id}
                    className="element-row"
                    data-selected={selected}
                    onClick={() => toggleElement(el)}
                  >
                    <span className="tag-pill">{el.tag}</span>
                    <span className="flex-1 truncate text-sm">{el.text}</span>
                    {selected && (
                      <input
                        type="text"
                        value={selections.get(el.id) || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateLabel(el.id, e.target.value)}
                        placeholder="field name"
                        className="field-input w-36 shrink-0 text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted text-xs">
                {selections.size} field{selections.size === 1 ? "" : "s"} in the weave
              </span>
              <button
                onClick={handleCreateScraper}
                disabled={selections.size === 0 || creating}
                className="btn-primary"
              >
                {creating ? "Weaving the scraper…" : "Create scraper"}
              </button>
            </div>
            {createError && <p className="text-fray text-sm">{createError}</p>}
            {creating && (
              <p className="text-muted text-xs">
                Bright Data is generating and previewing the scraper — this
                usually takes under a minute.
              </p>
            )}
          </section>
        )}

        {/* Stage: Run */}
        {createResult && (
          <section className="result-panel space-y-3">
            <h2 className="font-display text-lg">Scraper is live</h2>
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
      </main>
    </div>
  );
}
