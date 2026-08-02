import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LibrarySearch from "@/components/LibrarySearch";
import UserAvatar from "@/components/UserAvatar";

const FILTERS = [
  { key: "all", label: "ALL" },
  { key: "film", label: "FILMS" },
  { key: "series", label: "SERIES" },
  { key: "anime", label: "ANIME" },
];

function metaLine(title) {
  const parts = [title.kind.toUpperCase()];
  if (title.year) parts.push(title.year);

  if (title.kind === "film") {
    if (title.runtime_minutes) parts.push(`${title.runtime_minutes} MIN`);
  } else {
    const count = title.episodes?.[0]?.count ?? 0;
    if (count) parts.push(`${count} EPISODES`);
  }
  return parts.join(" · ");
}

export default async function LibraryPage({ searchParams }) {
  const params = await searchParams;
  const kind = params?.kind || "all";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, is_admin")
    .eq("id", user.id)
    .single();

  let query = supabase
    .from("titles")
    .select(
      "id, name, kind, year, poster_url, backdrop_url, logo_url, runtime_minutes, genres, episodes(count)"
    )
    .order("created_at", { ascending: false });

  if (kind !== "all") query = query.eq("kind", kind);

  const { data: titles } = await query;
  const all = titles || [];
  const featured = all.slice(0, 6);

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
          <div className="border-r border-line px-5 py-3.5">library</div>
          <Link href="/profile" className="flex items-center justify-between px-5 py-3.5 text-muted transition-colors hover:text-text">
            {profile?.username}
            <UserAvatar avatarUrl={profile?.avatar_url} username={profile?.username} />
          </Link>
        </nav>

        {/* header */}
        <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
          <span className="text-[15px] font-semibold tracking-[-0.3px]">library</span>
          <span className="font-mono text-[10px] tracking-[0.15em] text-muted">
            {all.length} TITLE{all.length === 1 ? "" : "S"}
          </span>
        </div>

        {/* search */}
        <LibrarySearch />

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/library" : `/library?kind=${f.key}`}
              className={`rounded-full border px-3.5 py-1.5 font-mono text-[10px] tracking-[0.12em] transition-all duration-300 ${
                kind === f.key
                  ? "border-marquee bg-marquee font-medium text-marquee-ink"
                  : "border-line text-muted hover:border-line-strong hover:text-text"
              }`}
            >
              {f.label}
            </Link>
          ))}

          {profile?.is_admin && (
            <Link
              href="/admin/add"
              className="ml-auto font-mono text-[10px] tracking-[0.12em] text-marquee transition-opacity hover:opacity-70"
            >
              ＋ ADD TITLE
            </Link>
          )}
        </div>

        {all.length === 0 ? (
          <div className="px-5 py-20 text-center">
            <p className="font-mono text-[11px] tracking-[0.15em] text-muted">
              NOTHING HERE YET
            </p>
            {profile?.is_admin && (
              <Link
                href="/admin/add"
                className="mt-4 inline-block rounded-[4px] bg-marquee px-5 py-2.5 text-[13px] font-semibold text-marquee-ink"
              >
                Add your first title
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* filmstrip */}
            <div className="cn-strip">
              {featured.map((t, i) => (
                <Link key={t.id} href={`/title/${t.id}`} className="cn-pane">
                  {t.backdrop_url || t.poster_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.backdrop_url || t.poster_url}
                      alt={t.name}
                      className="cn-pane-img"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-raised" />
                  )}
                  <div className="cn-pane-shade" />

                  <div className="cn-pane-idx absolute left-4 top-3 font-mono text-[10px] text-white/45">
                    {String(i + 1).padStart(3, "0")}
                  </div>

                  <div className="cn-pane-label absolute bottom-4 left-4 whitespace-nowrap text-[13px] font-medium">
                    {t.name}
                  </div>

                  <div className="cn-pane-detail absolute bottom-4 left-4 right-4">
                    {t.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.logo_url}
                        alt={t.name}
                        className="max-h-[58px] w-auto max-w-[230px] object-contain object-left"
                        style={{ filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.85))" }}
                      />
                    ) : (
                      <div className="whitespace-nowrap text-[19px] font-semibold leading-tight tracking-[-0.5px]">
                        {t.name}
                      </div>
                    )}
                    <div className="mt-1.5 whitespace-nowrap font-mono text-[10px] text-muted">
                      {metaLine(t)}
                    </div>
                    <span className="mt-3 inline-block whitespace-nowrap rounded-[4px] bg-marquee px-4 py-2 text-[11.5px] font-semibold text-marquee-ink">
                      ▶ Open
                    </span>
                  </div>

                  <div className="cn-pane-glow" />
                </Link>
              ))}
            </div>

            {/* full grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {all.map((t, i) => (
                <Link
                  key={t.id}
                  href={`/title/${t.id}`}
                  className="cn-card cn-rise border-b border-r border-line p-4"
                  style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}
                >
                  <div className="mb-3 aspect-[2/3] overflow-hidden rounded-[4px] bg-raised">
                    {t.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.poster_url}
                        alt={t.name}
                        className="cn-card-img h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center font-mono text-[10px] text-faint">
                        NO POSTER
                      </div>
                    )}
                  </div>
                  <div className="text-[13px] font-medium leading-tight">{t.name}</div>
                  <div className="mt-1 font-mono text-[10px] text-muted">{metaLine(t)}</div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}