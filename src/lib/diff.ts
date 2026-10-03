/** Structural diff between two JSON values, used by the "review the fix" screen. */

export type Mark = "added" | "removed" | "changed";

export interface Change {
  path: string;
  kind: Mark;
  before?: unknown;
  after?: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => k in b && deepEqual(a[k], b[k]));
}

export function diffValues(before: unknown, after: unknown, path = ""): Change[] {
  if (deepEqual(before, after)) return [];
  if (isObject(before) && isObject(after) && Array.isArray(before) === Array.isArray(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    const out: Change[] = [];
    for (const key of keys) {
      const p = path ? `${path}.${key}` : key;
      const inBefore = key in before;
      const inAfter = key in after;
      if (inBefore && !inAfter) out.push({ path: p, kind: "removed", before: before[key] });
      else if (!inBefore && inAfter) out.push({ path: p, kind: "added", after: after[key] });
      else out.push(...diffValues(before[key], after[key], p));
    }
    return out;
  }
  return [{ path, kind: "changed", before, after }];
}

/** Which paths to highlight on each side of a side-by-side view. */
export function marksFor(changes: Change[], side: "before" | "after"): Record<string, Mark> {
  const marks: Record<string, Mark> = {};
  for (const c of changes) {
    if (side === "before" && c.kind !== "added") marks[c.path] = c.kind;
    if (side === "after" && c.kind !== "removed") marks[c.path] = c.kind;
  }
  return marks;
}

export function summarize(changes: Change[]) {
  return {
    added: changes.filter((c) => c.kind === "added").length,
    removed: changes.filter((c) => c.kind === "removed").length,
    changed: changes.filter((c) => c.kind === "changed").length,
  };
}

/** Flattens a row into column -> display string for the results table. */
export function flattenRow(value: unknown, prefix = "", depth = 0, out: Record<string, string> = {}): Record<string, string> {
  if (isObject(value) && !Array.isArray(value) && depth < 3) {
    for (const [k, v] of Object.entries(value)) flattenRow(v, prefix ? `${prefix}.${k}` : k, depth + 1, out);
    return out;
  }
  const key = prefix || "value";
  if (value === null || value === undefined) out[key] = "";
  else if (typeof value === "string") out[key] = value;
  else if (typeof value === "number" || typeof value === "boolean") out[key] = String(value);
  else out[key] = JSON.stringify(value);
  return out;
}
