"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StartPartyButton({ titleId, episodeId = null, label = "Start a party" }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [existingId, setExistingId] = useState(null);

  // Do I already have a party running for this title?
  useEffect(() => {
    let active = true;

    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("parties")
        .select("id")
        .eq("host_id", user.id)
        .eq("title_id", titleId)
        .maybeSingle();

      if (active && data) setExistingId(data.id);
    }

    check();
    return () => {
      active = false;
    };
  }, [titleId]);

  async function start() {
    // Already hosting one for this title? Just rejoin it.
    if (existingId) {
      router.push(`/party/${existingId}`);
      return;
    }

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
      className={`rounded-[4px] border px-5 py-3 text-[13px] transition-all duration-500 hover:-translate-y-0.5 disabled:opacity-60 ${
        existingId
          ? "border-marquee text-marquee hover:bg-marquee/[0.08]"
          : "border-line-strong hover:border-muted hover:bg-white/[0.03]"
      }`}
      style={{ transitionTimingFunction: "var(--ease-cine)" }}
    >
      {busy ? "Starting…" : existingId ? "⌘ Rejoin your party" : `⌘ ${label}`}
    </button>
  );
}