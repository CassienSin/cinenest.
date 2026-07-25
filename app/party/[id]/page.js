"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VideoPlayer from "@/components/VideoPlayer";
import { useVoiceChat } from "@/components/useVoiceChat";

export default function PartyPage() {
  const { id: partyId } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [me, setMe] = useState(null);
  const [party, setParty] = useState(null);
  const [src, setSrc] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [showEpisodes, setShowEpisodes] = useState(false);

  const videoRef = useRef(null);
  const chatEndRef = useRef(null);
  const applyingRemote = useRef(false);

  const isHost = party && me && party.host_id === me.id;

  const voice = useVoiceChat(partyId, me?.id, voiceOn && Boolean(me));

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

      // load all episodes with video, for the host's picker
      if (partyRow.titles?.kind !== "film") {
        const { data: eps } = await supabase
          .from("episodes")
          .select("id, episode_number, name, video_url, seasons(season_number)")
          .eq("title_id", partyRow.title_id)
          .not("video_url", "is", null)
          .order("episode_number");
        if (active) setEpisodes(eps || []);
      }

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

          setParty((prev) => {
            // Only touch the video source if the episode genuinely changed
            // to a DIFFERENT, valid episode. Never on a play/pause/seek update.
            const episodeChanged =
              prev &&
              next.episode_id &&
              prev.episode_id &&
              next.episode_id !== prev.episode_id;

            if (episodeChanged) {
              const ep = episodes.find((e) => e.id === next.episode_id);
              if (ep?.video_url) setSrc(ep.video_url);
            }
            return { ...prev, ...next };
          });

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
  }, [party?.id, me?.id, isHost, episodes]);

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

  // ── chat: load history + live updates ──
  useEffect(() => {
    if (!me) return;

    supabase
      .from("party_messages")
      .select("id, user_id, username, body, created_at")
      .eq("party_id", partyId)
      .order("created_at")
      .limit(100)
      .then(({ data }) => setMessages(data || []));

    const channel = supabase
      .channel(`chat:${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "party_messages",
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id, partyId]);

  // keep chat scrolled to newest
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── apply the host's state to our video ──
  function applyRemoteState(state) {
    const video = videoRef.current;
    if (!video) return;

    applyingRemote.current = true;

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

  // ── heartbeat: keep the party "alive" while the host is watching ──
  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      // Only bump if the video actually exists and is playing.
      if (video && !video.paused && !video.ended) {
        supabase
          .from("parties")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", partyId)
          .then(() => {});
      }
    }, 120000); // every 2 minutes

    return () => clearInterval(interval);
  }, [isHost, partyId]);

  const handleReady = useCallback(
    (video) => {
      videoRef.current = video;
      if (party && party.host_id !== me?.id) {
        if (party.position_seconds > 2) video.currentTime = party.position_seconds;
        if (party.is_playing) video.play().catch(() => {});
      }
    },
    [party, me?.id]
  );

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

  async function sendMessage(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !me) return;

    setDraft("");
    await supabase.from("party_messages").insert({
      party_id: partyId,
      user_id: me.id,
      username: me.username,
      body,
    });
  }

  async function changeEpisode(episodeId) {
    setShowEpisodes(false);
    await fetch("/api/party/episode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partyId, episodeId }),
    });
  }

  // find current + next episode
  const currentEpId = party?.episode_id;
  const currentIndex = episodes.findIndex((e) => e.id === currentEpId);
  const nextEpisode = currentIndex >= 0 ? episodes[currentIndex + 1] : null;

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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[20px] font-semibold tracking-[-0.5px]">{heading}</h1>
                <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-faint">
                  {isHost
                    ? "YOU'RE HOSTING · YOUR CONTROLS SYNC TO EVERYONE"
                    : "THE HOST CONTROLS PLAYBACK"}
                </p>
              </div>

              {/* host-only episode controls */}
              {isHost && episodes.length > 0 && (
                <div className="flex shrink-0 items-center gap-2">
                  {nextEpisode && (
                    <button
                      onClick={() => changeEpisode(nextEpisode.id)}
                      className="rounded-[4px] bg-marquee px-4 py-2 text-[12px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5"
                      style={{ transitionTimingFunction: "var(--ease-cine)" }}
                    >
                      Next ▶
                    </button>
                  )}
                  <button
                    onClick={() => setShowEpisodes((v) => !v)}
                    className="rounded-[4px] border border-line-strong px-4 py-2 text-[12px] transition-colors hover:border-muted"
                  >
                    Episodes
                  </button>
                </div>
              )}
            </div>

            {/* episode picker dropdown */}
            {isHost && showEpisodes && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-[8px] border border-line">
                {episodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => changeEpisode(ep.id)}
                    className={`flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left text-[13px] transition-colors last:border-b-0 hover:bg-white/[0.03] ${
                      ep.id === currentEpId ? "text-marquee" : ""
                    }`}
                  >
                    <span className="font-mono text-[10px] text-faint">
                      S{String(ep.seasons?.season_number ?? 1).padStart(2, "0")}E
                      {String(ep.episode_number).padStart(2, "0")}
                    </span>
                    <span className="truncate">{ep.name || `Episode ${ep.episode_number}`}</span>
                    {ep.id === currentEpId && (
                      <span className="ml-auto font-mono text-[9px] tracking-[0.1em]">NOW</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* room */}
        <aside className="flex max-h-[70vh] flex-col rounded-[8px] border border-line lg:max-h-[calc(100vh-140px)]">
          <div className="border-b border-line px-4 py-3 font-mono text-[10px] tracking-[0.2em] text-muted">
            IN THE ROOM · {members.length}
          </div>

          <div className="border-b border-line">
            {/* voice controls */}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.2em] text-muted">
                VOICE
              </span>
              {voiceOn ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={voice.toggleMute}
                    className={`rounded-[4px] border px-3 py-1.5 font-mono text-[10px] tracking-[0.1em] transition-all duration-300 ${
                      voice.muted
                        ? "border-alert text-alert"
                        : "border-marquee text-marquee"
                    }`}
                  >
                    {voice.muted ? "🔇 MUTED" : "🎙 LIVE"}
                  </button>
                  <button
                    onClick={() => setVoiceOn(false)}
                    className="rounded-[4px] border border-line-strong px-3 py-1.5 font-mono text-[10px] tracking-[0.1em] text-muted transition-colors hover:text-text"
                  >
                    LEAVE
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setVoiceOn(true)}
                  className="rounded-[4px] bg-marquee px-3.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-marquee-ink transition-all duration-300 hover:-translate-y-0.5"
                  style={{ transitionTimingFunction: "var(--ease-cine)" }}
                >
                  JOIN VOICE
                </button>
              )}
            </div>

            {/* members */}
            <div className="flex flex-col gap-3 px-4 pb-4">
              {members.map((m) => {
                const isMe = m.id === me?.id;
                const isSpeaking = isMe
                  ? voiceOn && !voice.muted
                  : voice.speakingPeers[m.id];

                return (
                  <div key={m.id} className="flex items-center gap-3 text-[13px]">
                    <span
                      className={`relative flex h-7 w-7 items-center justify-center rounded-full bg-[#2A3341] text-[11px] transition-shadow duration-200 ${
                        isSpeaking ? "shadow-[0_0_0_2px_var(--color-marquee)]" : ""
                      }`}
                    >
                      {(m.username || "?").charAt(0).toUpperCase()}
                    </span>
                    <span>
                      {m.username}
                      {isMe ? " (you)" : ""}
                    </span>
                    {m.id === party.host_id && (
                      <span className="ml-auto font-mono text-[9px] tracking-[0.12em] text-marquee">
                        HOST
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* chat */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <p className="font-mono text-[10px] tracking-[0.1em] text-faint">
                  NO MESSAGES YET
                </p>
              )}
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className="font-mono text-[9px] tracking-[0.1em] text-muted">
                    {msg.username?.toUpperCase()}
                  </div>
                  <div className="mt-0.5 text-[13px] leading-snug">{msg.body}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMessage} className="border-t border-line p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Say something…"
                maxLength={500}
                className="w-full rounded-[4px] bg-raised px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-faint focus:ring-1 focus:ring-marquee"
              />
            </form>
          </div>
        </aside>
      </div>
    </main>
  );
}