/**
 * Persists the working session (URL, collector, last run, heal log and any
 * in-flight job ids) to localStorage so a refresh never loses work. Weaver is a
 * single-user tool with no accounts, so the browser is the right place for it.
 *
 * Everything read back is validated: private browsing, disabled storage or a
 * corrupted value degrades to "no saved session" and never throws.
 */
import type { CreateResult, HealResult, JobKind } from "@/lib/types";

const STORAGE_KEY = "weaver:session:v2";
const COLLECTOR_ID = /^c_[a-z0-9]{6,40}$/;

export interface HealLogEntry {
  id: string;
  at: string;
  issue: string;
  outcome: "approved" | "rejected";
  summary: string;
}

export interface StoredSession {
  url: string;
  createResult: Pick<CreateResult, "collector_id" | "status" | "view_url"> | null;
  runResult: unknown | null;
  healLog: HealLogEntry[];
  /** A proposed fix still waiting for approve/reject, plus the issue text that produced it. */
  proposal: HealResult | null;
  issue: string;
  jobs: Partial<Record<JobKind, string>>;
}

export const emptySession = (): StoredSession => ({ url: "", createResult: null, runResult: null, healLog: [], proposal: null, issue: "", jobs: {} });

const isString = (v: unknown): v is string => typeof v === "string";

export function loadSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (typeof p !== "object" || p === null) return null;

    const cr = p.createResult as Record<string, unknown> | null;
    const createResult =
      cr && isString(cr.collector_id) && COLLECTOR_ID.test(cr.collector_id)
        ? { collector_id: cr.collector_id, status: isString(cr.status) ? cr.status : "", view_url: isString(cr.view_url) ? cr.view_url : "" }
        : null;

    const healLog = Array.isArray(p.healLog)
      ? (p.healLog as Record<string, unknown>[])
          .filter((e) => e && isString(e.id) && isString(e.issue) && (e.outcome === "approved" || e.outcome === "rejected"))
          .map((e) => ({
            id: e.id as string,
            at: isString(e.at) ? e.at : "",
            issue: e.issue as string,
            outcome: e.outcome as "approved" | "rejected",
            summary: isString(e.summary) ? e.summary : "",
          }))
      : [];

    const jobs: StoredSession["jobs"] = {};
    const stored = (p.jobs ?? {}) as Record<string, unknown>;
    for (const kind of ["create", "run", "heal", "approve"] as const) {
      if (isString(stored[kind])) jobs[kind] = stored[kind] as string;
    }

    const pr = p.proposal as Record<string, unknown> | null;
    const proposal =
      createResult && pr && Array.isArray(pr.preview_result) && isString(pr.diff_summary) && isString(pr.collector_id)
        ? (pr as unknown as HealResult)
        : null;

    return {
      url: isString(p.url) ? p.url : "",
      proposal,
      issue: createResult && isString(p.issue) ? p.issue : "",
      createResult,
      runResult: createResult ? (p.runResult ?? null) : null,
      healLog: createResult ? healLog : [],
      jobs,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage full or unavailable: the app still works, it just won't survive a refresh
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // non-fatal
  }
}
