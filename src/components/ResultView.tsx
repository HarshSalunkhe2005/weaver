"use client";

import { useMemo, useState } from "react";
import { JsonView } from "@/components/JsonView";
import { CopyButton, Icon } from "@/components/ui";
import { flattenRow } from "@/lib/diff";

const MAX_ROWS = 50;

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export function ResultView({ result, filename }: { result: unknown; filename: string }) {
  const rows = useMemo(() => (Array.isArray(result) ? result : [result]), [result]);
  const table = useMemo(() => {
    const flat = rows.slice(0, MAX_ROWS).map((r) => flattenRow(r));
    const columns = [...new Set(flat.flatMap((r) => Object.keys(r)))];
    return { flat, columns };
  }, [rows]);
  const tabular = rows.every((r) => typeof r === "object" && r !== null && !Array.isArray(r));
  const [view, setView] = useState<"table" | "json">("table");
  const mode = tabular ? view : "json";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-line-strong p-0.5" role="group" aria-label="Result view">
          {(["table", "json"] as const).map((v) => (
            <button
              key={v}
              type="button"
              disabled={v === "table" && !tabular}
              aria-pressed={mode === v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-40 ${
                mode === v ? "bg-panel-3 text-fg" : "text-faint hover:text-fg"
              }`}
            >
              {v === "json" ? "JSON" : "Table"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <CopyButton text={JSON.stringify(result, null, 2)} label="Copy JSON" />
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => download(filename, result)}>
            <Icon name="download" size={14} /> Download
          </button>
        </div>
      </div>

      {mode === "json" ? (
        <JsonView value={result} label="Scraper output" />
      ) : (
        <div className="overflow-auto rounded-lg border border-line" style={{ maxHeight: "22rem" }}>
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-panel-2">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} className="num whitespace-nowrap border-b border-line px-3 py-2 text-xs font-medium text-dim">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.flat.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {table.columns.map((c) => (
                    <td
                      key={c}
                      className={`max-w-[22rem] truncate px-3 py-2 ${row[c] === "" ? "text-fray" : ""}`}
                      title={row[c]}
                    >
                      {row[c] === "" ? "empty" : row[c]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > MAX_ROWS && (
            <p className="border-t border-line px-3 py-2 text-xs text-faint">
              Showing the first {MAX_ROWS} of {rows.length} rows. Download for all of them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
