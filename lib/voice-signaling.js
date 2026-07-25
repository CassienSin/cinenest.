import { createClient } from "@/lib/supabase/client";

/**
 * Voice signaling over Supabase Realtime broadcast.
 *
 * WebRTC peers can't find each other directly — they need to exchange
 * "offers", "answers", and "ICE candidates" first. This helper carries
 * those messages between browsers using a Supabase broadcast channel.
 * Once the exchange is done, audio flows peer-to-peer, not through here.
 */
export function createSignaling(partyId, myId, handlers) {
  const supabase = createClient();

  const channel = supabase.channel(`voice:${partyId}`, {
    config: { broadcast: { self: false } },
  });

  // Incoming signaling messages, each addressed to a specific peer.
  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    // Ignore anything not meant for me.
    if (payload.to && payload.to !== myId) return;

    switch (payload.type) {
      case "offer":
        handlers.onOffer?.(payload.from, payload.data);
        break;
      case "answer":
        handlers.onAnswer?.(payload.from, payload.data);
        break;
      case "ice":
        handlers.onIce?.(payload.from, payload.data);
        break;
      case "join":
        handlers.onJoin?.(payload.from);
        break;
      case "leave":
        handlers.onLeave?.(payload.from);
        break;
      default:
        break;
    }
  });

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") handlers.onReady?.();
  });

  function send(type, data, to = null) {
    channel.send({
      type: "broadcast",
      event: "signal",
      payload: { type, from: myId, to, data },
    });
  }

  return {
    announceJoin: () => send("join", null),
    announceLeave: () => send("leave", null),
    sendOffer: (to, offer) => send("offer", offer, to),
    sendAnswer: (to, answer) => send("answer", answer, to),
    sendIce: (to, candidate) => send("ice", candidate, to),
    destroy: () => supabase.removeChannel(channel),
  };
}