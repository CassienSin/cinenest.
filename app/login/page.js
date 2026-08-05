"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // "signin" or "invite"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      // Redeeming an invite? Create the account first.
      if (mode === "invite") {
        const res = await fetch("/api/invite/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, username, code }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong.");
          setBusy(false);
          return;
        }
      }

      // Then sign in (both modes end up here).
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "That email and password don't match."
            : signInError.message
        );
        setBusy(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setBusy(false);
    }
  }

  const fieldClass =
    "mt-2 w-full border-b border-line bg-transparent pb-2 text-[14px] text-text outline-none transition-colors duration-300 placeholder:text-faint focus:border-marquee";
  const labelClass = "font-mono text-[10px] tracking-[0.18em] text-muted";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="cn-bloom" />
      <div className="cn-grain" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px]">
          {/* masthead */}
          <div className="cn-rise">
            <div className={labelClass}>000 — ADMISSION</div>
            <h1 className="mt-3 text-[38px] font-semibold leading-none tracking-[-1.2px]">
              cinenest<span className="text-marquee">.</span>
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              A private cinema. Members only — you&apos;ll need a code from
              someone already inside.
            </p>
          </div>

          {/* tabs */}
          <div
            className="cn-rise relative mt-9 flex border-b border-line"
            style={{ animationDelay: "0.12s" }}
          >
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`flex-1 pb-3 font-mono text-[10px] tracking-[0.18em] transition-colors duration-300 ${
                mode === "signin" ? "text-text" : "text-muted hover:text-text"
              }`}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => switchMode("invite")}
              className={`flex-1 pb-3 font-mono text-[10px] tracking-[0.18em] transition-colors duration-300 ${
                mode === "invite" ? "text-text" : "text-muted hover:text-text"
              }`}
            >
              REDEEM INVITE
            </button>
            <span
              className="absolute -bottom-px h-px w-1/2 bg-marquee transition-transform duration-500"
              style={{
                transitionTimingFunction: "var(--ease-cine)",
                transform: `translateX(${mode === "signin" ? "0%" : "100%"})`,
              }}
            />
          </div>

          {/* form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            {mode === "invite" && (
              <>
                <label className="block">
                  <span className={labelClass}>INVITE CODE</span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="NEST-FOUNDER"
                    autoComplete="off"
                    className={`${fieldClass} font-mono uppercase tracking-[0.12em]`}
                    required
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>USERNAME</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="migz"
                    autoComplete="username"
                    className={fieldClass}
                    required
                  />
                </label>
              </>
            )}

            <label className="block">
              <span className={labelClass}>EMAIL</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className={fieldClass}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>PASSWORD</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "invite" ? "new-password" : "current-password"}
                className={fieldClass}
                required
              />
            </label>

            {error && (
              <p className="font-mono text-[11px] leading-relaxed text-alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center rounded-[4px] bg-marquee px-5 py-3 text-[13px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(229,168,61,0.55)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ transitionTimingFunction: "var(--ease-cine)" }}
            >
              {busy
                ? "One moment…"
                : mode === "signin"
                ? "Enter the nest"
                : "Claim your seat"}
            </button>
          </form>

          <p
            className="cn-rise mt-10 font-mono text-[10px] tracking-[0.18em] text-faint"
            style={{ animationDelay: "0.3s" }}
          >
            CINENEST © 2026 — BUILT FOR THE BARKADA
          </p>
        </div>
      </div>
    </main>
  );
}