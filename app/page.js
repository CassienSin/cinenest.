import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import LivePartyBar from "@/components/LivePartyBar";

function timeLeft(position, duration) {
  if (!duration) return null;
  const left = Math.max(0, duration - position);
  if (left < 60) return "ALMOST DONE";
  const h = Math.floor(left / 3600);
  const m = Math.round((left % 3600) / 60);
  return h ? `${h}H ${m}M LEFT` : `${m} MIN LEFT`;
}

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, is_admin")
    .eq("id", user.id)
    .single();

  // in-progress watches
  const { data: progressRows } = await supabase
    .from("watch_progress")
    .select(
      "position_seconds, duration_seconds, updated_at, titles(id, name, kind, year, poster_url, backdrop_url, logo_url, rating), episodes(id, episode_number, name, still_url)"
    )
    .eq("user_id", user.id)
    .eq("completed", false)
    .gt("position_seconds", 10)
    .order("updated_at", { ascending: false })
    .limit(6);

  const continueList = (progressRows || []).filter((r) => r.titles);

  // newest in the library
  const { data: recent } = await supabase
    .from("titles")
    .select("id, name, kind, year, poster_url, backdrop_url, logo_url, rating")
    .order("created_at", { ascending: false })
    .limit(12);

  const recentList = recent || [];

  // hero = what you were last watching, else newest title
  const heroProgress = continueList[0] || null;
  const hero = heroProgress?.titles || recentList[0] || null;

  // If there's progress, always go to the player — episode if it's a series,
  // the film itself otherwise. Only fall back to the details page when there's
  // nothing to resume.
  const heroHref = hero
    ? heroProgress
      ? heroProgress.episodes
        ? `/watch/${hero.id}?ep=${heroProgress.episodes.id}`
        : `/watch/${hero.id}`
      : `/title/${hero.id}`
    : null;

  const heroImage = hero ? hero.backdrop_url || hero.poster_url || null : null;

  const heroRating =
    typeof hero?.rating === "number" && hero.rating > 0 ? hero.rating.toFixed(1) : null;

  const heroPct =
    heroProgress?.duration_seconds
      ? Math.min(100, (heroProgress.position_seconds / heroProgress.duration_seconds) * 100)
      : 0;

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
  }

  const name = profile?.display_name || profile?.username || "member";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="cn-bloom" />
      <div className="cn-grain" />

      <div className="relative z-10">
        {/* nav */}
        <nav className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-line text-[13px]">
          <div className="border-r border-line px-5 py-3.5 font-semibold tracking-[-0.3px]">
            cinenest<span className="text-marquee">.</span>
          </div>
          <div className="border-r border-line px-5 py-3.5">home</div>
          <Link href="/library" className="border-r border-line px-5 py-3.5 text-muted transition-colors hover:text-text">
            library
          </Link>
          <Link href="/profile" className="flex items-center justify-between px-5 py-3.5 text-muted transition-colors hover:text-text">
            {profile?.username}
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#2A3341] text-[10px] text-text">
              {name.charAt(0).toUpperCase()}
            </span>
          </Link>
        </nav>

        {/* ── hero: framed backdrop, content anchored bottom-left ── */}
        {hero ? (
          <section className="px-3 pt-3 md:px-4 md:pt-4">
            <div className="relative flex min-h-[380px] flex-col justify-end overflow-hidden rounded-[10px] border border-line sm:min-h-[440px] md:min-h-[520px] lg:min-h-[580px]">
              {heroImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-[center_22%]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/25 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 bg-raised" />
              )}

              <div className="relative px-5 pb-8 pt-28 sm:px-7 md:px-10 md:pb-11">
                <div className="cn-rise font-mono text-[10.5px] tracking-[0.2em] text-muted">
                  001 — {heroProgress ? "CONTINUE WATCHING" : "NOW SHOWING"}
                </div>

                {hero.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hero.logo_url}
                    alt={hero.name}
                    className="cn-rise mt-4 h-auto max-h-[88px] w-auto max-w-[270px] object-contain object-left sm:max-h-[104px] sm:max-w-[330px] md:mt-5 md:max-h-[130px] md:max-w-[430px]"
                    style={{
                      animationDelay: "0.1s",
                      filter: "drop-shadow(0 6px 24px rgba(0,0,0,0.85))",
                    }}
                  />
                ) : (
                  <h1
                    className="cn-rise mt-3 max-w-3xl text-[32px] font-semibold leading-[1.04] tracking-[-1.2px] md:text-[44px]"
                    style={{
                      animationDelay: "0.1s",
                      textShadow: "0 4px 22px rgba(0,0,0,0.8)",
                    }}
                  >
                    {hero.name}
                  </h1>
                )}

                <div
                  className="cn-rise mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-mono text-[10px] tracking-[0.1em] text-muted"
                  style={{ animationDelay: "0.18s" }}
                >
                  {heroProgress?.episodes && (
                    <>
                      <span className="text-text">
                        E{String(heroProgress.episodes.episode_number).padStart(2, "0")}
                      </span>
                      <span className="text-faint">/</span>
                    </>
                  )}
                  <span>{(hero.kind || "title").toUpperCase()}</span>
                  {hero.year && (
                    <>
                      <span className="text-faint">/</span>
                      <span>{hero.year}</span>
                    </>
                  )}
                  {heroRating && (
                    <>
                      <span className="text-faint">/</span>
                      <span className="flex items-center gap-1 text-marquee">
                        <span className="text-[11px] leading-none">★</span>
                        {heroRating}
                      </span>
                    </>
                  )}
                </div>

                {/* how far you got — the reason this title is the hero */}
                {heroProgress && heroPct > 0 && (
                  <div className="cn-rise mt-5 max-w-xs" style={{ animationDelay: "0.22s" }}>
                    <div className="h-[2px] bg-white/20">
                      <div className="h-[2px] bg-marquee" style={{ width: `${heroPct}%` }} />
                    </div>
                    <div className="mt-2 font-mono text-[10px] tracking-[0.12em] text-muted">
                      {timeLeft(heroProgress.position_seconds, heroProgress.duration_seconds) ||
                        "IN PROGRESS"}
                    </div>
                  </div>
                )}

                <div
                  className="cn-rise mt-7 flex flex-wrap items-center gap-2.5"
                  style={{ animationDelay: "0.26s" }}
                >
                  <Link
                    href={heroHref}
                    className="rounded-full bg-marquee px-6 py-3 text-[13px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_12px_34px_-8px_rgba(229,168,61,0.6)]"
                    style={{ transitionTimingFunction: "var(--ease-cine)" }}
                  >
                    ▶ {heroProgress ? "Resume" : "Play"}
                  </Link>
                  <Link
                    href={`/title/${hero.id}`}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-[13px] backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.12]"
                    style={{ transitionTimingFunction: "var(--ease-cine)" }}
                  >
                    Details
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="border-b border-line px-5 py-20 text-center">
            <div className="font-mono text-[11px] tracking-[0.2em] text-muted">
              THE NEST IS EMPTY
            </div>
            <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-faint">
              {profile?.is_admin
                ? "Import a film or series from TMDB and it'll show up here."
                : "Nothing's been added yet. Check back once your admin stocks the library."}
            </p>
            {profile?.is_admin && (
              <Link
                href="/admin/add"
                className="mt-6 inline-block rounded-full bg-marquee px-6 py-3 text-[13px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5"
                style={{ transitionTimingFunction: "var(--ease-cine)" }}
              >
                Add your first title
              </Link>
            )}
          </section>
        )}

        {/* live parties */}
        <LivePartyBar meId={user.id} />

        {/* continue watching */}
        {continueList.length > 0 && (
          <section className="border-b border-line">
            <div className="px-5 pb-4 pt-7 text-[14px] font-medium">Continue watching</div>

            <div className="grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-3">
              {continueList.map((row, i) => {
                const t = row.titles;
                const ep = row.episodes;
                const pct = row.duration_seconds
                  ? Math.min(100, (row.position_seconds / row.duration_seconds) * 100)
                  : 0;
                const still = ep?.still_url || t.backdrop_url || t.poster_url;

                return (
                  <Link
                    key={`${t.id}-${ep?.id || "film"}`}
                    href={ep ? `/watch/${t.id}?ep=${ep.id}` : `/watch/${t.id}`}
                    className="cn-card cn-rise group border-b border-r border-line p-4 transition-colors duration-400 hover:bg-white/[0.022]"
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    <div className="font-mono text-[10px] text-faint">
                      {String(i + 2).padStart(3, "0")}
                    </div>

                    <div className="relative mt-2 aspect-video overflow-hidden rounded-[4px] bg-raised">
                      {still ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={still} alt="" className="cn-card-img h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center font-mono text-[10px] text-faint">
                          NO STILL
                        </div>
                      )}

                      {/* resume affordance, on hover */}
                      <div className="absolute inset-0 flex items-center justify-center bg-ink/45 opacity-0 transition-opacity duration-400 group-hover:opacity-100">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-marquee text-[15px] text-marquee-ink">
                          ▶
                        </span>
                      </div>
                    </div>

                    <div className="mt-0.5 h-[2px] bg-line">
                      <div className="h-[2px] bg-marquee" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="mt-2 text-[13px] font-medium">{t.name}</div>
                    <div className="mt-1 font-mono text-[10px] text-muted">
                      {ep ? `E${String(ep.episode_number).padStart(2, "0")} · ` : ""}
                      {timeLeft(row.position_seconds, row.duration_seconds) || "IN PROGRESS"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* recently added */}
        {recentList.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between px-5 pb-4 pt-7">
              <span className="text-[14px] font-medium">Recently added</span>
              <Link href="/library" className="font-mono text-[10px] tracking-[0.12em] text-marquee transition-opacity hover:opacity-70">
                SEE ALL →
              </Link>
            </div>

            <div className="grid grid-cols-2 border-t border-line sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {recentList.map((t, i) => {
                const cardRating =
                  typeof t.rating === "number" && t.rating > 0 ? t.rating.toFixed(1) : null;

                return (
                  <Link
                    key={t.id}
                    href={`/title/${t.id}`}
                    className="cn-card cn-rise border-b border-r border-line p-4"
                    style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}
                  >
                    <div className="relative mb-3 aspect-[2/3] overflow-hidden rounded-[4px] bg-raised">
                      {t.poster_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.poster_url} alt={t.name} className="cn-card-img h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center font-mono text-[10px] text-faint">
                          NO POSTER
                        </div>
                      )}

                      {cardRating && (
                        <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink/75 px-2 py-1 font-mono text-[9.5px] tracking-[0.06em] text-marquee backdrop-blur-md">
                          <span className="text-[10px] leading-none">★</span>
                          {cardRating}
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] font-medium leading-tight">{t.name}</div>
                    <div className="mt-1 font-mono text-[10px] text-muted">
                      {(t.kind || "title").toUpperCase()}
                      {t.year ? ` · ${t.year}` : ""}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* footer */}
        <div className="flex items-center justify-between border-t border-line px-5 py-4">
          <span className="font-mono text-[10px] tracking-[0.15em] text-faint">
            CINENEST © 2026
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-[10px] tracking-[0.12em] text-muted transition-colors hover:text-text"
            >
              SIGN OUT
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}