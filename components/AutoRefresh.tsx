"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Holt den Serverstand in festem Takt nach. Bewusst Polling statt WebSockets:
 * bei der Handvoll Zuschauer eines Turnierabends voellig ausreichend und
 * deutlich weniger fehleranfaellig.
 *
 * Pausiert, sobald der Tab in den Hintergrund geht - spart Akku auf den Handys.
 */
export function AutoRefresh({ seconds = 3 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), seconds * 1000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        router.refresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);

  return null;
}

/**
 * Haelt den Bildschirm wach. Ohne das schaltet der Fernseher waehrend der
 * Uebertragung nach wenigen Minuten in den Standby.
 */
export function WakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let aufgegeben = false;

    const anfordern = async () => {
      try {
        if (!("wakeLock" in navigator) || document.hidden || aufgegeben) return;
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        // Browser verweigert das Wachhalten (z.B. Akkusparmodus) - nicht kritisch.
        aufgegeben = true;
      }
    };

    // Nach Tab-Wechsel geht der Lock verloren und muss neu geholt werden
    const onVisibility = () => {
      if (!document.hidden && !lock) void anfordern();
    };

    void anfordern();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
    };
  }, []);

  return null;
}
