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
  if (!res.ok) return null;
  return res.json();
}

export async function POST() {
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

  // titles that have a tmdb_id but no logo yet
  const { data: titles } = await supabase
    .from("titles")
    .select("id, kind, tmdb_id, rating")
    .is("logo_url", null)
    .not("tmdb_id", "is", null);

  let updated = 0;

  for (const t of titles || []) {
    const endpoint = t.kind === "film" ? "movie" : "tv";
    const data = await tmdb(
      `/${endpoint}/${t.tmdb_id}?append_to_response=images&include_image_language=en,null`
    );
    if (!data) continue;

    const logoPath = data.images?.logos?.[0]?.file_path || null;

    const patch = {};
    if (logoPath) patch.logo_url = `${IMG}/w500${logoPath}`;
    if (t.rating == null && data.vote_average) {
      patch.rating = Math.round(data.vote_average * 10) / 10;
    }

    if (Object.keys(patch).length) {
      await supabase.from("titles").update(patch).eq("id", t.id);
      updated += 1;
    }
  }

  return NextResponse.json({ ok: true, updated });
}