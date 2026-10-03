import type { ReactNode } from "react";
import type { Mark } from "@/lib/diff";

interface Line {
  indent: number;
  path: string;
  node: ReactNode;
}

const s = (cls: string, text: string) => <span className={cls}>{text}</span>;

function primitive(value: unknown): ReactNode {
  if (typeof value === "string") return s("j-str", JSON.stringify(value));
  if (typeof value === "number") return s("j-num", String(value));
  return s("j-lit", String(value));
}

/** Flattens a JSON value into highlighted lines, each tagged with its dotted path for diff marks. */
function build(value: unknown, path: string, indent: number, key: string | null, trailing: boolean, out: Line[]) {
  const comma = trailing ? s("j-punct", ",") : null;
  const label = key === null ? null : (
    <>
      {s("j-key", JSON.stringify(key))}
      {s("j-punct", ": ")}
    </>
  );

  if (typeof value === "object" && value !== null) {
    const isArray = Array.isArray(value);
    const entries = isArray ? (value as unknown[]).map((v, i) => [String(i), v] as const) : Object.entries(value);
    const [open, close] = isArray ? ["[", "]"] : ["{", "}"];
    if (entries.length === 0) {
      out.push({ indent, path, node: <>{label}{s("j-punct", open + close)}{comma}</> });
      return;
    }
    out.push({ indent, path, node: <>{label}{s("j-punct", open)}</> });
    entries.forEach(([k, v], i) => {
      build(v, path ? `${path}.${k}` : k, indent + 1, isArray ? null : k, i < entries.length - 1, out);
    });
    out.push({ indent, path, node: <>{s("j-punct", close)}{comma}</> });
    return;
  }
  out.push({ indent, path, node: <>{label}{primitive(value)}{comma}</> });
}

/**
 * Syntax-highlighted JSON. `marks` maps dotted paths to a diff state; a marked
 * object or array highlights every line inside it.
 */
export function JsonView({
  value,
  marks,
  maxHeight = "22rem",
  label,
}: {
  value: unknown;
  marks?: Record<string, Mark>;
  maxHeight?: string;
  label?: string;
}) {
  const lines: Line[] = [];
  build(value, "", 0, null, false, lines);

  const markFor = (path: string): Mark | undefined => {
    if (!marks) return undefined;
    let p = path;
    for (;;) {
      if (marks[p]) return marks[p];
      const dot = p.lastIndexOf(".");
      if (dot === -1) return p !== "" && marks[""] ? marks[""] : undefined;
      p = p.slice(0, dot);
    }
  };

  return (
    <pre
      className="num overflow-auto rounded-lg border border-line bg-ink py-3 text-[0.78rem] leading-6"
      style={{ maxHeight }}
      tabIndex={0}
      aria-label={label ?? "JSON"}
    >
      <code>
        {lines.map((l, i) => (
          <span key={i} className="json-line" data-mark={markFor(l.path)} style={{ paddingLeft: `${0.75 + l.indent * 1.1}rem` }}>
            {l.node}
          </span>
        ))}
      </code>
    </pre>
  );
}
