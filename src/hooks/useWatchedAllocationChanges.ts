import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { pushTickerMessage } from "@/lib/ticker-store";
import type { IndexedEntry } from "@/lib/tuloslista-queries";
import type { WatchedAthlete } from "@/lib/watch-store";

/**
 * Watches for the moment a tracked athlete transitions from
 * enrollment-only (`fromEnrollment === true`) to a real heat allocation in
 * the same round. When that happens we surface a ticker message + toast so
 * the user notices the heat draw without having to refresh.
 */
export function useWatchedAllocationChanges(
  index: IndexedEntry[] | null,
  watched: WatchedAthlete[],
) {
  // Per (athlete + round.Id) -> last seen state: "enrollment" | "allocated"
  const lastStateRef = useRef<Map<string, "enrollment" | "allocated">>(
    new Map(),
  );
  const initializedRef = useRef<Set<string>>(new Set());
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!index || watched.length === 0) return;

    const watchedMap = new Map<string, WatchedAthlete>();
    for (const w of watched) {
      watchedMap.set(
        `${w.surname}|${w.firstname}|${w.organizationId ?? ""}`,
        w,
      );
    }

    // Group entries per (athlete, round) — an athlete in a real allocation
    // may appear in only one heat, while enrollment entries also occupy one
    // row. We just need to know "any allocated row exists for this pair".
    const seen = new Set<string>();
    for (const e of index) {
      const orgId = e.alloc.Organization?.Id ?? null;
      const ak = `${e.alloc.Surname}|${e.alloc.Firstname}|${orgId ?? ""}`;
      if (!watchedMap.has(ak)) continue;

      const key = `${ak}::${e.round.Id}`;
      const currentlyAllocated = !e.fromEnrollment;
      // Prefer "allocated" if we see at least one allocated entry for the pair
      const prevForKey = seen.has(key)
        ? lastStateRef.current.get(key)
        : undefined;
      const nextState: "enrollment" | "allocated" =
        prevForKey === "allocated" || currentlyAllocated
          ? "allocated"
          : "enrollment";
      seen.add(key);

      const before = lastStateRef.current.get(key);
      lastStateRef.current.set(key, nextState);

      // First sighting: baseline silently
      if (!initializedRef.current.has(key)) {
        initializedRef.current.add(key);
        continue;
      }

      // Only fire once per round transition
      if (
        before === "enrollment" &&
        nextState === "allocated" &&
        !notifiedRef.current.has(key)
      ) {
        notifiedRef.current.add(key);
        if (!currentlyAllocated) continue; // need the allocated entry to read heat/lane

        const name = `${e.alloc.Firstname} ${e.alloc.Surname}`.trim();
        const eventName = e.round.EventName || e.round.Name || "lajissa";
        const isTrack = e.round.Category === "Track";
        const detail = isTrack
          ? `Erä ${e.heatIndex}${e.alloc.Position ? ` · Rata ${e.alloc.Position}` : ""}`
          : e.alloc.Position
            ? `Järj. ${e.alloc.Position}`
            : "eräjako tehty";

        const text = `${name} sai eräjaon lajissa ${eventName}: ${detail}`;
        pushTickerMessage({
          source: "watched",
          eventId: e.round.EventId,
          eventName,
          text,
        });
        toast.success(`${name} – ${eventName}`, { description: detail });
      }
    }
  }, [index, watched]);
}
