"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Hls from "hls.js";

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = h ? String(m).padStart(2, "0") : m;
  return h ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

export default function VideoPlayer({
  src,
  titleId,
  episodeId = null,
  startPosition = 0,
  nextHref = null,
  onVideoReady = null,
  onPlayStateChange = null,
  onSeek = null,
  disableProgressSave = false,
}) {

  const router = useRouter();
  const videoRef = useRef(null);
  const shellRef = useRef(null);
  const hideTimer = useRef(null);
  const lastSaved = useRef(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // ── save progress ──
  const saveProgress = useCallback(
    (position, total, beacon = false) => {
      if (!position || !titleId) return;

      const payload = JSON.stringify({
        titleId,
        episodeId,
        position,
        duration: total || 0,
      });

      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/progress",
          new Blob([payload], { type: "application/json" })
        );
      } else {
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    },
    [titleId, episodeId]
  );

  // ── load the stream ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // If this exact source is already loaded, don't rebuild the player.
    if (video.dataset.loadedSrc === src) return;
    video.dataset.loadedSrc = src;

    let hls;

    const onLoaded = () => {
      setReady(true);
      if (startPosition > 5) video.currentTime = startPosition;
      if (onVideoReady) onVideoReady(video);
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / iOS play HLS natively
      video.src = src;
      video.addEventListener("loadedmetadata", onLoaded);
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, onLoaded);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else setError("This video couldn't be loaded.");
      });
    } else {
      setError("Your browser doesn't support HLS playback.");
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      if (hls) hls.destroy();
    };
  }, [src, startPosition]);

  // ── video events ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
        setCurrent(video.currentTime);
        if (video.buffered.length) {
          setBuffered(video.buffered.end(video.buffered.length - 1));
        }
        if (!disableProgressSave && Math.abs(video.currentTime - lastSaved.current) > 10) {
          lastSaved.current = video.currentTime;
          saveProgress(video.currentTime, video.duration);
        }
      };

    const onMeta = () => setDuration(video.duration || 0);
    const onPlay = () => {
      setPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true, video.currentTime);
    };
    const onPause = () => {
      setPlaying(false);
      if (!disableProgressSave) saveProgress(video.currentTime, video.duration);
      if (onPlayStateChange) onPlayStateChange(false, video.currentTime);
    };
    const onEnded = () => {
      if (!disableProgressSave) saveProgress(video.duration, video.duration);
      if (nextHref) router.push(nextHref);
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    const onLeave = () => {
      if (!disableProgressSave) saveProgress(video.currentTime, video.duration, true);
    };
    window.addEventListener("beforeunload", onLeave);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      window.removeEventListener("beforeunload", onLeave);
      onLeave();
    };
  }, [saveProgress, nextHref, router, disableProgressSave]);

  // ── fullscreen state ──
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ── actions ──
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      const p = video.play();
      if (p) p.catch((err) => console.log("play blocked:", err.message));
    } else {
      video.pause();
    }
  }, []);

  const skip = useCallback((delta) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else shellRef.current?.requestFullscreen().catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  // ── keyboard ──
  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          skip(10);
          break;
        case "ArrowLeft":
          skip(-10);
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          toggleMute();
          break;
        default:
          break;
      }
      wake();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, skip, toggleFullscreen, toggleMute]);

  // ── auto-hide controls ──
  function wake() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2800);
  }

  function handleSeek(e) {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const target = Math.max(0, Math.min(duration, ratio * duration));
    video.currentTime = target;
    if (onSeek) onSeek(target);
  }

  function handleVolume(e) {
    const video = videoRef.current;
    const value = Number(e.target.value);
    setVolume(value);
    if (video) {
      video.volume = value;
      video.muted = value === 0;
      setMuted(value === 0);
    }
  }

  const pct = duration ? (current / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={shellRef}
      onMouseMove={wake}
      onMouseLeave={() => playing && setShowControls(false)}
      className={`relative w-full overflow-hidden bg-black ${
        fullscreen ? "h-screen" : "aspect-video rounded-[6px] border border-line"
      }`}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
      />

      {/* loading */}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="font-mono text-[11px] tracking-[0.2em] text-muted">
            LOADING…
          </div>
        </div>
      )}

      {/* error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <div className="font-mono text-[11px] tracking-[0.15em] text-alert">{error}</div>
        </div>
      )}

      {/* big play button when paused */}
      {ready && !playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play"
        >
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full bg-marquee text-[22px] text-marquee-ink shadow-[0_10px_40px_-8px_rgba(229,168,61,0.7)] transition-transform duration-500 hover:scale-105"
            style={{ transitionTimingFunction: "var(--ease-cine)" }}
          >
            ▶
          </span>
        </button>
      )}

      {/* controls */}
      <div
        className="absolute inset-x-2 bottom-2 rounded-[12px] border border-white/10 bg-ink/55 px-3 pb-2.5 pt-2.5 backdrop-blur-2xl transition-all duration-500 sm:inset-x-3 sm:bottom-3 sm:px-4"
        style={{
          transitionTimingFunction: "var(--ease-cine)",
          opacity: showControls ? 1 : 0,
          transform: showControls ? "none" : "translateY(12px)",
          pointerEvents: showControls ? "auto" : "none",
          boxShadow: showControls ? "0 12px 40px -12px rgba(0,0,0,0.7)" : "none",
        }}
      >
        {/* scrubber */}
        <div
          onClick={handleSeek}
          className="group relative mb-3 h-[4px] cursor-pointer rounded-full bg-white/15"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/20"
            style={{ width: `${bufPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-marquee"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-marquee opacity-0 shadow-[0_0_0_4px_rgba(229,168,61,0.2)] transition-all duration-300 group-hover:opacity-100"
            style={{ left: `${pct}%` }}
          />
        </div>

        {/* buttons */}
        <div className="flex items-center justify-between gap-2">
          {/* left cluster */}
          <div className="flex items-center gap-1 sm:gap-3">
            <button onClick={() => skip(-10)} className="flex h-8 w-8 items-center justify-center rounded-full text-[14px] opacity-75 transition-all duration-300 hover:bg-white/10 hover:opacity-100" aria-label="Back 10 seconds">
              ⏪
            </button>
            <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-marquee text-[16px] text-marquee-ink transition-transform duration-300 hover:scale-105" style={{ transitionTimingFunction: "var(--ease-cine)" }} aria-label={playing ? "Pause" : "Play"}>
              {playing ? "⏸" : "▶"}
            </button>
            <button onClick={() => skip(10)} className="flex h-8 w-8 items-center justify-center rounded-full text-[14px] opacity-75 transition-all duration-300 hover:bg-white/10 hover:opacity-100" aria-label="Forward 10 seconds">
              ⏩
            </button>
          </div>

          {/* time */}
          <span className="font-mono text-[10.5px] tracking-[0.03em] text-muted">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          {/* right cluster */}
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <button onClick={toggleMute} className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] opacity-75 transition-all duration-300 hover:bg-white/10 hover:opacity-100" aria-label="Mute">
                {muted || volume === 0 ? "🔇" : "🔊"}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolume}
                className="h-[3px] w-16 accent-[#E5A83D]"
                aria-label="Volume"
              />
            </div>
            <button onClick={toggleMute} className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] opacity-75 transition hover:bg-white/10 hover:opacity-100 sm:hidden" aria-label="Mute">
              {muted || volume === 0 ? "🔇" : "🔊"}
            </button>

            <button onClick={toggleFullscreen} className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] opacity-75 transition-all duration-300 hover:bg-white/10 hover:opacity-100" aria-label="Fullscreen">
              ⛶
            </button>
          </div>
        </div>
      </div>

      {/* next-episode pill — floats top-right, out of the control bar */}
      {nextHref && showControls && (
        <a
          href={nextHref}
          className="absolute right-2 top-2 flex items-center gap-2 rounded-full border border-white/10 bg-ink/55 px-4 py-2 font-mono text-[10px] tracking-[0.14em] text-marquee backdrop-blur-2xl transition-all duration-500 hover:-translate-y-0.5 hover:bg-ink/75 sm:right-3 sm:top-3"
          style={{ transitionTimingFunction: "var(--ease-cine)" }}
        >
          NEXT EPISODE
          <span>→</span>
        </a>
      )}
    </div>
  );
}