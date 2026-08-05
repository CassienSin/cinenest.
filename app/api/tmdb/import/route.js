import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const IMG = "https://image.tmdb.org/t/p";
const KEY = () => process.env.TMDB_API_KEY;

async function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `https://api.themoviedb.org/3${path}${sep}api_key=${KEY()}&language=en-US`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`TMDB ${path} failed`);
  return res.json();
}

export async function POST(request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { tmdbId, mediaType, kind } = await request.json();

  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "Missing tmdbId or mediaType." }, { status: 400 });
  }

  // Already imported?
  const { data: existing } = await supabase
    .from("titles")
    .select("id, name")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `"${existing.name}" is already in the library.` },
      { status: 409 }
    );
  }

  try {
    if (mediaType === "movie") {
      const movie = await tmdb(
        `/movie/${tmdbId}?append_to_response=images&include_image_language=en,null`
      );

      const logoPath = movie.images?.logos?.[0]?.file_path || null;

      const { data: inserted, error } = await supabase
        .from("titles")
        .insert({
          kind: "film",
          name: movie.title,
          original_name: movie.original_title,
          year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
          synopsis: movie.overview || null,
          poster_url: movie.poster_path ? `${IMG}/w500${movie.poster_path}` : null,
          backdrop_url: movie.backdrop_path ? `${IMG}/w1280${movie.backdrop_path}` : null,
          logo_url: logoPath ? `${IMG}/w500${logoPath}` : null,
          genres: (movie.genres || []).map((g) => g.name),
          runtime_minutes: movie.runtime || null,
          rating: movie.vote_average ? Math.round(movie.vote_average * 10) / 10 : null,
          tmdb_id: movie.id,
          added_by: user.id,
        })
        .select("id, name")
        .single();

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        name: inserted.name,
        summary: "Film added.",
      });
    }

    // ── TV / anime ──
    const show = await tmdb(
      `/tv/${tmdbId}?append_to_response=images&include_image_language=en,null`
    );

    const showLogoPath = show.images?.logos?.[0]?.file_path || null;

    const { data: title, error: titleError } = await supabase
      .from("titles")
      .insert({
        kind: kind === "anime" || kind === "donghua" ? kind : "series",
        name: show.name,
        original_name: show.original_name,
        year: show.first_air_date ? Number(show.first_air_date.slice(0, 4)) : null,
        synopsis: show.overview || null,
        poster_url: show.poster_path ? `${IMG}/w500${show.poster_path}` : null,
        backdrop_url: show.backdrop_path ? `${IMG}/w1280${show.backdrop_path}` : null,
        logo_url: showLogoPath ? `${IMG}/w500${showLogoPath}` : null,
        genres: (show.genres || []).map((g) => g.name),
        rating: show.vote_average ? Math.round(show.vote_average * 10) / 10 : null,
        tmdb_id: show.id,
        added_by: user.id,
      })
      .select("id, name")
      .single();

    if (titleError) throw titleError;

    // Skip season 0 (specials).
    const seasons = (show.seasons || []).filter((s) => s.season_number > 0);
    let episodeCount = 0;

    for (const season of seasons) {
      const { data: savedSeason, error: seasonError } = await supabase
        .from("seasons")
        .insert({
          title_id: title.id,
          season_number: season.season_number,
          name: season.name,
        })
        .select("id")
        .single();

      if (seasonError) throw seasonError;

      const detail = await tmdb(`/tv/${tmdbId}/season/${season.season_number}`);

      const episodes = (detail.episodes || []).map((ep) => ({
        title_id: title.id,
        season_id: savedSeason.id,
        episode_number: ep.episode_number,
        name: ep.name || null,
        synopsis: ep.overview || null,
        still_url: ep.still_path ? `${IMG}/w500${ep.still_path}` : null,
        runtime_minutes: ep.runtime || null,
      }));

      if (episodes.length) {
        const { error: epError } = await supabase.from("episodes").insert(episodes);
        if (epError) throw epError;
        episodeCount += episodes.length;
      }
    }

    return NextResponse.json({
      ok: true,
      name: title.name,
      summary: `${seasons.length} season${seasons.length === 1 ? "" : "s"}, ${episodeCount} episodes added.`,
    });
  } catch (err) {
    console.error("Import failed:", err);
    return NextResponse.json(
      { error: err.message || "Import failed." },
      { status: 500 }
    );
  }
}