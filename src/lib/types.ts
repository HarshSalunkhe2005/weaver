/** Shapes shared by the server and the browser. Captured from real Bright Data CLI output. */

export interface CreateResult {
  collector_id: string;
  name?: string;
  status: string;
  completed_steps?: string[];
  view_url: string;
  created_at?: string;
}

export type RunResult = Record<string, unknown>[];

export interface HealResult {
  collector_id: string;
  status: string;
  completed_steps?: string[];
  prompt?: string;
  view_url: string;
  next_step?: string;
  preview_result: Record<string, unknown>[];
  diff_summary: string;
}

export interface ApproveResult {
  collector_id: string;
  status: string;
  completed_steps?: string[];
  view_url?: string;
  next_step?: string;
}

export type JobKind = "create" | "run" | "heal" | "approve";
export type JobStatus = "running" | "succeeded" | "failed" | "cancelled";

/** What the browser sees when it polls a job. */
export interface JobView<T = unknown> {
  id: string;
  kind: JobKind;
  status: JobStatus;
  startedAt: number;
  elapsedMs: number;
  latest: string;
  steps: string[];
  result?: T;
  error?: string;
}
