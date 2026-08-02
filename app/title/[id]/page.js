import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import StartPartyButton from "@/components/StartPartyButton";
import FavoriteButton from "@/components/FavoriteButton";
import UserAvatar from "@/components/UserAvatar";

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
    .select("username, avatar_url")
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

  // is this title favorited?
  const { data: favRow } = await supabase
    .from("favorites")
    .select("title_id")
    .eq("user_id", user.id)
    .eq("title_id", id)
    .maybeSingle();

  const isFavorited = Boolean(favRow);

  function percent(row) {
    if (!row?.duration_seconds) return 0;
    return Math.min(100, (row.position_seconds / row.duration_seconds) * 100);
  }

  const playable = isFilm ? title.video_url : episodes.find((e) => e.video_url);

  // Backdrop is the whole hero now — fall back to the poster so the frame is
  // never an empty box on titles TMDB has no backdrop for.
  const heroImage = title.backdrop_url || title.poster_url || null;

  const ratingLabel =
    typeof title.rating === "number" && title.rating > 0
      ? title.rating.toFixed(1)
      : null;

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
          <Link href="/profile" className="flex items-center justify-between px-5 py-3.5 text-muted transition-colors hover:text-text">
            {profile?.username}
            <UserAvatar avatarUrl={profile?.avatar_url} username={profile?.username} />
          </Link>
        </nav>

        {/* ── hero: framed backdrop, content anchored bottom-left ── */}
        <section className="px-3 pt-3 md:px-4 md:pt-4">
          <div className="relative flex min-h-[400px] flex-col justify-end overflow-hidden rounded-[10px] border border-line sm:min-h-[460px] md:min-h-[560px] lg:min-h-[620px]">
            {heroImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-[center_22%]"
                />
                {/* vertical scrim — grounds the text, fades the frame into the page */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-transparent" />
                {/* horizontal scrim — keeps the logo readable over busy artwork */}
                <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/25 to-transparent" />
              </>
            ) : (
              <div className="absolute inset-0 bg-raised" />
            )}

            <div className="relative px-5 pb-8 pt-28 sm:px-7 md:px-10 md:pb-11">

              {/* the wordmark — this is the whole point of the redesign */}
              {title.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={title.logo_url}
                  alt={title.name}
                  className="cn-rise mt-4 h-auto max-h-[92px] w-auto max-w-[280px] object-contain object-left sm:max-h-[110px] sm:max-w-[340px] md:mt-5 md:max-h-[140px] md:max-w-[460px]"
                  style={{
                    animationDelay: "0.1s",
                    filter: "drop-shadow(0 6px 24px rgba(0,0,0,0.85))",
                  }}
                />
              ) : (
                <h1
                  className="cn-rise mt-3 max-w-3xl text-[32px] font-semibold leading-[1.04] tracking-[-1.2px] md:text-[46px]"
                  style={{
                    animationDelay: "0.1s",
                    textShadow: "0 4px 22px rgba(0,0,0,0.8)",
                  }}
                >
                  {title.name}
                </h1>
              )}

              {title.original_name && title.original_name !== title.name && (
                <div
                  className="cn-rise mt-2.5 text-[13px] text-muted"
                  style={{ animationDelay: "0.16s" }}
                >
                  {title.original_name}
                </div>
              )}

              {/* eyebrow — now sits under the wordmark */}
              <div
                className="cn-rise mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[10.5px] tracking-[0.2em] text-muted"
                style={{ animationDelay: "0.2s" }}
              >
                <span>{(title.kind || "title").toUpperCase()}</span>
                {title.year && (
                  <>
                    <span className="text-faint">/</span>
                    <span>{title.year}</span>
                  </>
                )}
                {ratingLabel && (
                  <>
                    <span className="text-faint">/</span>
                    <span className="flex items-center gap-1 text-marquee">
                      <span className="text-[11px] leading-none">★</span>
                      {ratingLabel}
                    </span>
                  </>
                )}
              </div>

              {/* meta */}
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
                  <span
                    key={g}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 backdrop-blur-md"
                  >
                    {g.toUpperCase()}
                  </span>
                ))}
              </div>

              {title.synopsis && (
                <p
                  className="cn-rise mt-5 line-clamp-3 max-w-2xl text-[13.5px] leading-relaxed text-muted"
                  style={{ animationDelay: "0.28s" }}
                >
                  {title.synopsis}
                </p>
              )}

              {/* film progress */}
              {isFilm && filmProgress && percent(filmProgress) > 0 && (
                <div className="cn-rise mt-6 max-w-xs" style={{ animationDelay: "0.32s" }}>
                  <div className="h-[2px] bg-white/20">
                    <div className="h-[2px] bg-marquee" style={{ width: `${percent(filmProgress)}%` }} />
                  </div>
                  <div className="mt-2 font-mono text-[10px] tracking-[0.12em] text-muted">
                    {Math.round(percent(filmProgress))}% WATCHED
                  </div>
                </div>
              )}

              {/* actions — pills */}
              <div
                className="cn-rise mt-7 flex flex-wrap items-center gap-2.5"
                style={{ animationDelay: "0.36s" }}
              >
                {playable ? (
                  <Link
                    href={isFilm ? `/watch/${title.id}` : `/watch/${title.id}?ep=${playable.id}`}
                    className="rounded-full bg-marquee px-6 py-3 text-[13px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_12px_34px_-8px_rgba(229,168,61,0.6)]"
                    style={{ transitionTimingFunction: "var(--ease-cine)" }}
                  >
                    ▶ Play
                  </Link>
                ) : (
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 font-mono text-[11px] tracking-[0.12em] text-faint backdrop-blur-md">
                    NO VIDEO UPLOADED YET
                  </span>
                )}

                {playable && (
                  <StartPartyButton
                    titleId={title.id}
                    episodeId={isFilm ? null : playable.id}
                  />
                )}

                <FavoriteButton titleId={title.id} initialFavorited={isFavorited} />

                <Link
                  href="/library"
                  className="rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-[13px] backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.12]"
                  style={{ transitionTimingFunction: "var(--ease-cine)" }}
                >
                  ← Library
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* episodes */}
        {!isFilm && (
          <>
            {seasons.length > 1 && (
              <div className="flex flex-wrap gap-2 px-5 pb-1 pt-7">
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

            <div className="flex items-baseline justify-between border-b border-line px-5 pb-4 pt-6">
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
                          className="rounded-full bg-marquee px-4 py-2 text-[12px] font-semibold text-marquee-ink opacity-0 transition-all duration-400 group-hover:opacity-100"
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