import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import StartPartyButton from "@/components/StartPartyButton";

function runtime(mins) {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}H ${m}M` : `${m} MIN`;
}

export default async function TitlePage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  // the title
  const { data: title } = await supabase
    .from("titles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!title) notFound();

  const isFilm = title.kind === "film";

  // seasons + episodes
  let seasons = [];
  let episodes = [];
  let activeSeason = null;

  if (!isFilm) {
    const { data: seasonRows } = await supabase
      .from("seasons")
      .select("id, season_number, name")
      .eq("title_id", id)
      .order("season_number");

    seasons = seasonRows || [];

    const wanted = Number(sp?.season) || seasons[0]?.season_number;
    activeSeason = seasons.find((s) => s.season_number === wanted) || seasons[0];

    if (activeSeason) {
      const { data: epRows } = await supabase
        .from("episodes")
        .select("id, episode_number, name, synopsis, still_url, runtime_minutes, video_url")
        .eq("season_id", activeSeason.id)
        .order("episode_number");

      episodes = epRows || [];
    }
  }

  // where this user left off
  const { data: progressRows } = await supabase
    .from("watch_progress")
    .select("episode_id, position_seconds, duration_seconds, completed")
    .eq("user_id", user.id)
    .eq("title_id", id);

  const progressByEpisode = {};
  let filmProgress = null;

  for (const row of progressRows || []) {
    if (row.episode_id) progressByEpisode[row.episode_id] = row;
    else filmProgress = row;
  }

  function percent(row) {
    if (!row?.duration_seconds) return 0;
    return Math.min(100, (row.position_seconds / row.duration_seconds) * 100);
  }

  const playable = isFilm ? title.video_url : episodes.find((e) => e.video_url);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="cn-grain" />

      <div className="relative z-10">
        {/* nav */}
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
          <div className="flex items-center justify-between px-5 py-3.5 text-muted">
            {profile?.username}
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#2A3341] text-[10px] text-text">
              {(profile?.username || "?").charAt(0).toUpperCase()}
            </span>
          </div>
        </nav>

        {/* hero */}
        <section className="relative border-b border-line">
          {title.backdrop_url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={title.backdrop_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/40" />
            </>
          )}

          <div className="relative flex flex-col gap-7 px-5 py-10 md:flex-row md:py-14">
            {/* poster */}
            <div className="w-[150px] shrink-0 md:w-[190px]">
              <div className="aspect-[2/3] overflow-hidden rounded-[6px] bg-raised shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                {title.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={title.poster_url} alt={title.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-mono text-[10px] text-faint">
                    NO POSTER
                  </div>
                )}
              </div>
            </div>

            {/* info */}
            <div className="min-w-0 flex-1">
              <div className="cn-rise font-mono text-[11px] tracking-[0.2em] text-muted">
                {title.kind.toUpperCase()}
                {title.year ? ` — ${title.year}` : ""}
              </div>

              <h1
                className="cn-rise mt-3 text-[30px] font-semibold leading-[1.06] tracking-[-1px] md:text-[38px]"
                style={{ animationDelay: "0.1s" }}
              >
                {title.name}
              </h1>

              {title.original_name && title.original_name !== title.name && (
                <div
                  className="cn-rise mt-1.5 text-[13px] text-muted"
                  style={{ animationDelay: "0.16s" }}
                >
                  {title.original_name}
                </div>
              )}

              <div
                className="cn-rise mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] tracking-[0.1em] text-muted"
                style={{ animationDelay: "0.22s" }}
              >
                {isFilm
                  ? runtime(title.runtime_minutes) && <span>{runtime(title.runtime_minutes)}</span>
                  : seasons.length > 0 && (
                      <span>
                        {seasons.length} SEASON{seasons.length === 1 ? "" : "S"}
                      </span>
                    )}
                {(title.genres || []).slice(0, 4).map((g) => (
                  <span key={g} className="rounded-full border border-line px-2.5 py-1">
                    {g.toUpperCase()}
                  </span>
                ))}
              </div>

              {title.synopsis && (
                <p
                  className="cn-rise mt-5 max-w-2xl text-[13.5px] leading-relaxed text-muted"
                  style={{ animationDelay: "0.28s" }}
                >
                  {title.synopsis}
                </p>
              )}

              {/* film progress */}
              {isFilm && filmProgress && percent(filmProgress) > 0 && (
                <div className="cn-rise mt-6 max-w-sm" style={{ animationDelay: "0.32s" }}>
                  <div className="h-[2px] bg-line">
                    <div className="h-[2px] bg-marquee" style={{ width: `${percent(filmProgress)}%` }} />
                  </div>
                  <div className="mt-2 font-mono text-[10px] text-muted">
                    {Math.round(percent(filmProgress))}% WATCHED
                  </div>
                </div>
              )}

              {/* actions */}
              <div className="cn-rise mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.36s" }}>
                {playable ? (
                  <Link
                    href={isFilm ? `/watch/${title.id}` : `/watch/${title.id}?ep=${playable.id}`}
                    className="rounded-[4px] bg-marquee px-5 py-3 text-[13px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(229,168,61,0.55)]"
                    style={{ transitionTimingFunction: "var(--ease-cine)" }}
                  >
                    ▶ Play
                  </Link>
                ) : (
                  <span className="rounded-[4px] border border-line px-5 py-3 font-mono text-[11px] tracking-[0.12em] text-faint">
                    NO VIDEO UPLOADED YET
                  </span>
                )}

                {playable && (
                  <StartPartyButton
                    titleId={title.id}
                    episodeId={isFilm ? null : playable.id}
                  />
                )}

                <Link
                  href="/library"
                  className="rounded-[4px] border border-line-strong px-5 py-3 text-[13px] transition-all duration-500 hover:-translate-y-0.5 hover:border-muted hover:bg-white/[0.03]"
                  style={{ transitionTimingFunction: "var(--ease-cine)" }}
                >
                  ← Back to library
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* episodes */}
        {!isFilm && (
          <>
            {seasons.length > 1 && (
              <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
                {seasons.map((s) => (
                  <Link
                    key={s.id}
                    href={`/title/${title.id}?season=${s.season_number}`}
                    className={`rounded-full border px-3.5 py-1.5 font-mono text-[10px] tracking-[0.12em] transition-all duration-300 ${
                      activeSeason?.id === s.id
                        ? "border-marquee bg-marquee font-medium text-marquee-ink"
                        : "border-line text-muted hover:border-line-strong hover:text-text"
                    }`}
                  >
                    S{String(s.season_number).padStart(2, "0")}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <span className="text-[14px] font-medium">
                {activeSeason?.name || `Season ${activeSeason?.season_number}`}
              </span>
              <span className="font-mono text-[10px] tracking-[0.15em] text-muted">
                {episodes.length} EPISODE{episodes.length === 1 ? "" : "S"}
              </span>
            </div>

            <div>
              {episodes.map((ep, i) => {
                const prog = progressByEpisode[ep.id];
                const pct = percent(prog);

                return (
                  <div
                    key={ep.id}
                    className="cn-rise group flex gap-4 border-b border-line px-5 py-4 transition-colors duration-400 hover:bg-white/[0.022]"
                    style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
                  >
                    {/* still */}
                    <div className="relative w-[130px] shrink-0 overflow-hidden rounded-[4px] bg-raised sm:w-[170px]">
                      <div className="aspect-video">
                        {ep.still_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ep.still_url}
                            alt=""
                            className="h-full w-full object-cover brightness-[0.85] transition-all duration-500 group-hover:scale-[1.04] group-hover:brightness-100"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center font-mono text-[9px] text-faint">
                            NO STILL
                          </div>
                        )}
                      </div>
                      {pct > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/50">
                          <div className="h-full bg-marquee" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>

                    {/* text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-mono text-[10px] text-faint transition-colors duration-400 group-hover:text-marquee">
                          E{String(ep.episode_number).padStart(2, "0")}
                        </span>
                        <span className="truncate text-[13.5px] font-medium">
                          {ep.name || `Episode ${ep.episode_number}`}
                        </span>
                      </div>

                      {ep.synopsis && (
                        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                          {ep.synopsis}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-muted">
                        {ep.runtime_minutes && <span>{ep.runtime_minutes} MIN</span>}
                        {prog?.completed && <span className="text-marquee">WATCHED</span>}
                        {!ep.video_url && <span className="text-faint">NO VIDEO</span>}
                      </div>
                    </div>

                    {/* play */}
                    <div className="flex shrink-0 items-center">
                      {ep.video_url ? (
                        <Link
                          href={`/watch/${title.id}?ep=${ep.id}`}
                          className="rounded-[4px] bg-marquee px-4 py-2 text-[12px] font-semibold text-marquee-ink opacity-0 transition-all duration-400 group-hover:opacity-100"
                          style={{ transitionTimingFunction: "var(--ease-cine)" }}
                        >
                          ▶
                        </Link>
                      ) : (
                        <span className="font-mono text-[10px] text-faint">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}