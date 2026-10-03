import { JsonView } from "@/components/JsonView";
import { diffValues, marksFor, summarize, type Change } from "@/lib/diff";

function show(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value) ?? "undefined";
}

/**
 * The review screen: the last run next to the proposed fix, with every changed
 * field highlighted. Green is added, red is removed, amber is changed. Nothing
 * here is applied: approving or rejecting happens in the parent.
 */
export function DiffView({ before, after, summary }: { before: unknown | null; after: unknown; summary: string }) {
  const changes: Change[] = before == null ? [] : diffValues(before, after);
  const counts = summarize(changes);
  const none = before != null && changes.length === 0;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-fg">{summary}</p>

      {before != null && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Change summary">
          {none ? (
            <span className="pill">The proposed output matches the last run</span>
          ) : (
            <>
              {counts.added > 0 && <span className="pill !border-mend/40 !text-mend">+{counts.added} added</span>}
              {counts.changed > 0 && <span className="pill !border-thread/40 !text-thread">~{counts.changed} changed</span>}
              {counts.removed > 0 && <span className="pill !border-fray/40 !text-fray">−{counts.removed} removed</span>}
            </>
          )}
        </div>
      )}

      {changes.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line text-sm">
          {changes.map((c) => (
            <li key={c.path} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
              <span
                className={`num w-16 shrink-0 text-xs uppercase ${
                  c.kind === "added" ? "text-mend" : c.kind === "removed" ? "text-fray" : "text-thread"
                }`}
              >
                {c.kind}
              </span>
              <span className="num text-xs text-dim">{c.path}</span>
              <span className="num min-w-0 truncate text-xs">
                {c.kind !== "added" && <span className="text-fray/90 line-through decoration-fray/40">{show(c.before)}</span>}
                {c.kind === "changed" && <span className="text-faint"> → </span>}
                {c.kind !== "removed" && <span className="text-mend">{show(c.after)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-faint">Before (last run)</p>
          {before == null ? (
            <p className="rounded-lg border border-dashed border-line-strong px-3 py-6 text-sm text-faint">
              No earlier run to compare. Run the scraper once first to see a precise diff.
            </p>
          ) : (
            <JsonView value={before} marks={marksFor(changes, "before")} maxHeight="18rem" label="Before" />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-mend">Proposed fix</p>
          <JsonView value={after} marks={before == null ? undefined : marksFor(changes, "after")} maxHeight="18rem" label="Proposed fix" />
        </div>
      </div>
    </div>
  );
}
