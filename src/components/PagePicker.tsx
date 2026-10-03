"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CANDIDATE_TAGS, MAX_CANDIDATE_ELEMENTS, MAX_TEXT_LENGTH, MIN_TEXT_LENGTH } from "@/lib/pickerCandidates";
import { Icon } from "@/components/ui";

export interface Candidate {
  id: string;
  tag: string;
  text: string;
}

/**
 * Shows a target page's sanitized HTML in a sandboxed iframe and makes it the
 * clicking surface. `sandbox="allow-same-origin"` with no `allow-scripts` is
 * the real safety boundary: none of the page's own JavaScript ever runs.
 *
 * Candidate detection runs here against the rendered DOM. It polls for real
 * body content instead of waiting for the iframe `load` event, for two reasons
 * found by testing:
 *   - `load` waits for every sub-resource, so one hanging tracker or font means
 *     it never fires;
 *   - a blank about:blank document exists before the srcdoc navigation lands and
 *     already reports readyState "complete", so readyState alone stops too early.
 * The reliable signal is `document.body` having child elements.
 */
export function PagePicker({
  html,
  url,
  title,
  selectedIds,
  onToggle,
}: {
  html: string;
  url: string;
  title: string;
  selectedIds: Set<string>;
  onToggle: (candidate: Candidate) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const registry = useRef(new Map<string, { candidate: Candidate; el: HTMLElement }>());
  const toggleRef = useRef(onToggle);
  const selectedRef = useRef(selectedIds);
  useEffect(() => {
    toggleRef.current = onToggle;
    selectedRef.current = selectedIds;
  });

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [finished, setFinished] = useState(false);
  const [view, setView] = useState<"page" | "list">("page");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    registry.current.clear();

    const ownText = (el: Element) => {
      let text = "";
      for (const node of Array.from(el.childNodes)) if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
      return text.replace(/\s+/g, " ").trim();
    };

    const detect = (doc: Document) => {
      if (!doc.getElementById("weaver-picker-style")) {
        const style = doc.createElement("style");
        style.id = "weaver-picker-style";
        style.textContent = `
          [data-weaver-id]{cursor:pointer}
          .weaver-hover{outline:1px dashed #e8a04a!important;outline-offset:1px}
          .weaver-selected{outline:2px solid #e8a04a!important;outline-offset:1px;background:rgba(232,160,74,.14)!important}`;
        doc.head.appendChild(style);
      }

      const seen = new Set<string>();
      const found: Candidate[] = [];
      let n = 0;
      outer: for (const tag of CANDIDATE_TAGS) {
        for (const el of Array.from(doc.querySelectorAll<HTMLElement>(tag))) {
          if (found.length >= MAX_CANDIDATE_ELEMENTS) break outer;
          let text = tag === "img" ? (el.getAttribute("alt") || el.getAttribute("src") || "").trim() : ownText(el);
          if (text.length < MIN_TEXT_LENGTH) continue;
          if (text.length > MAX_TEXT_LENGTH) text = text.slice(0, MAX_TEXT_LENGTH) + "…";
          const key = `${tag}:${text}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const candidate = { id: `el-${n++}`, tag, text };
          el.setAttribute("data-weaver-id", candidate.id);
          el.classList.toggle("weaver-selected", selectedRef.current.has(candidate.id));
          registry.current.set(candidate.id, { candidate, el });
          found.push(candidate);
        }
      }

      const target = (e: Event) => (e.target as Element | null)?.closest?.("[data-weaver-id]") ?? null;
      doc.addEventListener("mouseover", (e) => target(e)?.classList.add("weaver-hover"), true);
      doc.addEventListener("mouseout", (e) => target(e)?.classList.remove("weaver-hover"), true);
      doc.addEventListener(
        "click",
        (e) => {
          // Never let a click navigate the preview away from the page being picked.
          if ((e.target as Element | null)?.closest?.("a")) e.preventDefault();
          const el = target(e);
          if (!el) return;
          e.preventDefault();
          e.stopPropagation();
          const entry = registry.current.get(el.getAttribute("data-weaver-id") ?? "");
          if (entry) toggleRef.current(entry.candidate);
        },
        true,
      );
      setCandidates(found);
      setFinished(true);
    };

    const tryDetect = () => {
      if (cancelled) return;
      const doc = frameRef.current?.contentDocument;
      if (doc?.body && doc.body.childElementCount > 0) return detect(doc);
      if (++attempts < 100) timer = setTimeout(tryDetect, 100); // about a 10 second ceiling
      else setFinished(true);
    };
    timer = setTimeout(tryDetect, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [html]);

  // Keep outlines in the page in step with the selection (e.g. when a field is removed in the side panel).
  useEffect(() => {
    for (const [id, { el }] of registry.current) el.classList.toggle("weaver-selected", selectedIds.has(id));
  }, [selectedIds]);

  const host = useMemo(() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }, [url]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? candidates.filter((c) => c.text.toLowerCase().includes(q) || c.tag.includes(q)) : candidates;
  }, [candidates, query]);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="num truncate rounded-md bg-ink px-2.5 py-1 text-xs text-dim" title={url}>
            {host}
          </span>
          <span className="hidden truncate text-xs text-faint sm:block" title={title}>
            {title}
          </span>
        </div>
        <span className="num text-xs text-faint" aria-live="polite">
          {finished ? `${candidates.length} pickable` : "finding elements…"}
        </span>
        <div className="flex rounded-lg border border-line-strong p-0.5" role="group" aria-label="Picker view">
          {(["page", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === v ? "bg-panel-3 text-fg" : "text-faint hover:text-fg"
              }`}
            >
              <Icon name={v === "page" ? "page" : "list"} size={13} />
              {v === "page" ? "Page" : "List"}
            </button>
          ))}
        </div>
      </div>

      {/* The iframe stays mounted so detection and outlines survive switching views. */}
      <div hidden={view !== "page"}>
        <iframe
          ref={frameRef}
          srcDoc={html}
          sandbox="allow-same-origin"
          title={`Preview of ${host}. Click elements to select them, or switch to List view.`}
          className="block h-[30rem] w-full bg-white lg:h-[36rem]"
        />
        {finished && candidates.length === 0 && (
          <p className="border-t border-line px-4 py-3 text-sm text-dim">
            Nothing pickable was found. This page probably builds its content with JavaScript, which Weaver never runs
            while previewing. Try a server-rendered page, or one of the examples above.
          </p>
        )}
      </div>

      {view === "list" && (
        <div className="p-3">
          <label className="relative block">
            <span className="sr-only">Filter elements</span>
            <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              className="input pl-9"
              placeholder="Filter by text or tag"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <ul className="mt-2 max-h-[26rem] overflow-y-auto" role="list">
            {visible.map((c) => {
              const on = selectedIds.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => onToggle(c)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-panel-2 ${
                      on ? "bg-thread-soft" : ""
                    }`}
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded border ${
                        on ? "border-thread bg-thread text-thread-ink" : "border-line-strong"
                      }`}
                    >
                      {on && <Icon name="check" size={12} />}
                    </span>
                    <span className="tag">{c.tag}</span>
                    <span className="truncate">{c.text}</span>
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-2.5 py-6 text-center text-sm text-faint">No elements match.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
