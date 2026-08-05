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

  const { partyId, episodeId } = await request.json();

  if (!partyId || !episodeId) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Only the host can change the episode.
  const { data: party } = await supabase
    .from("parties")
    .select("host_id")
    .eq("id", partyId)
    .maybeSingle();

  if (!party || party.host_id !== user.id) {
    return NextResponse.json({ error: "Only the host can change episodes." }, { status: 403 });
  }

  // Switch the episode and reset playback to the start.
  const { error } = await supabase
    .from("parties")
    .update({
      episode_id: episodeId,
      position_seconds: 0,
      is_playing: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}