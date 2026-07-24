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

  const { titleId, episodeId } = await request.json();

  if (!titleId) {
    return NextResponse.json({ error: "Missing titleId." }, { status: 400 });
  }

  // Resume from where the host left off, if anywhere.
  let startPosition = 0;
  {
    let q = supabase
      .from("watch_progress")
      .select("position_seconds, completed")
      .eq("user_id", user.id)
      .eq("title_id", titleId);

    q = episodeId ? q.eq("episode_id", episodeId) : q.is("episode_id", null);

    const { data } = await q.maybeSingle();
    if (data && !data.completed) startPosition = data.position_seconds || 0;
  }

  const { data: party, error } = await supabase
    .from("parties")
    .insert({
      host_id: user.id,
      title_id: titleId,
      episode_id: episodeId || null,
      is_playing: false,
      position_seconds: startPosition,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Party create failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, partyId: party.id });
}