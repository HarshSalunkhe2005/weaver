"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, errorMessage } from "@/lib/client";
import type { JobView } from "@/lib/types";

export type JobPhase = "idle" | "starting" | "running" | "succeeded" | "failed" | "cancelled";

export interface JobState<T> {
  phase: JobPhase;
  job?: JobView<T>;
  error?: string;
  /** Client clock time the job started (server elapsed time subtracted), for the live timer. */
  clientStart?: number;
}

export interface JobHandlers<T> {
  onStarted?: (jobId: string) => void;
  onSuccess?: (result: T) => void;
  onFailure?: (message: string, cancelled: boolean) => void;
  onSettled?: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Starts a background job (POST) and polls it until it finishes. Slow Bright
 * Data calls run for minutes, longer than a hosting proxy keeps one request
 * open, so the browser polls instead of waiting on a single request. The job id
 * can be handed to `resume` after a refresh.
 */
export function useJob<T>(handlers: JobHandlers<T> = {}) {
  const [state, setState] = useState<JobState<T>>({ phase: "idle" });
  const run = useRef(0); // bumping this abandons any polling loop still in flight
  const jobId = useRef<string | null>(null);
  const cb = useRef(handlers);
  useEffect(() => {
    cb.current = handlers;
  });

  const poll = useCallback(async (id: string, mine: number) => {
    let delay = 700;
    let failures = 0;
    for (;;) {
      await sleep(delay);
      if (run.current !== mine) return;
      try {
        const job = await api<JobView<T>>(`/api/jobs/${id}`);
        if (run.current !== mine) return;
        failures = 0;
        delay = Math.min(Math.round(delay * 1.3), 2500);
        if (job.status === "running") {
          setState({ phase: "running", job, clientStart: Date.now() - job.elapsedMs });
          continue;
        }
        jobId.current = null;
        if (job.status === "succeeded") {
          setState({ phase: "succeeded", job });
          cb.current.onSuccess?.(job.result as T);
        } else {
          const cancelled = job.status === "cancelled";
          const message = job.error ?? (cancelled ? "Cancelled." : "The job failed.");
          setState({ phase: cancelled ? "cancelled" : "failed", job, error: message });
          cb.current.onFailure?.(message, cancelled);
        }
        cb.current.onSettled?.();
        return;
      } catch (err) {
        if (run.current !== mine) return;
        const gone = err instanceof ApiError && err.code === "job_gone";
        const fatal = err instanceof ApiError && err.status >= 400 && err.status < 500 && err.code !== "rate_limited";
        if (gone || fatal) {
          jobId.current = null;
          setState({ phase: "failed", error: errorMessage(err) });
          cb.current.onFailure?.(errorMessage(err), false);
          cb.current.onSettled?.();
          return;
        }
        failures += 1;
        if (failures >= 6) {
          jobId.current = null;
          const message = "Lost contact with the server while the job was running. It may still finish: refresh in a minute.";
          setState({ phase: "failed", error: message });
          cb.current.onFailure?.(message, false);
          cb.current.onSettled?.();
          return;
        }
        delay = 2500;
      }
    }
  }, []);

  const start = useCallback(
    async (path: string, body: unknown) => {
      const mine = ++run.current;
      setState({ phase: "starting" });
      try {
        const res = await api<{ jobId: string; job: JobView<T> }>(path, { method: "POST", body });
        if (run.current !== mine) return;
        jobId.current = res.jobId;
        setState({ phase: "running", job: res.job, clientStart: Date.now() });
        cb.current.onStarted?.(res.jobId);
        void poll(res.jobId, mine);
      } catch (err) {
        if (run.current !== mine) return;
        setState({ phase: "failed", error: errorMessage(err) });
        cb.current.onFailure?.(errorMessage(err), false);
        cb.current.onSettled?.();
      }
    },
    [poll],
  );

  const resume = useCallback(
    (id: string) => {
      const mine = ++run.current;
      jobId.current = id;
      setState({ phase: "running", clientStart: Date.now() });
      void poll(id, mine);
    },
    [poll],
  );

  const cancel = useCallback(async () => {
    const id = jobId.current;
    if (!id) return;
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" });
    } catch {
      // the next poll reports whatever really happened
    }
  }, []);

  const reset = useCallback(() => {
    run.current += 1;
    jobId.current = null;
    setState({ phase: "idle" });
  }, []);

  useEffect(
    () => () => {
      run.current += 1; // stop polling when the component unmounts
    },
    [],
  );

  return { state, start, resume, cancel, reset, busy: state.phase === "starting" || state.phase === "running" };
}
