"use client";

import { Spinner } from "@/components/ui";

export const EXAMPLES = [
  { label: "Books to Scrape", url: "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html" },
  { label: "Quotes to Scrape", url: "https://quotes.toscrape.com/" },
];

export function UrlForm({
  url,
  onUrl,
  onSubmit,
  loading,
  large = false,
}: {
  url: string;
  onUrl: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  large?: boolean;
}) {
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="flex-1">
        <span className="sr-only">Page URL</span>
        <input
          type="url"
          required
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="https://example.com/product/123"
          className={`input num ${large ? "!min-h-14 !px-4 !text-base" : ""}`}
        />
      </label>
      <button type="submit" disabled={loading} className={`btn btn-primary ${large ? "!min-h-14 !px-7 !text-base" : ""}`}>
        {loading ? (
          <>
            <Spinner /> Reading…
          </>
        ) : (
          "Read page"
        )}
      </button>
    </form>
  );
}

export function Hero({
  url,
  onUrl,
  onSubmit,
  loading,
  error,
  onExample,
}: {
  url: string;
  onUrl: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  onExample: (url: string) => void;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl pb-6 pt-10 sm:pt-16" aria-labelledby="hero-title">
      <h1 id="hero-title" className="font-display text-[clamp(2.6rem,7vw,4.6rem)] leading-[1.02] tracking-tight text-balance">
        Point at a page.
        <br />
        <span className="italic text-thread">Weaver</span> builds the scraper.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-dim sm:text-lg">
        Click the fields you want on the real page. Bright Data turns them into a working scraper, and when a site
        changes, you review the repair before it goes live.
      </p>

      <div className="mt-8">
        <UrlForm url={url} onUrl={onUrl} onSubmit={onSubmit} loading={loading} large />
        {error && (
          <p role="alert" className="mt-3 text-sm text-fray">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-faint">
          <span>Try one:</span>
          {EXAMPLES.map((e) => (
            <button
              key={e.url}
              type="button"
              disabled={loading}
              onClick={() => onExample(e.url)}
              className="rounded-md border border-line-strong px-2.5 py-1 text-dim transition-colors hover:border-faint hover:text-fg disabled:opacity-50"
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="mt-8 space-y-3" aria-hidden>
          <div className="skeleton h-9 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      )}
    </section>
  );
}
