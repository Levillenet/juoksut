import { useCallback, useEffect, useRef, useState } from "react";
import type { DetailCache } from "@/hooks/useAnnouncerData";
import type { NewResultItem } from "@/components/announcer/NewResultOverlay";
import { getResultVisualState } from "@/lib/result-visualization";

/**
 * Watches `details` for newly arrived per-athlete results in currently-live
 * field/track events and emits them one-by-one through `current`. Consumer
 * calls `onDone()` to advance to the next item in the queue.
 */
export function useNewResultsQueue(
  details: DetailCache,
  liveEventIds: Set<number>,
) {
  const prevRef = useRef<Map<number, string>>(new Map());
  const initializedRef = useRef(false);
  const [queue, setQueue] = useState<NewResultItem[]>([]);
  const [current, setCurrent] = useState<NewResultItem | null>(null);

  useEffect(() => {
    const next = new Map<number, string>();
    const newItems: NewResultItem[] = [];

    for (const ev of Object.values(details)) {
      const liveRound = ev.Rounds.find((r) => r.Status === "Progress");
      if (!liveRound) continue;
      if (!liveEventIds.has(ev.Id)) continue;

      for (const heat of liveRound.Heats) {
        for (const a of heat.Allocations) {
          const visualState = getResultVisualState(a);
          if (!visualState) continue;
          next.set(a.AllocId, visualState.signature);
          const prev = prevRef.current.get(a.AllocId);
          if (initializedRef.current && prev !== visualState.signature) {
            newItems.push({
              key: `${a.AllocId}-${visualState.signature}-${Date.now()}`,
              alloc: { ...a, Result: visualState.result ?? visualState.attemptResult },
              eventId: ev.Id,
              eventName: ev.Name,
              eventCategory: ev.EventCategory ?? "",
              heatIndex: heat.Index,
            });
          }
        }
      }
    }

    // Preserve prior entries for events we didn't see this pass (no detail).
    for (const [k, v] of prevRef.current) {
      if (!next.has(k)) next.set(k, v);
    }
    prevRef.current = next;
    initializedRef.current = true;
    if (newItems.length) setQueue((q) => [...q, ...newItems]);
  }, [details, liveEventIds]);

  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [current, queue]);

  const onDone = useCallback(() => setCurrent(null), []);

  return { current, onDone };
}
