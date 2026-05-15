import { useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

/**
 * Pitää näytön ja laitteen hereillä niin kauan kun komponentti on mountattu.
 * Käyttää Screen Wake Lock API:a (Chrome/Edge/Safari 16.4+).
 *
 * Lukko vapautuu automaattisesti kun välilehti menee taustalle, joten
 * pyydetään se uudelleen aina kun välilehti palaa näkyviin.
 *
 * Palauttaa { supported, active, error } UI-indikaattoria varten.
 */
export function useWakeLock(enabled: boolean = true) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof navigator !== "undefined" && "wakeLock" in navigator;

  const request = useCallback(async () => {
    if (!supported) return;
    try {
      const wl = (navigator as unknown as {
        wakeLock: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      }).wakeLock;
      const sentinel = await wl.request("screen");
      sentinelRef.current = sentinel;
      setActive(true);
      setError(null);
      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
          setActive(false);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setActive(false);
    }
  }, [supported]);

  useEffect(() => {
    if (!enabled || !supported) return;

    void request();

    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        sentinelRef.current === null
      ) {
        void request();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) {
        void s.release();
      }
      setActive(false);
    };
  }, [enabled, supported, request]);

  return { supported, active, error };
}
