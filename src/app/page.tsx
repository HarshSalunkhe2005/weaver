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

type Step = "input" | "picking" | "creating" | "created";

export default function Home() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  const [parsed, setParsed] = useState<ParsedPage | null>(null);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());

  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [runResult, setRunResult] = useState<unknown | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  async function handleLoadPage(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setLoadingPage(true);
    setLoadError(null);
    setParsed(null);
    setSelections(new Map());
    try {
      const res = await fetch("/api/parse-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load page");
      setParsed(data);
      setStep("picking");
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
        // Default label: shorten the element's own text as a starting guess.
        const guess = el.text.split(/\s+/).slice(0, 4).join(" ");
        next.set(el.id, guess);
      }
      return next;
    });
  }

  function updateLabel(id: string, label: string) {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(id, label);
      return next;
    });
  }

  function buildDescription(): string {
    const labels = Array.from(selections.values()).filter(Boolean);
    return labels.join(", ");
  }

  async function handleCreateScraper() {
    if (!url || selections.size === 0) return;
    setStep("creating");
    setCreateError(null);
    setCreateResult(null);
    setRunResult(null);
    try {
      const description = buildDescription();
      const res = await fetch("/api/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create scraper");
      setCreateResult(data);
      setStep("created");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unknown error");
      setStep("picking");
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
      if (!res.ok) throw new Error(data.error || "Failed to run scraper");
      setRunResult(data);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">🕸️ Weaver</h1>
        <p className="text-sm text-neutral-400">
          Paste a URL, click what you want scraped, get a real Scraper Studio scraper.
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-8">
        {/* Step 1: URL input */}
        <form onSubmit={handleLoadPage} className="space-y-2">
          <label className="block text-sm font-medium text-neutral-300">
            Target URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/product/123"
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              disabled={loadingPage}
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
            >
              {loadingPage ? "Loading…" : "Load page"}
            </button>
          </div>
          {loadError && <p className="text-sm text-red-400">{loadError}</p>}
        </form>

        {/* Step 2: pick elements */}
        {parsed && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-neutral-300">
                Click what you want scraped
              </h2>
              <span className="text-xs text-neutral-500">{parsed.title}</span>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-md border border-neutral-800 divide-y divide-neutral-800">
              {parsed.elements.map((el) => {
                const selected = selections.has(el.id);
                return (
                  <div
                    key={el.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${
                      selected ? "bg-neutral-800" : "hover:bg-neutral-900"
                    }`}
                    onClick={() => toggleElement(el)}
                  >
                    <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                      {el.tag}
                    </span>
                    <span className="flex-1 truncate text-neutral-200">
                      {el.text}
                    </span>
                    {selected && (
                      <input
                        type="text"
                        value={selections.get(el.id) || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateLabel(el.id, e.target.value)}
                        placeholder="field label"
                        className="w-40 shrink-0 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                {selections.size} field{selections.size === 1 ? "" : "s"} selected
              </span>
              <button
                onClick={handleCreateScraper}
                disabled={selections.size === 0 || step === "creating"}
                className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {step === "creating"
                  ? "Creating scraper (this takes ~1 min)…"
                  : "Create scraper"}
              </button>
            </div>
            {createError && <p className="text-sm text-red-400">{createError}</p>}
          </section>
        )}

        {/* Step 3: created */}
        {createResult && (
          <section className="space-y-3 rounded-md border border-emerald-900 bg-emerald-950/40 p-4">
            <h2 className="text-sm font-medium text-emerald-300">Scraper created</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-300">
              <dt className="text-neutral-500">Collector ID</dt>
              <dd className="font-mono">{createResult.collector_id}</dd>
              <dt className="text-neutral-500">Status</dt>
              <dd>{createResult.status}</dd>
              <dt className="text-neutral-500">Studio</dt>
              <dd>
                <a
                  href={createResult.view_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  {createResult.view_url}
                </a>
              </dd>
            </dl>

            <button
              onClick={handleRunScraper}
              disabled={running}
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
            >
              {running ? "Running…" : "Run scraper now"}
            </button>
            {runError && <p className="text-sm text-red-400">{runError}</p>}
            {runResult != null && (
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-neutral-950 p-3 text-xs text-neutral-300">
                {JSON.stringify(runResult, null, 2)}
              </pre>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
