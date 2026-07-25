"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FavoriteButton({ titleId, initialFavorited }) {
  const supabase = createClient();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setBusy(false);
      return;
    }

    if (favorited) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("title_id", titleId);
      setFavorited(false);
    } else {
      await supabase
        .from("favorites")
        .insert({ user_id: user.id, title_id: titleId });
      setFavorited(true);
    }

    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-[4px] border px-5 py-3 text-[13px] transition-all duration-500 hover:-translate-y-0.5 disabled:opacity-60 ${
        favorited
          ? "border-marquee text-marquee hover:bg-marquee/[0.08]"
          : "border-line-strong hover:border-muted hover:bg-white/[0.03]"
      }`}
      style={{ transitionTimingFunction: "var(--ease-cine)" }}
    >
      {favorited ? "★ Favorited" : "☆ Favorite"}
    </button>
  );
}