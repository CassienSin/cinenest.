"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "video";

export default function UploadPage() {
  const supabase = createClient();

  const [titles, setTitles] = useState([]);
  const [titleId, setTitleId] = useState("");
  const [episodes, setEpisodes] = useState([]);
  const [episodeId, setEpisodeId] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const selectedTitle = titles.find((t) => t.id === titleId);
  const isFilm = selectedTitle?.kind === "film";

  // load titles
  useEffect(() => {
    supabase
      .from("titles")
      .select("id, name, kind")
      .order("name")
      .then(({ data }) => setTitles(data || []));
  }, []);

  // load episodes when a series is picked
  useEffect(() => {
    setEpisodeId("");
    setEpisodes([]);
    if (!titleId || isFilm) return;

    supabase
      .from("episodes")
      .select("id, episode_number, name, video_url, seasons(season_number)")
      .eq("title_id", titleId)
      .order("episode_number")
      .then(({ data }) => setEpisodes(data || []));
  }, [titleId, isFilm]);

  function handleFiles(e) {
    const picked = Array.from(e.target.files || []).filter(
      (f) => f.name.endsWith(".m3u8") || f.name.endsWith(".ts")
    );
    setFiles(picked);
    setError(null);
    setMessage(null);

    if (picked.length && !picked.some((f) => f.name === "playlist.m3u8")) {
      setError("No playlist.m3u8 found in that folder.");
    }

    const tooBig = picked.find((f) => f.size > 50 * 1024 * 1024);
    if (tooBig) {
      setError(`"${tooBig.name}" is over 50MB — re-encode with a lower bitrate.`);
    }
  }

  async function handleUpload() {
    if (!titleId || !files.length) return;
    if (!isFilm && !episodeId) {
      setError("Pick an episode first.");
      return;
    }

    setBusy(true);
    setDone(0);
    setError(null);
    setMessage(null);

    const folder = isFilm ? `${titleId}/film` : `${titleId}/${episodeId}`;

    try {
      // upload 4 at a time
      const queue = [...files];
      let completed = 0;

      async function worker() {
        while (queue.length) {
          const file = queue.shift();

          const formData = new FormData();
          formData.append("file", file);
          formData.append("key", `${folder}/${file.name}`);

          const res = await fetch("/api/r2/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(`${file.name}: ${data.error || "upload failed"}`);
          }

          completed += 1;
          setDone(completed);
        }
      }

      await Promise.all([worker(), worker(), worker(), worker()]);

      // public URL of the manifest on R2
      const videoUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${folder}/playlist.m3u8`;

      // attach it
      const { error: dbErr } = isFilm
        ? await supabase.from("titles").update({ video_url: videoUrl }).eq("id", titleId)
        : await supabase.from("episodes").update({ video_url: videoUrl }).eq("id", episodeId);

      if (dbErr) throw new Error(dbErr.message);

      setMessage(`${files.length} files uploaded and linked. Ready to watch.`);
      setFiles([]);

      if (!isFilm) {
        const { data } = await supabase
          .from("episodes")
          .select("id, episode_number, name, video_url, seasons(season_number)")
          .eq("title_id", titleId)
          .order("episode_number");
        setEpisodes(data || []);
      }
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const totalMB = (files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(1);
  const pct = files.length ? (done / files.length) * 100 : 0;

  const inputClass =
    "mt-2 w-full border-b border-line bg-transparent pb-2 text-[13.5px] text-text outline-none transition-colors duration-300 focus:border-marquee";
  const labelClass = "font-mono text-[10px] tracking-[0.18em] text-muted";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="cn-bloom" />
      <div className="cn-grain" />

      <div className="relative z-10">
        <nav className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-line text-[13px]">
          <div className="border-r border-line px-5 py-3.5 font-semibold tracking-[-0.3px]">
            cinenest<span className="text-marquee">.</span>
          </div>
          <Link href="/" className="border-r border-line px-5 py-3.5 text-muted transition-colors hover:text-text">
            home
          </Link>
          <Link href="/library" className="border-r border-line px-5 py-3.5 text-muted transition-colors hover:text-text">
            library
          </Link>
          <div className="px-5 py-3.5 text-marquee">upload</div>
        </nav>

        <section className="border-b border-line px-5 py-10">
          <div className="cn-rise font-mono text-[11px] tracking-[0.2em] text-muted">
            ADMIN — UPLOAD VIDEO
          </div>
          <h1
            className="cn-rise mt-3 text-[32px] font-semibold leading-none tracking-[-1px]"
            style={{ animationDelay: "0.1s" }}
          >
            Attach a stream
          </h1>
          <p
            className="cn-rise mt-3 max-w-lg text-[13px] leading-relaxed text-muted"
            style={{ animationDelay: "0.18s" }}
          >
            Pick the HLS folder you made with FFmpeg — the one holding{" "}
            <span className="font-mono text-[12px] text-text">playlist.m3u8</span> and its{" "}
            <span className="font-mono text-[12px] text-text">.ts</span> segments.
          </p>
        </section>

        <div className="max-w-xl space-y-8 px-5 py-9">
          {/* title */}
          <label className="block">
            <span className={labelClass}>TITLE</span>
            <select
              value={titleId}
              onChange={(e) => setTitleId(e.target.value)}
              className={inputClass}
            >
              <option value="" className="bg-ink">Choose a title…</option>
              {titles.map((t) => (
                <option key={t.id} value={t.id} className="bg-ink">
                  {t.name} ({t.kind})
                </option>
              ))}
            </select>
          </label>

          {/* episode */}
          {titleId && !isFilm && (
            <label className="block">
              <span className={labelClass}>EPISODE</span>
              <select
                value={episodeId}
                onChange={(e) => setEpisodeId(e.target.value)}
                className={inputClass}
              >
                <option value="" className="bg-ink">Choose an episode…</option>
                {episodes.map((ep) => (
                  <option key={ep.id} value={ep.id} className="bg-ink">
                    S{String(ep.seasons?.season_number ?? 1).padStart(2, "0")}E
                    {String(ep.episode_number).padStart(2, "0")}
                    {ep.name ? ` — ${ep.name}` : ""}
                    {ep.video_url ? "  ✓" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* folder */}
          {titleId && (isFilm || episodeId) && (
            <div>
              <span className={labelClass}>HLS FOLDER</span>
              <input
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFiles}
                className="mt-3 block w-full text-[12px] text-muted file:mr-4 file:cursor-pointer file:rounded-[4px] file:border-0 file:bg-raised file:px-4 file:py-2 file:font-mono file:text-[10px] file:tracking-[0.12em] file:text-text hover:file:bg-line"
              />
              {files.length > 0 && (
                <div className="mt-3 font-mono text-[10px] tracking-[0.1em] text-muted">
                  {files.length} FILES · {totalMB} MB
                </div>
              )}
            </div>
          )}

          {/* progress */}
          {busy && (
            <div>
              <div className="h-[2px] bg-line">
                <div
                  className="h-[2px] bg-marquee transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 font-mono text-[10px] text-muted">
                UPLOADING {done} / {files.length}
              </div>
            </div>
          )}

          {message && <p className="font-mono text-[11px] text-marquee">✓ {message}</p>}
          {error && <p className="font-mono text-[11px] leading-relaxed text-alert">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={busy || !files.length || !titleId || (!isFilm && !episodeId)}
            className="rounded-[4px] bg-marquee px-5 py-3 text-[13px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(229,168,61,0.55)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ transitionTimingFunction: "var(--ease-cine)" }}
          >
            {busy ? "Uploading…" : "Upload & attach"}
          </button>
        </div>
      </div>
    </main>
  );
}