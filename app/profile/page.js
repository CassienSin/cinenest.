import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileForm from "@/components/ProfileForm";
import AvatarUploader from "@/components/AvatarUploader";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, is_admin, created_at")
    .eq("id", user.id)
    .single();

  const [{ count: watchedCount }, { count: favCount }, { data: favTitles }, { data: continueRows }] =
    await Promise.all([
      supabase
        .from("watch_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("completed", true),
      supabase
        .from("favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("favorites")
        .select("titles(id, name, poster_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("watch_progress")
        .select("position_seconds, duration_seconds, titles(id, name, poster_url)")
        .eq("user_id", user.id)
        .eq("completed", false)
        .gt("position_seconds", 10)
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);

  const favorites = (favTitles || []).map((f) => f.titles).filter(Boolean);
  const continuing = (continueRows || []).filter((r) => r.titles);

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "—";

  const name = profile?.display_name || profile?.username;

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
          <Link href="/" className="border-r border-line px-5 py-3.5 text-muted transition-colors hover:text-text">
            home
          </Link>
          <Link href="/library" className="border-r border-line px-5 py-3.5 text-muted transition-colors hover:text-text">
            library
          </Link>
          <div className="px-5 py-3.5 text-marquee">profile</div>
        </nav>

        {/* header card */}
        <section className="border-b border-line px-5 py-10">
          <div className="cn-rise font-mono text-[11px] tracking-[0.2em] text-muted">
            YOUR SEAT
          </div>

          <div className="cn-rise mt-5 flex items-center gap-5" style={{ animationDelay: "0.1s" }}>
            <AvatarUploader avatarUrl={profile?.avatar_url} username={profile?.username} />

            <div>
              <div className="text-[24px] font-semibold tracking-[-0.6px]">{name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted">
                <span>@{profile?.username}</span>
                {profile?.is_admin && (
                  <span className="rounded-full border border-marquee px-2 py-0.5 text-marquee">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="mt-1.5 font-mono text-[10px] tracking-[0.08em] text-faint">
                MEMBER SINCE {joined.toUpperCase()}
              </div>
            </div>
          </div>

          {/* stats */}
          <div
            className="cn-rise mt-8 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-line bg-line"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="bg-ink px-4 py-4 text-center">
              <div className="text-[22px] font-semibold text-marquee">{watchedCount ?? 0}</div>
              <div className="mt-1 font-mono text-[9px] tracking-[0.1em] text-muted">WATCHED</div>
            </div>
            <div className="bg-ink px-4 py-4 text-center">
              <div className="text-[22px] font-semibold text-marquee">{favCount ?? 0}</div>
              <div className="mt-1 font-mono text-[9px] tracking-[0.1em] text-muted">FAVORITES</div>
            </div>
          </div>

          {profile?.is_admin && (
            <div className="cn-rise mt-5 flex flex-wrap gap-2.5" style={{ animationDelay: "0.26s" }}>
              <Link
                href="/admin/add"
                className="rounded-full border border-line-strong px-4 py-2 font-mono text-[10px] tracking-[0.1em] text-muted transition-colors hover:border-marquee hover:text-marquee"
              >
                ADD TITLE
              </Link>
              <Link
                href="/admin/upload"
                className="rounded-full border border-line-strong px-4 py-2 font-mono text-[10px] tracking-[0.1em] text-muted transition-colors hover:border-marquee hover:text-marquee"
              >
                UPLOAD VIDEO
              </Link>
            </div>
          )}
        </section>

        {/* continue watching preview */}
        {continuing.length > 0 && (
          <section className="border-b border-line px-5 py-6">
            <div className="text-[13px] font-medium">Pick up where you left off</div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {continuing.map((row) => {
                const t = row.titles;
                const pct = row.duration_seconds
                  ? Math.min(100, (row.position_seconds / row.duration_seconds) * 100)
                  : 0;
                return (
                  <Link
                    key={t.id}
                    href={`/title/${t.id}`}
                    className="w-[90px] shrink-0 transition-transform duration-400 hover:-translate-y-1"
                    style={{ transitionTimingFunction: "var(--ease-cine)" }}
                  >
                    <div className="aspect-[2/3] overflow-hidden rounded-[6px] bg-raised">
                      {t.poster_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.poster_url} alt={t.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="mt-1.5 h-[2px] bg-line">
                      <div className="h-[2px] bg-marquee" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* favorites preview */}
        {favorites.length > 0 && (
          <section className="border-b border-line px-5 py-6">
            <div className="flex items-baseline justify-between">
              <div className="text-[13px] font-medium">Your favorites</div>
              <Link
                href="/library?kind=favorites"
                className="font-mono text-[10px] tracking-[0.1em] text-marquee transition-opacity hover:opacity-70"
              >
                SEE ALL →
              </Link>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {favorites.map((t) => (
                <Link
                  key={t.id}
                  href={`/title/${t.id}`}
                  className="w-[90px] shrink-0 transition-transform duration-400 hover:-translate-y-1"
                  style={{ transitionTimingFunction: "var(--ease-cine)" }}
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-[6px] bg-raised">
                    {t.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.poster_url} alt={t.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* edit form */}
        <section className="px-5 py-9">
          <ProfileForm
            initialDisplayName={profile?.display_name || ""}
            username={profile?.username}
          />
        </section>
      </div>
    </main>
  );
}