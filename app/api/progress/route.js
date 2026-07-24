import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json();
  const { titleId, episodeId, position, duration } = body;

  if (!titleId || typeof position !== "number") {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  // Treat the last 8% as "finished".
  const completed =
    duration > 0 ? position >= duration * 0.92 : false;

  const { error } = await supabase.from("watch_progress").upsert(
    {
      user_id: user.id,
      title_id: titleId,
      episode_id: episodeId || null,
      position_seconds: Math.floor(position),
      duration_seconds: duration ? Math.floor(duration) : null,
      completed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,title_id,episode_id" }
  );

  if (error) {
    console.error("Progress save failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}