"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LibrarySearch() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const debounce = useRef(null);

  // search as you type (debounced)
  useEffect(() => {
    clearTimeout(debounce.current);

    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    debounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from("titles")
        .select("id, name, kind, year, poster_url")
        .ilike("name", `%${query.trim()}%`)
        .order("created_at", { ascending: false })
        .limit(8);

      setResults(data || []);
      setOpen(true);
      setLoading(false);
    }, 250);

    return () => clearTimeout(debounce.current);
  }, [query]);

  // close when clicking outside
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative border-b border-line px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[12px] text-muted">⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search the library…"
          className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
        />
        {loading && (
          <span className="font-mono text-[10px] tracking-[0.1em] text-faint">…</span>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 border-b border-line bg-ink shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8)]">
          {results.length === 0 ? (
            <div className="px-5 py-6 font-mono text-[11px] tracking-[0.1em] text-faint">
              NO MATCHES
            </div>
          ) : (
            results.map((t) => (
              <Link
                key={t.id}
                href={`/title/${t.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-4 border-t border-line px-5 py-3 transition-colors duration-300 first:border-t-0 hover:bg-white/[0.03]"
              >
                <div className="h-[54px] w-[38px] shrink-0 overflow-hidden rounded-[3px] bg-raised">
                  {t.poster_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.poster_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium">{t.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] tracking-[0.1em] text-muted">
                    {t.kind.toUpperCase()}
                    {t.year ? ` · ${t.year}` : ""}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}