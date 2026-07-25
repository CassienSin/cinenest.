"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createSignaling } from "@/lib/voice-signaling";

// Google's free STUN servers — help peers discover how to reach each other.
// To add TURN later, just append another { urls, username, credential } here.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useVoiceChat(partyId, myId, enabled) {
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState({}); // { peerId: true }

  const localStream = useRef(null);
  const signaling = useRef(null);
  const peers = useRef({}); // { peerId: RTCPeerConnection }
  const audioEls = useRef({}); // { peerId: <audio> element }
  const analysers = useRef({}); // for speaking detection

  // ── create a peer connection to one other person ──
  const createPeer = useCallback(
    (peerId, isInitiator) => {
      if (peers.current[peerId]) return peers.current[peerId];

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peers.current[peerId] = pc;

      // Send our mic audio to them.
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStream.current);
        });
      }

      // When our network figures out a route, tell the peer about it.
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          signaling.current?.sendIce(peerId, event.candidate);
        }
      };

      // When their audio arrives, play it through a hidden <audio> element.
      pc.ontrack = (event) => {
        let el = audioEls.current[peerId];
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          audioEls.current[peerId] = el;
        }
        el.srcObject = event.streams[0];
        el.play().catch(() => {});

        // Watch their audio level to light up a "speaking" indicator.
        setupSpeakingDetection(peerId, event.streams[0]);
      };

      // If the connection drops, clean it up.
      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          removePeer(peerId);
        }
      };

      // The initiator makes the first offer.
      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => signaling.current?.sendOffer(peerId, pc.localDescription))
          .catch(() => {});
      }

      return pc;
    },
    []
  );

  // ── detect when a peer is talking (for the amber ring) ──
  function setupSpeakingDetection(peerId, stream) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      analysers.current[peerId] = { ctx, analyser, data, raf: null };

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setSpeakingPeers((prev) => {
          const isSpeaking = avg > 12;
          if (prev[peerId] === isSpeaking) return prev;
          return { ...prev, [peerId]: isSpeaking };
        });
        analysers.current[peerId].raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // AudioContext not available — indicators just won't light up.
    }
  }

  // ── tear down one peer ──
  function removePeer(peerId) {
    peers.current[peerId]?.close();
    delete peers.current[peerId];

    if (audioEls.current[peerId]) {
      audioEls.current[peerId].srcObject = null;
      delete audioEls.current[peerId];
    }

    const a = analysers.current[peerId];
    if (a) {
      cancelAnimationFrame(a.raf);
      a.ctx.close().catch(() => {});
      delete analysers.current[peerId];
    }

    setSpeakingPeers((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }

  // ── main setup: runs when voice is enabled ──
  useEffect(() => {
    if (!enabled || !partyId || !myId) return;

    let cancelled = false;

    async function start() {
      // 1. Ask for the mic.
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch {
        // User denied mic or none available.
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStream.current = stream;
      setConnected(true);

      // 2. Open the signaling channel.
      signaling.current = createSignaling(partyId, myId, {
        onReady: () => {
          // Announce ourselves; existing peers will offer to us.
          signaling.current.announceJoin();
        },
        onJoin: (peerId) => {
          // Someone new joined — we initiate the offer to them.
          createPeer(peerId, true);
        },
        onOffer: async (peerId, offer) => {
          const pc = createPeer(peerId, false);
          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signaling.current.sendAnswer(peerId, pc.localDescription);
        },
        onAnswer: async (peerId, answer) => {
          const pc = peers.current[peerId];
          if (pc) await pc.setRemoteDescription(answer).catch(() => {});
        },
        onIce: async (peerId, candidate) => {
          const pc = peers.current[peerId];
          if (pc) await pc.addIceCandidate(candidate).catch(() => {});
        },
        onLeave: (peerId) => removePeer(peerId),
      });
    }

    start();

    // ── cleanup when voice is disabled or component unmounts ──
    return () => {
      cancelled = true;

      signaling.current?.announceLeave();
      signaling.current?.destroy();
      signaling.current = null;

      Object.keys(peers.current).forEach(removePeer);

      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;

      setConnected(false);
      setSpeakingPeers({});
    };
  }, [enabled, partyId, myId, createPeer]);

  // ── mute / unmute ──
  const toggleMute = useCallback(() => {
    const stream = localStream.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }, []);

  return { connected, muted, speakingPeers, toggleMute };
}