/**
 * Turns a raw HTML page into a flat list of "candidate elements" the picker
 * UI can render as clickable regions. This is deliberately NOT a pixel-perfect
 * clone of the page — just headings, paragraphs, list items, table cells,
 * links, and images with enough surrounding text to be recognizable, which
 * is what the picker actually needs (the user is choosing *what* to scrape,
 * not reviewing a mirror of the site's design).
 */
import * as cheerio from "cheerio";

export interface PageElement {
  id: string;
  tag: string;
  text: string;
}

export interface ParsedPage {
  title: string;
  elements: PageElement[];
}

const CANDIDATE_SELECTORS = [
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

const MAX_ELEMENTS = 200;
const MAX_TEXT_LENGTH = 200;
const MIN_TEXT_LENGTH = 1;

export async function fetchAndParsePage(url: string): Promise<ParsedPage> {
  const res = await fetch(url, {
    headers: {
      // A plain default fetch UA gets blocked by a lot of sites; a normal
      // browser UA is enough for the picker's own preview fetch. The
      // actual scraping (bypassing anti-bot, JS rendering, etc.) is done
      // by Bright Data Scraper Studio, not by this preview step.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Fetching ${url} failed: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || url;

  const seenTexts = new Set<string>();
  const elements: PageElement[] = [];
  let counter = 0;

  for (const tag of CANDIDATE_SELECTORS) {
    if (elements.length >= MAX_ELEMENTS) break;

    $(tag).each((_, el) => {
      if (elements.length >= MAX_ELEMENTS) return false;

      const $el = $(el);

      // Skip elements whose own direct text is empty (i.e. they're just
      // wrappers) — we want elements that hold real leaf-level content.
      let text: string;
      if (tag === "img") {
        text = ($el.attr("alt") || $el.attr("src") || "").trim();
      } else {
        text = $el
          .clone()
          .children()
          .remove()
          .end()
          .text()
          .replace(/\s+/g, " ")
          .trim();
      }

      if (text.length < MIN_TEXT_LENGTH) return;
      if (text.length > MAX_TEXT_LENGTH) text = text.slice(0, MAX_TEXT_LENGTH) + "…";

      // Dedupe identical text (e.g. repeated nav links) — keep the picker
      // list from being dominated by boilerplate.
      const dedupeKey = `${tag}:${text}`;
      if (seenTexts.has(dedupeKey)) return;
      seenTexts.add(dedupeKey);

      elements.push({
        id: `el-${counter++}`,
        tag,
        text,
      });
    });
  }

  return { title, elements };
}
