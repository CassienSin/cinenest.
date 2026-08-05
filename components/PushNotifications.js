"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushNotifications() {
  const supabase = createClient();
  const [status, setStatus] = useState({ supported: false, permission: "default" });

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    setStatus({ supported: true, permission: Notification.permission });
  }, []);

  async function enable() {
    if (!status.supported) return;

    try {
      const result = await Notification.requestPermission();
      setStatus((s) => ({ ...s, permission: result }));
      if (result !== "granted") return;

      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        throw new Error("VAPID public key is missing from environment variables.");
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save subscription.");
      }
    } catch (err) {
      console.error("Push subscribe failed:", err);
    }
  }

  if (!status.supported || status.permission === "granted") return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-sm rounded-[10px] border border-line bg-ink/95 p-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-[16px]">
          🔔
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">Get party alerts</div>
          <div className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-muted">
            KNOW WHEN A PARTY STARTS
          </div>
        </div>
        <button
          onClick={enable}
          className="shrink-0 rounded-[4px] bg-marquee px-4 py-2 text-[12px] font-semibold text-marquee-ink transition-all duration-500 hover:-translate-y-0.5"
          style={{ transitionTimingFunction: "var(--ease-cine)" }}
        >
          Enable
        </button>
      </div>
    </div>
  );
}