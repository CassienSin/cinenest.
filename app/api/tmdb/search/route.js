import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const IMG = "https://image.tmdb.org/t/p";

export async function GET(request) {
  // Only signed-in members can use our API key.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const url =
    `https://api.themoviedb.org/3/search/multi` +
    `?api_key=${process.env.TMDB_API_KEY}` +
    `&query=${encodeURIComponent(query)}` +
    `&include_adult=false&language=en-US&page=1`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    return NextResponse.json(
      { error: "TMDB request failed. Check your API key." },
      { status: 502 }
    );
  }

  const data = await res.json();

  const results = (data.results || [])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .map((item) => {
      const isMovie = item.media_type === "movie";
      const date = isMovie ? item.release_date : item.first_air_date;

      // Japanese animation gets tagged as anime; you can change it on import.
      const isAnime =
        !isMovie &&
        item.origin_country?.includes("JP") &&
        item.genre_ids?.includes(16);

      return {
        tmdbId: item.id,
        mediaType: item.media_type,
        kind: isMovie ? "film" : isAnime ? "anime" : "series",
        name: isMovie ? item.title : item.name,
        originalName: isMovie ? item.original_title : item.original_name,
        year: date ? Number(date.slice(0, 4)) : null,
        synopsis: item.overview || null,
        posterUrl: item.poster_path ? `${IMG}/w500${item.poster_path}` : null,
        backdropUrl: item.backdrop_path ? `${IMG}/w1280${item.backdrop_path}` : null,
        popularity: item.popularity ?? 0,
      };
    })
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 12);

  return NextResponse.json({ results });
}