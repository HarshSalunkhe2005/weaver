"use client";

import { useEffect, useRef, useState } from "react";
import { getAccessCode, setAccessCode } from "@/lib/client";
import { Icon } from "@/components/ui";

/** Asks for the shared access code when the server is configured to require one. */
export function AccessGate({ required }: { required: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");
  const [retry, setRetry] = useState(false);

  useEffect(() => {
    const open = () => {
      setRetry(true);
      if (dialog.current && !dialog.current.open) dialog.current.showModal();
    };
    window.addEventListener("weaver:access-required", open);
    if (required && !getAccessCode() && dialog.current && !dialog.current.open) dialog.current.showModal();
    return () => window.removeEventListener("weaver:access-required", open);
  }, [required]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="gate-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-panel p-0 text-fg backdrop:bg-black/70"
    >
      <form
        method="dialog"
        className="space-y-4 p-6"
        onSubmit={() => {
          setAccessCode(code.trim());
          setCode("");
        }}
      >
        <div className="flex items-center gap-2.5">
          <Icon name="key" size={18} className="text-thread" />
          <h2 id="gate-title" className="text-base font-semibold">
            Access code needed
          </h2>
        </div>
        <p className="text-sm leading-6 text-dim">
          This Weaver instance spends real Bright Data credits, so it asks for a code first. Ask whoever shared the link.
        </p>
        <label className="block space-y-1.5">
          <span className="text-sm text-dim">Code</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={retry}
            required
          />
        </label>
        {retry && <p className="text-xs text-fray">That code didn&apos;t work. Check it and try again.</p>}
        <button className="btn btn-primary w-full">Continue</button>
      </form>
    </dialog>
  );
}
