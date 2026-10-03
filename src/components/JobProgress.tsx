"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import type { JobState } from "@/hooks/useJob";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** The phases Bright Data walks through when building a scraper; matched loosely against its step text. */
const CREATE_PHASES = [
  { label: "Understanding the fields", match: /intent|analy|understand/i },
  { label: "Designing the schema", match: /schema/i },
  { label: "Writing the extractor", match: /code|generat|template/i },
  { label: "Testing on the page", match: /preview|test|verif|run/i },
];

export function JobProgress({
  state,
  title,
  hint,
  phases,
  onCancel,
}: {
  state: JobState<unknown>;
  title: string;
  hint: string;
  phases?: boolean;
  onCancel?: () => void;
}) {
  const running = state.phase === "starting" || state.phase === "running";
  const now = useNow(running);
  if (!running) return null;

  const steps = state.job?.steps ?? [];
  const elapsed = state.clientStart ? now - state.clientStart : 0;
  const reached = phases ? CREATE_PHASES.reduce((max, p, i) => (steps.some((s) => p.match.test(s)) ? i : max), -1) : -1;

  return (
    <div className="rise space-y-3 rounded-lg border border-line bg-panel-2 p-4" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <span className="num text-sm text-thread">{formatElapsed(elapsed)}</span>
      </div>
      <div className="thread-run" />
      {phases && (
        <ol className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {CREATE_PHASES.map((p, i) => (
            <li
              key={p.label}
              aria-current={i === reached ? "step" : undefined}
              className={`flex items-center gap-1.5 ${i < reached ? "text-dim" : i === reached ? "text-fg" : "text-faint"}`}
            >
              {i < reached ? (
                <Icon name="check" size={12} className="text-thread" />
              ) : (
                <span className={`size-1.5 rounded-full ${i === reached ? "bg-thread" : "bg-line-strong"}`} aria-hidden />
              )}
              {p.label}
            </li>
          ))}
        </ol>
      )}
      <p className="num min-h-5 truncate text-xs text-faint" title={state.job?.latest}>
        {state.job?.latest || "Starting…"}
      </p>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-faint">{hint}</p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-quiet btn-sm">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
