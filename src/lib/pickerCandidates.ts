/**
 * Shared between server (unused directly, kept for reference/consistency)
 * and client: the set of tags the picker treats as "things worth clicking."
 * No server-only imports here — this file gets bundled into the browser,
 * since the real candidate-detection now runs client-side against the
 * rendered iframe DOM (see page.tsx), not against a server-parsed copy.
 */
export const CANDIDATE_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "li",
  "td",
  "th",
  "a",
  "span",
  "div",
  "img",
] as const;

export const MAX_CANDIDATE_ELEMENTS = 300;
export const MAX_TEXT_LENGTH = 200;
export const MIN_TEXT_LENGTH = 1;
