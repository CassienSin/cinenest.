"use client";

import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed? Don't show.
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-[10px] border border-line bg-ink/95 p-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-line-strong">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium">Install CineNest</div>
          <div className="mt-0.5 font-mono text-[10px] tracking-[0.1em] text-muted">
            ADD TO YOUR HOME SCREEN
          </div>
        </div>
        <button
          onClick={install}
          className="shrink-0 rounded-[4px] bg-marquee px-4 py-2 text-[12px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5"
          style={{ transitionTimingFunction: "var(--ease-cine)" }}
        >
          Install
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 px-1 text-[16px] text-muted transition-colors hover:text-text"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}