"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LivePartyBar({ meId }) {
  const supabase = createClient();
  const router = useRouter();
  const [parties, setParties] = useState([]);

  async function loadParties() {
    const { data } = await supabase
      .from("active_parties")
      .select("*")
      .order("updated_at", { ascending: false });
    setParties(data || []);
  }

  useEffect(() => {
    loadParties();

    // refresh whenever any party is created or ends
    const channel = supabase
      .channel("live-parties")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parties" },
        () => loadParties()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // your own party (host) vs everyone else's
  const mine = parties.find((p) => p.host_id === meId);
  const others = parties.filter((p) => p.host_id !== meId);

  if (!mine && others.length === 0) {
    return (
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <span className="cn-dot" style={{ background: "var(--color-faint)" }} />
        <span className="text-[13px] text-muted">No parties happening right now.</span>
      </div>
    );
  }

  return (
    <div className="border-b border-line">
      {/* your own active party — rejoin */}
      {mine && (
        <button
          onClick={() => router.push(`/party/${mine.id}`)}
          className="group flex w-full items-center justify-between border-b border-line px-5 py-3.5 text-left transition-colors duration-400 hover:bg-white/[0.022]"
        >
          <div className="flex items-center gap-3">
            <span className="cn-dot" />
            <span className="text-[13px]">
              <span className="text-muted">Your party is still live · </span>
              <span className="text-marquee">{mine.title_name}</span>
              {mine.episode_number ? (
                <span className="text-muted">
                  {" "}· E{String(mine.episode_number).padStart(2, "0")}
                </span>
              ) : null}
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.12em] text-marquee transition-transform duration-300 group-hover:translate-x-1">
            REJOIN →
          </span>
        </button>
      )}

      {others.map((p) => (
        <button
          key={p.id}
          onClick={() => router.push(`/party/${p.id}`)}
          className="group flex w-full items-center justify-between border-b border-line px-5 py-3.5 text-left transition-colors duration-400 last:border-b-0 hover:bg-white/[0.022]"
        >
          <div className="flex items-center gap-3">
            <span className="cn-dot" />
            <span className="text-[13px]">
              <span className="font-medium">{p.host_username}</span>
              <span className="text-muted"> is watching </span>
              <span className="text-marquee">{p.title_name}</span>
              {p.episode_number ? (
                <span className="text-muted">
                  {" "}· E{String(p.episode_number).padStart(2, "0")}
                </span>
              ) : null}
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.12em] text-marquee transition-transform duration-300 group-hover:translate-x-1">
            JOIN →
          </span>
        </button>
      ))}
    </div>
  );
}