"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { FieldsPanel, type Field } from "@/components/FieldsPanel";
import { HealPanel } from "@/components/HealPanel";
import { Hero, UrlForm } from "@/components/Hero";
import { JobProgress } from "@/components/JobProgress";
import { PagePicker, type Candidate } from "@/components/PagePicker";
import { ScraperPanel } from "@/components/ScraperPanel";
import { Stepper, type Stage } from "@/components/Stepper";
import { TopBar, type Health } from "@/components/TopBar";
import { Icon } from "@/components/ui";
import { useJob } from "@/hooks/useJob";
import { api, errorMessage } from "@/lib/client";
import { detectBreakage } from "@/lib/detectBreakage";
import { MAX_DESCRIPTION, buildDescription, guessLabel } from "@/lib/labels";
import { clearSession, loadSession, saveSession, type HealLogEntry, type StoredSession } from "@/lib/session";
import type { ApproveResult, CreateResult, HealResult, JobKind, RunResult } from "@/lib/types";

interface RenderedPage {
  title: string;
  html: string;
  url: string;
  size: number;
}
type PageState = { status: "idle" | "loading" | "ready" | "error"; data?: RenderedPage; error?: string };

export function Workbench() {
  const [url, setUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [page, setPage] = useState<PageState>({ status: "idle" });
  const [fields, setFields] = useState<Field[]>([]);
  const [scraper, setScraper] = useState<StoredSession["createResult"]>(null);
  const [runResult, setRunResult] = useState<unknown | null>(null);
  const [issue, setIssue] = useState("");
  const [proposal, setProposal] = useState<HealResult | null>(null);
  const [log, setLog] = useState<HealLogEntry[]>([]);
  const [jobs, setJobs] = useState<StoredSession["jobs"]>({});
  const [health, setHealth] = useState<Health | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const pageRequest = useRef<AbortController | null>(null);
  const pendingTarget = useRef("");
  const decision = useRef<boolean | null>(null);

  const track = (kind: JobKind) => (id: string) => setJobs((j) => ({ ...j, [kind]: id }));
  const untrack = (kind: JobKind) => () =>
    setJobs((j) => {
      const next = { ...j };
      delete next[kind];
      return next;
    });

  const create = useJob<CreateResult>({
    onStarted: track("create"),
    onSettled: untrack("create"),
    onSuccess: (r) => {
      setScraper({ collector_id: r.collector_id, status: r.status, view_url: r.view_url });
      setTargetUrl(pendingTarget.current || url);
      // A new scraper starts with a clean history: nothing from the previous collector applies.
      setRunResult(null);
      setProposal(null);
      setIssue("");
      setLog([]);
    },
  });
  const run = useJob<RunResult>({ onStarted: track("run"), onSettled: untrack("run"), onSuccess: (r) => setRunResult(r) });
  const heal = useJob<HealResult>({ onStarted: track("heal"), onSettled: untrack("heal"), onSuccess: (r) => setProposal(r) });
  const approve = useJob<ApproveResult>({
    onStarted: track("approve"),
    onSettled: untrack("approve"),
    onSuccess: () => {
      const approved = decision.current;
      if (approved === null) return; // resumed after a refresh: the outcome is already on the live scraper
      decision.current = null;
      setLog((prev) =>
        [
          {
            id: `${scraper?.collector_id ?? "c"}-${Date.now()}`,
            at: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
            issue,
            outcome: approved ? ("approved" as const) : ("rejected" as const),
            summary: proposal?.diff_summary ?? "",
          },
          ...prev,
        ].slice(0, 50),
      );
      setProposal(null);
      setIssue("");
      // Once approved, the fix is live under the same collector: re-run so the output shows it.
      if (approved && scraper) void run.start(`/api/scrapers/${scraper.collector_id}/run`, { url: targetUrl });
    },
  });

  // Restore the last session and re-attach to any job that was still running.
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from a browser-only store */
      setUrl(saved.url);
      setTargetUrl(saved.url);
      setScraper(saved.createResult);
      setRunResult(saved.runResult);
      setLog(saved.healLog);
      setProposal(saved.proposal);
      setIssue(saved.issue);
      setJobs(saved.jobs);
      /* eslint-enable react-hooks/set-state-in-effect */
      if (saved.jobs.create) create.resume(saved.jobs.create);
      if (saved.jobs.run) run.resume(saved.jobs.run);
      if (saved.jobs.heal) heal.resume(saved.jobs.heal);
      if (saved.jobs.approve) approve.resume(saved.jobs.approve);
    }
    setHydrated(true);
    api<Health>("/api/health").then(setHealth, () => setHealth(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSession({ url: scraper ? targetUrl || url : "", createResult: scraper, runResult, healLog: log, proposal, issue, jobs });
  }, [hydrated, url, targetUrl, scraper, runResult, log, proposal, issue, jobs]);

  const breakage = useMemo(() => detectBreakage(runResult), [runResult]);
  const selectedIds = useMemo(() => new Set(fields.map((f) => f.id)), [fields]);
  const description = useMemo(() => buildDescription(fields.map((f) => f.label)), [fields]);

  const stage: Stage = scraper ? "run" : create.busy ? "weave" : page.data ? "select" : "read";

  async function readPage(target = url) {
    const trimmed = target.trim();
    if (!trimmed) return;
    pageRequest.current?.abort();
    const controller = new AbortController();
    pageRequest.current = controller;
    setPage({ status: "loading" });
    setFields([]);
    create.reset();
    try {
      const data = await api<RenderedPage>("/api/render-page", { method: "POST", body: { url: trimmed }, signal: controller.signal });
      setUrl(data.url);
      setPage({ status: "ready", data });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPage({ status: "error", error: errorMessage(err) });
    }
  }

  function toggle(candidate: Candidate) {
    setFields((prev) =>
      prev.some((f) => f.id === candidate.id)
        ? prev.filter((f) => f.id !== candidate.id)
        : [...prev, { ...candidate, label: guessLabel(candidate.tag, candidate.text) }],
    );
  }

  function startCreate() {
    if (!page.data || create.busy || !description || description.length > MAX_DESCRIPTION) return;
    pendingTarget.current = page.data.url;
    void create.start("/api/scrapers", { url: page.data.url, description });
  }

  function startRun() {
    if (!scraper || run.busy) return;
    void run.start(`/api/scrapers/${scraper.collector_id}/run`, { url: targetUrl });
  }

  function startHeal() {
    if (!scraper || heal.busy || !issue.trim()) return;
    void heal.start(`/api/scrapers/${scraper.collector_id}/heal`, { url: targetUrl, issue });
  }

  function decide(approved: boolean) {
    if (!scraper || approve.busy) return;
    decision.current = approved;
    void approve.start(`/api/scrapers/${scraper.collector_id}/approve`, { url: targetUrl, reject: !approved });
  }

  function startOver() {
    for (const j of [create, run, heal, approve]) {
      if (j.busy) void j.cancel();
      j.reset();
    }
    pageRequest.current?.abort();
    clearSession();
    setUrl("");
    setTargetUrl("");
    setPage({ status: "idle" });
    setFields([]);
    setScraper(null);
    setRunResult(null);
    setIssue("");
    setProposal(null);
    setLog([]);
    setJobs({});
  }

  const hasWork = Boolean(page.data || scraper);

  return (
    <>
      <AccessGate required={health?.accessRequired ?? false} />
      <TopBar health={health} onReset={hasWork ? startOver : undefined} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20 sm:px-8">
        {!hasWork ? (
          <>
            <Hero
              url={url}
              onUrl={setUrl}
              onSubmit={() => void readPage()}
              loading={page.status === "loading"}
              error={page.status === "error" ? (page.error ?? null) : null}
              onExample={(u) => {
                setUrl(u);
                void readPage(u);
              }}
            />
            <div className="mx-auto max-w-3xl pt-6">
              <Stepper stage="read" showBlurbs />
            </div>
          </>
        ) : (
          <div className="space-y-8 pt-8">
            <div className="space-y-5">
              <UrlForm url={url} onUrl={setUrl} onSubmit={() => void readPage()} loading={page.status === "loading"} />
              {page.status === "error" && (
                <p role="alert" className="flex items-start gap-2 text-sm text-fray">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {page.error}
                </p>
              )}
              <Stepper stage={stage} />
            </div>

            {page.status === "loading" && (
              <div className="space-y-3" aria-hidden>
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-96 w-full" />
              </div>
            )}

            {page.data && page.status !== "loading" && (
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
                <PagePicker
                  key={`${page.data.url}:${page.data.size}`}
                  html={page.data.html}
                  url={page.data.url}
                  title={page.data.title}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                />
                <FieldsPanel
                  fields={fields}
                  description={description}
                  creating={create.busy}
                  onLabel={(id, label) => setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)))}
                  onRemove={(id) => setFields((prev) => prev.filter((f) => f.id !== id))}
                  onClear={() => setFields([])}
                  onCreate={startCreate}
                />
              </div>
            )}

            <JobProgress
              state={create.state}
              title="Bright Data is weaving your scraper"
              hint="Building one usually takes one to three minutes. You can leave this tab open."
              phases
              onCancel={() => void create.cancel()}
            />
            {(create.state.phase === "failed" || create.state.phase === "cancelled") && create.state.error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-fray">
                <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {create.state.error}
              </p>
            )}

            {scraper && (
              <>
                <ScraperPanel
                  scraper={scraper}
                  run={run.state}
                  result={runResult}
                  breakage={breakage}
                  onRun={startRun}
                  onCancelRun={() => void run.cancel()}
                  onSuggestHeal={setIssue}
                />
                <HealPanel
                  issue={issue}
                  onIssue={setIssue}
                  hasRun={runResult != null}
                  lastRun={runResult}
                  proposal={proposal}
                  heal={heal.state}
                  approve={approve.state}
                  log={log}
                  onHeal={startHeal}
                  onCancelHeal={() => void heal.cancel()}
                  onDecide={decide}
                  onDiscard={() => setProposal(null)}
                />
              </>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-faint sm:px-8">
          <span>Weaver builds on Bright Data Scraper Studio. It never runs a page&apos;s own scripts.</span>
          <a
            href="https://github.com/HarshSalunkhe2005/weaver"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:text-fg hover:underline"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
