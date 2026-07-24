"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VideoPlayer from "@/components/VideoPlayer";

export default function PartyPage() {
  const { id: partyId } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [me, setMe] = useState(null);
  const [party, setParty] = useState(null);
  const [src, setSrc] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const isHost = party && me && party.host_id === me.id;
  const applyingRemote = useRef(false); // stops echo loops

  // ── load everything ──
  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", user.id)
        .single();

      const { data: partyRow } = await supabase
        .from("parties")
        .select(
          "id, host_id, title_id, episode_id, is_playing, position_seconds, titles(name, kind, video_url), episodes(episode_number, name, video_url)"
        )
        .eq("id", partyId)
        .maybeSingle();

      if (!active) return;

      if (!partyRow) {
        setError("This party has ended.");
        setLoading(false);
        return;
      }

      const videoUrl = partyRow.episodes
        ? partyRow.episodes.video_url
        : partyRow.titles?.video_url;

      setMe(profile);
      setParty(partyRow);
      setSrc(videoUrl);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [partyId]);

  // ── subscribe to party state changes (guests follow host) ──
  useEffect(() => {
    if (!party || !me) return;

    const channel = supabase
      .channel(`party:${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "parties",
          filter: `id=eq.${partyId}`,
        },
        (payload) => {
          const next = payload.new;
          setParty((prev) => ({ ...prev, ...next }));

          // The host drives — it never applies state to itself.
          if (isHost) return;
          applyRemoteState(next);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "parties",
          filter: `id=eq.${partyId}`,
        },
        () => setError("The host ended the party.")
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [party?.id, me?.id]);

  // ── presence: who's in the room ──
  useEffect(() => {
    if (!me) return;

    const presence = supabase.channel(`presence:${partyId}`, {
      config: { presence: { key: me.id } },
    });

    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState();
        const people = Object.values(state)
          .flat()
          .map((p) => ({ id: p.id, username: p.username }));
        setMembers(people);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({ id: me.id, username: me.username });
        }
      });

    return () => {
      supabase.removeChannel(presence);
    };
  }, [me?.id, partyId]);

  // ── apply the host's state to our video ──
  function applyRemoteState(state) {
    const video = videoRef.current;
    if (!video) return;

    applyingRemote.current = true;

    // Match position if we've drifted more than 1.5s.
    if (Math.abs(video.currentTime - state.position_seconds) > 1.5) {
      video.currentTime = state.position_seconds;
    }

    if (state.is_playing && video.paused) {
      video.play().catch(() => {});
    } else if (!state.is_playing && !video.paused) {
      video.pause();
    }

    setTimeout(() => {
      applyingRemote.current = false;
    }, 400);
  }

  // ── host broadcasts its state ──
  const pushState = useCallback(
    async (isPlaying, position) => {
      if (!isHost) return;
      await supabase
        .from("parties")
        .update({
          is_playing: isPlaying,
          position_seconds: Math.floor(position),
          updated_at: new Date().toISOString(),
        })
        .eq("id", partyId);
    },
    [isHost, partyId]
  );

  const handleReady = useCallback((video) => {
    videoRef.current = video;
    // Guests jump to the host's current position on join.
    if (party && party.host_id !== me?.id) {
      if (party.position_seconds > 2) video.currentTime = party.position_seconds;
      if (party.is_playing) video.play().catch(() => {});
    }
  }, [party, me?.id]);

  const handlePlayState = useCallback(
    (isPlaying, position) => {
      if (applyingRemote.current) return;
      pushState(isPlaying, position);
    },
    [pushState]
  );

  const handleSeek = useCallback(
    (position) => {
      if (applyingRemote.current) return;
      pushState(party?.is_playing || false, position);
    },
    [pushState, party?.is_playing]
  );

  async function endParty() {
    if (isHost) {
      await supabase.from("parties").delete().eq("id", partyId);
    }
    router.push("/");
  }

  // ── render ──
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <span className="font-mono text-[11px] tracking-[0.2em] text-muted">
          JOINING PARTY…
        </span>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink">
        <span className="font-mono text-[11px] tracking-[0.15em] text-alert">{error}</span>
        <Link
          href="/"
          className="rounded-[4px] bg-marquee px-5 py-2.5 text-[13px] font-semibold text-marquee-ink"
        >
          Back home
        </Link>
      </main>
    );
  }

  const heading = party.episodes
    ? `${party.titles?.name} — E${String(party.episodes.episode_number).padStart(2, "0")}`
    : party.titles?.name;

  return (
    <main className="min-h-screen bg-ink">
      <nav className="flex items-center justify-between border-b border-line px-5 py-3.5 text-[13px]">
        <button onClick={endParty} className="text-muted transition-colors hover:text-text">
          ← {isHost ? "End party" : "Leave"}
        </button>
        <span className="font-semibold tracking-[-0.3px]">
          cinenest<span className="text-marquee">.</span>
        </span>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1fr_240px]">
        <div>
          {src ? (
            <VideoPlayer
              src={src}
              titleId={party.title_id}
              episodeId={party.episode_id}
              startPosition={party.position_seconds}
              onVideoReady={handleReady}
              onPlayStateChange={handlePlayState}
              onSeek={handleSeek}
              disableProgressSave={!isHost}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-[6px] border border-line bg-raised">
              <span className="font-mono text-[11px] text-muted">NO VIDEO FOR THIS TITLE</span>
            </div>
          )}

          <div className="mt-5">
            <h1 className="text-[20px] font-semibold tracking-[-0.5px]">{heading}</h1>
            <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-faint">
              {isHost
                ? "YOU'RE HOSTING · YOUR CONTROLS SYNC TO EVERYONE"
                : "THE HOST CONTROLS PLAYBACK"}
            </p>
          </div>
        </div>

        {/* room */}
        <aside className="rounded-[8px] border border-line">
          <div className="border-b border-line px-4 py-3 font-mono text-[10px] tracking-[0.2em] text-muted">
            IN THE ROOM · {members.length}
          </div>
          <div className="flex flex-col gap-3 p-4">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 text-[13px]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2A3341] text-[11px]">
                  {(m.username || "?").charAt(0).toUpperCase()}
                </span>
                <span>{m.username}</span>
                {m.id === party.host_id && (
                  <span className="ml-auto font-mono text-[9px] tracking-[0.12em] text-marquee">
                    HOST
                  </span>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}