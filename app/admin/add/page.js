"use client";

import { useState } from "react";

export default function AddTitlePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Search failed.");
        setResults([]);
      } else {
        setResults(data.results);
        if (data.results.length === 0) setError("Nothing found for that search.");
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSearching(false);
    }
  }

  async function handleImport(item) {
    setImportingId(item.tmdbId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/tmdb/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          kind: item.kind,
        }),
      });
      const data = await res.json();

      if (!res.ok) setError(data.error || "Import failed.");
      else setMessage(`${data.name} — ${data.summary}`);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setImportingId(null);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="cn-bloom" />
      <div className="cn-grain" />

      <div className="relative z-10">
        <nav className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-line text-[13px]">
          <div className="border-r border-line px-5 py-3.5 font-semibold tracking-[-0.3px]">
            cinenest<span className="text-marquee">.</span>
          </div>
          <div className="border-r border-line px-5 py-3.5">
            <a href="/" className="text-muted transition-colors hover:text-text">
              home
            </a>
          </div>
          <div className="border-r border-line px-5 py-3.5 text-muted">library</div>
          <div className="px-5 py-3.5 text-marquee">add title</div>
        </nav>

        <section className="border-b border-line px-5 py-10">
          <div className="cn-rise font-mono text-[11px] tracking-[0.2em] text-muted">
            ADMIN — ADD TITLE
          </div>

          <h1
            className="cn-rise mt-3 text-[32px] font-semibold leading-none tracking-[-1px]"
            style={{ animationDelay: "0.12s" }}
          >
            Search the archive
          </h1>

          <form
            onSubmit={handleSearch}
            className="cn-rise mt-7 flex max-w-xl gap-3"
            style={{ animationDelay: "0.24s" }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Frieren, Dune, The Bear…"
              className="flex-1 border-b border-line bg-transparent pb-2 text-[14px] outline-none transition-colors duration-300 placeholder:text-faint focus:border-marquee"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-[4px] bg-marquee px-5 py-2.5 text-[13px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(229,168,61,0.55)] disabled:opacity-60"
              style={{ transitionTimingFunction: "var(--ease-cine)" }}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>

          {message && (
            <p className="mt-5 font-mono text-[11px] text-marquee">✓ {message}</p>
          )}
          {error && <p className="mt-5 font-mono text-[11px] text-alert">{error}</p>}
        </section>

        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            {results.map((item, i) => (
              <div
                key={item.tmdbId}
                className="cn-rise border-b border-r border-line p-4"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="mb-3 aspect-[2/3] overflow-hidden rounded-[4px] bg-raised">
                  {item.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.posterUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-mono text-[10px] text-faint">
                      NO POSTER
                    </div>
                  )}
                </div>

                <div className="text-[13px] font-medium leading-tight">{item.name}</div>
                <div className="mt-1 font-mono text-[10px] uppercase text-muted">
                  {item.kind} · {item.year || "—"}
                </div>

                <button
                  onClick={() => handleImport(item)}
                  disabled={importingId === item.tmdbId}
                  className="mt-3 w-full rounded-[4px] border border-line-strong py-2 text-[12px] transition-all duration-500 hover:-translate-y-0.5 hover:border-marquee hover:text-marquee disabled:opacity-60"
                  style={{ transitionTimingFunction: "var(--ease-cine)" }}
                >
                  {importingId === item.tmdbId ? "Importing…" : "Add to library"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}