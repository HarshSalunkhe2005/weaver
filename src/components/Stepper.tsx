import { Icon } from "@/components/ui";

export type Stage = "read" | "select" | "weave" | "run";

export const STAGES: { key: Stage; label: string; blurb: string }[] = [
  { key: "read", label: "Read", blurb: "Fetch the real page" },
  { key: "select", label: "Select", blurb: "Click what you want" },
  { key: "weave", label: "Weave", blurb: "Bright Data builds the scraper" },
  { key: "run", label: "Run", blurb: "Get structured JSON, heal when it breaks" },
];

/** Four stitched segments: finished steps are filled, the current one is half-threaded. */
export function Stepper({ stage, showBlurbs = false }: { stage: Stage; showBlurbs?: boolean }) {
  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <ol className="grid grid-cols-4 gap-3 sm:gap-5" aria-label="Progress">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} aria-current={active ? "step" : undefined} className="space-y-2">
            <div className="thread-line">
              <i style={{ width: done ? "100%" : active ? "50%" : "0%" }} />
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? "text-fg" : done ? "text-dim" : "text-faint"}`}>
              {done ? <Icon name="check" size={13} className="text-thread" /> : <span className="num text-[0.65rem]">0{i + 1}</span>}
              {s.label}
            </div>
            {showBlurbs && <p className="hidden text-xs leading-5 text-faint sm:block">{s.blurb}</p>}
          </li>
        );
      })}
    </ol>
  );
}
