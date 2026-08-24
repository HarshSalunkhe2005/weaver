/**
 * Weaver's own breakage-detection logic — this is deliberately NOT part of
 * Bright Data's self-healing engine. It just looks at a `run` result and
 * flags the two shapes we've actually seen a broken/degraded extraction
 * take in testing:
 *   - an `error` field in the payload (seen for real: a transient
 *     "account is currently suspended" response came back as HTTP 200
 *     with an `error` key, not as a failed request)
 *   - a field that came back null/undefined/empty-string, which is the
 *     classic "selector moved" symptom
 *
 * Intentionally conservative: only looks at the first result item, only
 * flags top-level keys. Good enough to prompt a human to look, which is
 * the actual goal — Weaver never auto-triggers a heal on its own.
 */
export function detectBreakage(result: unknown): string | null {
  if (!Array.isArray(result) || result.length === 0) return null;
  const first = result[0];
  if (typeof first !== "object" || first === null) return null;

  const record = first as Record<string, unknown>;

  if ("error" in record) {
    return `Response includes an error field: ${JSON.stringify(record.error)}`;
  }

  const emptyKeys = Object.entries(record)
    .filter(([key, value]) => key !== "input" && (value === null || value === undefined || value === ""))
    .map(([key]) => key);

  if (emptyKeys.length > 0) {
    return `These fields came back empty: ${emptyKeys.join(", ")}`;
  }

  return null;
}
