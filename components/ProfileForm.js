"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfileForm({ initialDisplayName, username }) {
  const supabase = createClient();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: err } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || username })
      .eq("id", user.id);

    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      router.refresh();
    }
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const labelClass = "font-mono text-[10px] tracking-[0.18em] text-muted";

  return (
    <div className="max-w-md">
      <form onSubmit={save} className="space-y-6">
        <label className="block">
          <span className={labelClass}>DISPLAY NAME</span>
          <input
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSaved(false);
            }}
            placeholder={username}
            maxLength={40}
            className="mt-2 w-full border-b border-line bg-transparent pb-2 text-[14px] outline-none transition-colors duration-300 placeholder:text-faint focus:border-marquee"
          />
          <span className="mt-2 block font-mono text-[10px] text-faint">
            This is how your name shows in parties and chat.
          </span>
        </label>

        {saved && <p className="font-mono text-[11px] text-marquee">✓ Saved.</p>}
        {error && <p className="font-mono text-[11px] text-alert">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-[4px] bg-marquee px-5 py-3 text-[13px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(229,168,61,0.55)] disabled:opacity-60"
          style={{ transitionTimingFunction: "var(--ease-cine)" }}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="mt-10 border-t border-line pt-8">
        <button
          onClick={signOut}
          className="rounded-[4px] border border-line-strong px-5 py-3 text-[13px] transition-all duration-500 hover:-translate-y-0.5 hover:border-alert hover:text-alert"
          style={{ transitionTimingFunction: "var(--ease-cine)" }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}