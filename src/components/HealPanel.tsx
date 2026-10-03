"use client";

import { DiffView } from "@/components/DiffView";
import { JobProgress } from "@/components/JobProgress";
import { Icon, Spinner } from "@/components/ui";
import type { JobState } from "@/hooks/useJob";
import type { HealLogEntry } from "@/lib/session";
import type { ApproveResult, HealResult } from "@/lib/types";

export function HealPanel({
  issue,
  onIssue,
  hasRun,
  lastRun,
  proposal,
  heal,
  approve,
  log,
  onHeal,
  onCancelHeal,
  onDecide,
  onDiscard,
}: {
  issue: string;
  onIssue: (v: string) => void;
  hasRun: boolean;
  lastRun: unknown | null;
  proposal: HealResult | null;
  heal: JobState<HealResult>;
  approve: JobState<ApproveResult>;
  log: HealLogEntry[];
  onHeal: () => void;
  onCancelHeal: () => void;
  onDecide: (approved: boolean) => void;
  onDiscard: () => void;
}) {
  const healing = heal.phase === "starting" || heal.phase === "running";
  const deciding = approve.phase === "starting" || approve.phase === "running";
  const error = (heal.phase === "failed" && heal.error) || (approve.phase === "failed" && approve.error) || null;

  return (
    <section className="panel rise space-y-5 p-5" aria-labelledby="heal-title">
      <div>
        <h2 id="heal-title" className="text-base font-semibold">
          Heal it when it breaks
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-6 text-dim">
          When a site changes and a field starts coming back empty, say what went wrong. Bright Data proposes a fix, and
          you see exactly what would change before anything goes live.
        </p>
      </div>

      {!proposal && !deciding && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            onHeal();
          }}
        >
          <label className="flex-1">
            <span className="sr-only">What broke</span>
            <input
              className="input"
              required
              maxLength={500}
              value={issue}
              onChange={(e) => onIssue(e.target.value)}
              placeholder="e.g. price is coming back empty"
              disabled={healing}
            />
          </label>
          <button type="submit" className="btn btn-quiet" disabled={healing || !issue.trim()}>
            {healing ? (
              <>
                <Spinner /> Diagnosing…
              </>
            ) : (
              "Propose a fix"
            )}
          </button>
        </form>
      )}
      {!hasRun && !proposal && <p className="-mt-2 text-xs text-faint">Tip: run the scraper once first, so the review can show a precise before and after.</p>}

      <JobProgress
        state={heal}
        title="Bright Data is diagnosing the problem"
        hint="This usually takes one to three minutes. You can leave this tab open."
        onCancel={onCancelHeal}
      />
      <JobProgress state={approve} title="Applying your decision" hint="Saving to the live scraper." />

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-fray">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {proposal && !deciding && (
        <div className="rise space-y-4 rounded-xl border border-thread/30 bg-panel-2 p-4">
          <div className="flex items-center gap-2">
            <span className="pill !border-thread/40 !text-thread">Awaiting your review</span>
            <span className="text-xs text-faint">Nothing has changed on the live scraper yet.</span>
          </div>
          <DiffView before={lastRun} after={proposal.preview_result} summary={proposal.diff_summary} />
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button type="button" className="btn btn-primary" onClick={() => onDecide(true)}>
              <Icon name="check" size={15} /> Approve fix
            </button>
            <button type="button" className="btn btn-danger" onClick={() => onDecide(false)}>
              Reject
            </button>
            <button type="button" className="ml-auto text-xs text-faint hover:text-fg" onClick={onDiscard}>
              Decide later
            </button>
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-faint">Healing activity</h3>
          <ul className="space-y-2">
            {log.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${e.outcome === "approved" ? "bg-mend" : "bg-fray"}`} aria-hidden />
                <div className="min-w-0">
                  <p>
                    <span className={e.outcome === "approved" ? "text-mend" : "text-fray"}>
                      {e.outcome === "approved" ? "Approved" : "Rejected"}
                    </span>
                    <span className="text-dim"> · {e.issue}</span>
                  </p>
                  <p className="num text-xs text-faint">
                    {e.at}
                    {e.summary ? ` · ${e.summary}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
