"use client";

import { useEffect, useRef, useState } from "react";

const PATHS = {
  copy: "M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2M6 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  download: "M12 4v11m0 0 4-4m-4 4-4-4M5 19h14",
  external: "M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4",
  x: "M6 6l12 12M18 6 6 18",
  play: "M8 5.5v13l10-6.5-10-6.5Z",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  page: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11ZM4 9.5h16",
  key: "M14.5 9.5a4 4 0 1 1-3.2 6.4L8 19.2H5v-3l3.3-3.3A4 4 0 0 1 14.5 9.5ZM15.5 8.5h.01",
  alert: "M12 4 3 19h18L12 4ZM12 10v4M12 16.5h.01",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  github:
    "M12 3a9 9 0 0 0-2.85 17.54c.45.08.62-.2.62-.43v-1.5c-2.5.55-3.03-1.2-3.03-1.2-.41-1.04-1-1.32-1-1.32-.82-.56.06-.55.06-.55.9.06 1.38.93 1.38.93.8 1.38 2.1.98 2.6.75.08-.58.31-.98.57-1.2-2-.23-4.1-1-4.1-4.45 0-.98.35-1.78.93-2.4-.1-.23-.4-1.14.09-2.38 0 0 .76-.24 2.48.92a8.6 8.6 0 0 1 4.5 0c1.72-1.16 2.48-.92 2.48-.92.5 1.24.18 2.15.09 2.38.58.62.93 1.42.93 2.4 0 3.46-2.1 4.22-4.1 4.44.32.28.6.83.6 1.67v2.47c0 .24.16.52.62.43A9 9 0 0 0 12 3Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "github" ? 0 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PATHS[name]} fill={name === "github" ? "currentColor" : "none"} />
    </svg>
  );
}

/** The Weaver mark: two threads crossing. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path
        d="M4 9c5 0 5 7 10 7s5-7 10-7M4 16c5 0 5 7 10 7s5-7 10-7"
        fill="none"
        stroke="var(--thread)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1600);
    } catch {
      // clipboard blocked: nothing useful to do
    }
  }

  return (
    <button type="button" onClick={copy} className="btn btn-quiet btn-sm" aria-live="polite">
      <Icon name={done ? "check" : "copy"} size={14} className={done ? "text-mend" : undefined} />
      {done ? "Copied" : label}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
