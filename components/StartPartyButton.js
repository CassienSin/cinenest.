"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartPartyButton({ titleId, episodeId = null, label = "Start a party" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId, episodeId }),
      });
      const data = await res.json();
      if (data.partyId) {
        router.push(`/party/${data.partyId}`);
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={start}
      disabled={busy}
      className="rounded-[4px] border border-line-strong px-5 py-3 text-[13px] transition-all duration-500 hover:-translate-y-0.5 hover:border-muted hover:bg-white/[0.03] disabled:opacity-60"
      style={{ transitionTimingFunction: "var(--ease-cine)" }}
    >
      {busy ? "Starting…" : `⌘ ${label}`}
    </button>
  );
}