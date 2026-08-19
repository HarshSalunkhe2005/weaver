"use client";

import { useEffect, useRef } from "react";
import {
  CANDIDATE_TAGS,
  MAX_CANDIDATE_ELEMENTS,
  MAX_TEXT_LENGTH,
  MIN_TEXT_LENGTH,
} from "@/lib/pickerCandidates";

/**
 * Renders a target page's real, sanitized HTML in a sandboxed iframe and
 * turns it into the picker's actual clicking surface — real layout, real
 * CSS — instead of a flattened text list. See src/lib/renderPage.ts for the
 * server-side sanitization and the safety model (sandbox="allow-same-origin"
 * with no allow-scripts is the actual boundary; everything else is
 * defense-in-depth).
 *
 * Candidate detection runs here, client-side, against the real rendered DOM
 * — not a separately server-parsed copy — so what's clickable always
 * matches what's visually on screen.
 *
 * Deliberately does not key off the iframe's `load` event or `readyState`
 * alone. Two real timing traps, both found by testing rather than assumed:
 *   - `load` only fires once every sub-resource (stylesheets, images,
 *     trackers, fonts) has settled — if even one hangs, which happens on
 *     the real internet, it never fires at all. Confirmed directly:
 *     `frame.waitForLoadState('load')` timed out while `domcontentloaded`
 *     resolved immediately.
 *   - A transient blank `about:blank` document exists synchronously before
 *     the real `srcdoc` navigation completes, and it already reports
 *     `readyState === "complete"` with an empty `<body>` — so polling on
 *     readyState alone catches that blank document on the very first
 *     check and stops looking.
 * The actual condition that's both necessary and sufficient: poll until
 * `document.body` has real children.
 */
export function PagePicker({
  html,
  selections,
  onToggle,
}: {
  html: string;
  selections: Map<string, string>;
  onToggle: (id: string, guessLabel: string, tag: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const registryRef = useRef<Map<string, { tag: string; text: string; el: HTMLElement }>>(
    new Map()
  );

  function ownText(el: Element): string {
    let text = "";
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
    }
    return text.replace(/\s+/g, " ").trim();
  }

  function runDetection(doc: Document) {
    registryRef.current.clear();

    if (!doc.getElementById("weaver-picker-style")) {
      const style = doc.createElement("style");
      style.id = "weaver-picker-style";
      style.textContent = `
        [data-weaver-id] { cursor: pointer; }
        .weaver-hover { outline: 1px dashed #e2953f !important; outline-offset: 1px; }
        .weaver-selected { outline: 2px solid #e2953f !important; outline-offset: 1px; background: rgba(226,149,63,0.12) !important; }
      `;
      doc.head.appendChild(style);
    }

    const seen = new Set<string>();
    let counter = 0;

    outer: for (const tag of CANDIDATE_TAGS) {
      for (const el of Array.from(doc.querySelectorAll<HTMLElement>(tag))) {
        if (registryRef.current.size >= MAX_CANDIDATE_ELEMENTS) break outer;

        let text: string;
        if (tag === "img") {
          text = (el.getAttribute("alt") || el.getAttribute("src") || "").trim();
        } else {
          text = ownText(el);
        }
        if (text.length < MIN_TEXT_LENGTH) continue;
        if (text.length > MAX_TEXT_LENGTH) text = text.slice(0, MAX_TEXT_LENGTH) + "…";

        const dedupeKey = `${tag}:${text}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const id = `el-${counter++}`;
        el.setAttribute("data-weaver-id", id);
        registryRef.current.set(id, { tag, text, el });
      }
    }

    for (const [id, { el }] of registryRef.current) {
      el.classList.toggle("weaver-selected", selections.has(id));
    }

    doc.addEventListener(
      "mouseover",
      (e) => {
        const target = (e.target as Element)?.closest?.("[data-weaver-id]");
        if (target) target.classList.add("weaver-hover");
      },
      true
    );
    doc.addEventListener(
      "mouseout",
      (e) => {
        const target = (e.target as Element)?.closest?.("[data-weaver-id]");
        if (target) target.classList.remove("weaver-hover");
      },
      true
    );
    doc.addEventListener(
      "click",
      (e) => {
        const target = (e.target as Element)?.closest?.("[data-weaver-id]");
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        const id = target.getAttribute("data-weaver-id");
        const entry = id ? registryRef.current.get(id) : undefined;
        if (!id || !entry) return;
        const guess = entry.text.split(/\s+/).slice(0, 4).join(" ");
        onToggle(id, guess, entry.tag);
      },
      true
    );
  }

  useEffect(() => {
    if (!html) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cancelled = false;
    let attempts = 0;

    const tryDetect = () => {
      if (cancelled) return;
      const doc = iframe.contentDocument;
      if (doc && doc.body && doc.body.childElementCount > 0) {
        runDetection(doc);
        return;
      }
      attempts++;
      if (attempts < 100) setTimeout(tryDetect, 100); // ~10s ceiling
    };
    tryDetect();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the page itself changes
  }, [html]);

  // Keep the iframe's outlines in sync whenever selections change from
  // outside (e.g. removing a field from the side list below).
  useEffect(() => {
    for (const [id, { el }] of registryRef.current) {
      el.classList.toggle("weaver-selected", selections.has(id));
    }
  }, [selections]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      sandbox="allow-same-origin"
      title="Page preview — click elements to select them"
      className="h-[28rem] w-full rounded-lg"
      style={{ border: "1px solid var(--border)", background: "#fff" }}
    />
  );
}
