"use client";

import { JobProgress } from "@/components/JobProgress";
import { ResultView } from "@/components/ResultView";
import { CopyButton, Icon, Spinner } from "@/components/ui";
import type { JobState } from "@/hooks/useJob";
import { safeHttpsUrl } from "@/lib/client";
import type { RunResult } from "@/lib/types";

export function ScraperPanel({
  scraper,
  run,
  result,
  breakage,
  onRun,
  onCancelRun,
  onSuggestHeal,
}: {
  scraper: { collector_id: string; status: string; view_url: string };
  run: JobState<RunResult>;
  result: unknown | null;
  breakage: string | null;
  onRun: () => void;
  onCancelRun: () => void;
  onSuggestHeal: (issue: string) => void;
}) {
  const running = run.phase === "starting" || run.phase === "running";
  const studio = safeHttpsUrl(scraper.view_url);

  return (
    <section className="panel rise space-y-5 p-5" aria-labelledby="scraper-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-mend" aria-hidden />
            <h2 id="scraper-title" className="text-base font-semibold">
              Your scraper is live
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            <span className="flex items-center gap-2">
              <span className="text-faint">Collector</span>
              <code className="num rounded bg-ink px-1.5 py-0.5 text-xs">{scraper.collector_id}</code>
            </span>
            {scraper.status && (
              <span className="flex items-center gap-2">
                <span className="text-faint">Status</span>
                <span className="pill !border-mend/40 !text-mend">{scraper.status}</span>
              </span>
            )}
            {studio && (
              <a
                href={studio}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-thread underline-offset-4 hover:underline"
              >
                Open in Bright Data <Icon name="external" size={13} />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={scraper.collector_id} label="Copy id" />
          <button type="button" className="btn btn-primary" onClick={onRun} disabled={running}>
            {running ? (
              <>
                <Spinner /> Running…
              </>
            ) : (
              <>
                <Icon name="play" size={14} /> Run scraper
              </>
            )}
          </button>
        </div>
      </div>

      <JobProgress
        state={run}
        title="Running your scraper"
        hint="Fresh data is usually back within a minute."
        onCancel={onCancelRun}
      />

      {run.phase === "failed" && run.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-fray">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {run.error}
        </p>
      )}

      {breakage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fray/40 bg-fray-soft px-4 py-3"
        >
          <p className="flex items-start gap-2 text-sm text-fray">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {breakage}
          </p>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => onSuggestHeal(breakage)}>
            Describe it in the heal box
          </button>
        </div>
      )}

      {result != null ? (
        <ResultView result={result} filename={`weaver-${scraper.collector_id}.json`} />
      ) : (
        !running && (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-sm text-faint">
            No output yet. Run the scraper to pull structured data from the page.
          </p>
        )
      )}
    </section>
  );
}
