/**
 * Persists the current scraper session (which URL, which collector, its
 * last run, and the healing activity log) to localStorage, so a refresh
 * doesn't lose your work. This is a single-user demo tool, not a
 * multi-tenant backend — localStorage is the honest choice here, not a
 * corner cut. A real product would need a real per-user store; Weaver
 * doesn't have users to separate.
 *
 * Every read/write is wrapped defensively: private browsing, disabled
 * storage, or a corrupted value should degrade to "no saved session",
 * never throw and break the app.
 */

const STORAGE_KEY = "weaver:session";

export interface StoredSession {
  url: string;
  createResult: { collector_id: string; status: string; view_url: string } | null;
  runResult: unknown | null;
  healLog: {
    id: string;
    timestamp: string;
    issue: string;
    outcome: "approved" | "rejected";
    diffSummary: string;
  }[];
}

export function loadSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage full, disabled, or unavailable (private browsing) — the app
    // still works, it just won't survive a refresh this time.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as above — non-fatal either way.
  }
}
