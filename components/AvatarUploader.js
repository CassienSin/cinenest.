"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AvatarUploader({ avatarUrl, username }) {
  const supabase = createClient();
  const router = useRouter();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(avatarUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handlePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }

    setBusy(true);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      // 1. Ask for a signed upload URL.
      const presignRes = await fetch("/api/r2/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      const presignData = await presignRes.json();

      if (!presignRes.ok) throw new Error(presignData.error || "Upload failed.");

      // 2. Upload straight to R2.
      const putRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload to storage failed.");

      // 3. Save the new URL to the profile.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: presignData.publicUrl })
        .eq("id", user.id);

      if (dbErr) throw new Error(dbErr.message);

      setPreview(presignData.publicUrl);
      router.refresh();
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setPreview(avatarUrl); // revert
    } finally {
      setBusy(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative h-20 w-20 overflow-hidden rounded-full border border-line-strong bg-[#2A3341] transition-all duration-500 hover:-translate-y-0.5 disabled:opacity-70"
        style={{ transitionTimingFunction: "var(--ease-cine)" }}
        aria-label="Change avatar"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[26px] font-semibold">
            {(username || "?").charAt(0).toUpperCase()}
          </span>
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-ink/0 text-[10px] font-mono tracking-[0.1em] text-transparent opacity-0 backdrop-blur-0 transition-all duration-300 group-hover:bg-ink/60 group-hover:text-text group-hover:opacity-100 group-hover:backdrop-blur-sm">
          {busy ? "…" : "EDIT"}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePick}
        className="hidden"
      />

      {error && (
        <p className="max-w-[160px] text-center font-mono text-[9.5px] text-alert">{error}</p>
      )}
    </div>
  );
}