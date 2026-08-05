import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import VideoPlayer from "@/components/VideoPlayer";

export default async function WatchPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const episodeParam = sp?.ep || null;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: title } = await supabase
    .from("titles")
    .select("id, name, kind, video_url")
    .eq("id", id)
    .maybeSingle();

  if (!title) notFound();

  const isFilm = title.kind === "film";

  let episode = null;
  let nextEpisode = null;

  if (!isFilm) {
    if (episodeParam) {
      const { data } = await supabase
        .from("episodes")
        .select("id, episode_number, name, video_url, season_id")
        .eq("id", episodeParam)
        .maybeSingle();
      episode = data;
    }

    if (!episode) {
      const { data } = await supabase
        .from("episodes")
        .select("id, episode_number, name, video_url, season_id")
        .eq("title_id", id)
        .not("video_url", "is", null)
        .order("episode_number")
        .limit(1)
        .maybeSingle();
      episode = data;
    }

    if (episode) {
      const { data } = await supabase
        .from("episodes")
        .select("id")
        .eq("season_id", episode.season_id)
        .not("video_url", "is", null)
        .gt("episode_number", episode.episode_number)
        .order("episode_number")
        .limit(1)
        .maybeSingle();
      nextEpisode = data;
    }
  }

  const src = isFilm ? title.video_url : episode?.video_url;

  // resume position
  let startPosition = 0;

  if (src) {
    let q = supabase
      .from("watch_progress")
      .select("position_seconds, completed")
      .eq("user_id", user.id)
      .eq("title_id", id);

    q = episode ? q.eq("episode_id", episode.id) : q.is("episode_id", null);

    const { data: progress } = await q.maybeSingle();
    if (progress && !progress.completed) startPosition = progress.position_seconds || 0;
  }

  const heading = isFilm
    ? title.name
    : `${title.name} — E${String(episode?.episode_number ?? 1).padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-ink">
      <nav className="flex items-center justify-between border-b border-line px-5 py-3.5 text-[13px]">
        <Link href={`/title/${title.id}`} className="text-muted transition-colors hover:text-text">
          ← Back
        </Link>
        <span className="font-semibold tracking-[-0.3px]">
          cinenest<span className="text-marquee">.</span>
        </span>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {src ? (
          <VideoPlayer
            src={src}
            titleId={title.id}
            episodeId={episode?.id || null}
            startPosition={startPosition}
            nextHref={nextEpisode ? `/watch/${title.id}?ep=${nextEpisode.id}` : null}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-[6px] border border-line bg-raised">
            <span className="font-mono text-[11px] tracking-[0.15em] text-muted">
              NO VIDEO UPLOADED FOR THIS ONE YET
            </span>
          </div>
        )}

        <div className="mt-5">
          <h1 className="text-[20px] font-semibold tracking-[-0.5px]">{heading}</h1>
          {episode?.name && (
            <p className="mt-1 text-[13px] text-muted">{episode.name}</p>
          )}
          <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-faint">
            SPACE PLAY/PAUSE · ← → SKIP 10S · F FULLSCREEN · M MUTE
          </p>
        </div>
      </div>
    </main>
  );
}