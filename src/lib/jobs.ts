/**
 * In-memory job runner for the slow Bright Data calls.
 *
 * `create` and `heal` can take anywhere from about a minute to several minutes.
 * Holding one HTTP request open that long gets cut by the hosting proxy at
 * roughly 5 minutes (found by testing against production), so the API starts a
 * job, returns its id straight away, and the browser polls for the outcome.
 *
 * Jobs live in memory. Weaver runs as a single persistent Node process, and a
 * restart simply loses the in-flight job; the client reports that clearly.
 */
import { randomUUID } from "node:crypto";
import { CancelledError, type RunContext } from "@/lib/brightdata";
import type { JobKind, JobStatus, JobView } from "@/lib/types";

export class BusyError extends Error {}

interface Job {
  id: string;
  kind: JobKind;
  owner: string;
  status: JobStatus;
  startedAt: number;
  finishedAt?: number;
  steps: string[];
  result?: unknown;
  error?: string;
  controller: AbortController;
}

const LIMITS = { perOwnerActive: 2, globalActive: 4, keepMs: 30 * 60 * 1000, maxStored: 200, maxSteps: 60 };

const g = globalThis as unknown as { __weaverJobs?: Map<string, Job> };
const jobs = (g.__weaverJobs ??= new Map());

function sweep(now = Date.now()) {
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > LIMITS.keepMs) jobs.delete(id);
  }
  if (jobs.size > LIMITS.maxStored) {
    const oldestFirst = [...jobs.values()].filter((j) => j.finishedAt).sort((a, b) => a.finishedAt! - b.finishedAt!);
    for (const j of oldestFirst.slice(0, jobs.size - LIMITS.maxStored)) jobs.delete(j.id);
  }
}

export function activeJobs(owner?: string): number {
  let n = 0;
  for (const job of jobs.values()) {
    if (job.status === "running" && (!owner || job.owner === owner)) n++;
  }
  return n;
}

export function startJob(kind: JobKind, owner: string, run: (ctx: RunContext) => Promise<unknown>): JobView {
  sweep();
  if (activeJobs(owner) >= LIMITS.perOwnerActive) {
    throw new BusyError("You already have jobs running. Wait for one to finish first.");
  }
  if (activeJobs() >= LIMITS.globalActive) {
    throw new BusyError("Weaver is busy with other jobs right now. Try again in a minute.");
  }

  const job: Job = {
    id: randomUUID(),
    kind,
    owner,
    status: "running",
    startedAt: Date.now(),
    steps: [],
    controller: new AbortController(),
  };
  jobs.set(job.id, job);

  const onProgress = (line: string) => {
    if (job.steps[job.steps.length - 1] === line) return;
    job.steps.push(line);
    if (job.steps.length > LIMITS.maxSteps) job.steps.shift();
  };

  Promise.resolve()
    .then(() => run({ onProgress, signal: job.controller.signal }))
    .then(
      (result) => {
        job.status = "succeeded";
        job.result = result;
      },
      (err: unknown) => {
        if (err instanceof CancelledError || job.controller.signal.aborted) {
          job.status = "cancelled";
          job.error = "Cancelled.";
        } else {
          job.status = "failed";
          job.error = err instanceof Error ? err.message : "Something went wrong.";
        }
      },
    )
    .finally(() => {
      job.finishedAt = Date.now();
    });

  return toView(job);
}

function toView(job: Job): JobView {
  const end = job.finishedAt ?? Date.now();
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    startedAt: job.startedAt,
    elapsedMs: end - job.startedAt,
    latest: job.steps[job.steps.length - 1] ?? "",
    steps: job.steps.slice(-12),
    ...(job.status === "succeeded" ? { result: job.result } : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}

export function getJob(id: string, owner?: string): JobView | undefined {
  sweep();
  const job = jobs.get(id);
  if (!job || (owner && job.owner !== owner)) return undefined;
  return toView(job);
}

export function cancelJob(id: string, owner?: string): boolean {
  const job = jobs.get(id);
  if (!job || (owner && job.owner !== owner) || job.status !== "running") return false;
  job.controller.abort();
  return true;
}

/** Test helper. */
export function clearJobs() {
  for (const job of jobs.values()) job.controller.abort();
  jobs.clear();
}
