import { useEffect, useRef } from "react";
import { pushTickerMessage } from "@/lib/ticker-store";
import type { IndexedEntry } from "@/lib/tuloslista-queries";
import type { WatchedAthlete } from "@/lib/watch-store";

interface Snap {
  rank: number | null;
  result: string | null;
  numeric: number | null;
}

function parseNumeric(result: string | null): number | null {
  if (!result) return null;
  const m = result.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function snapFromEntry(e: IndexedEntry): Snap {
  return {
    rank: e.alloc.ResultRank ?? null,
    result: e.alloc.Result ?? null,
    numeric: parseNumeric(e.alloc.Result ?? null),
  };
}

function rankSuffix(n: number): string {
  return `${n}.`;
}

export function useWatchedFieldChanges(
  index: IndexedEntry[] | null,
  watched: WatchedAthlete[],
) {
  const snapshotsRef = useRef<Map<string, Snap>>(new Map());
  const initializedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!index || watched.length === 0) return;

    const watchedMap = new Map<string, WatchedAthlete>();
    for (const w of watched) {
      const key = `${w.surname}|${w.firstname}|${w.organizationId ?? ""}`;
      watchedMap.set(key, w);
    }

    for (const e of index) {
      if (e.round.Category !== "Field") continue;

      const orgId = e.alloc.Organization?.Id ?? null;
      const ak = `${e.alloc.Surname}|${e.alloc.Firstname}|${orgId ?? ""}`;
      const watchedAthlete = watchedMap.get(ak);
      if (!watchedAthlete) continue;

      // Per-round snapshot key so each event/round tracks independently
      const snapKey = `${ak}::${e.round.Id}`;
      const snap = snapFromEntry(e);
      const prev = snapshotsRef.current.get(snapKey);
      snapshotsRef.current.set(snapKey, snap);

      // First sighting: baseline silently
      if (!initializedRef.current.has(snapKey)) {
        initializedRef.current.add(snapKey);
        continue;
      }
      if (!prev) continue;

      // Need at least a result to be meaningful
      if (!snap.result) continue;

      const name = `${e.alloc.Firstname} ${e.alloc.Surname}`.trim();
      const eventName = e.round.EventName || e.round.Name || "kenttälaji";

      const rankImproved =
        prev.rank != null && snap.rank != null && snap.rank < prev.rank;
      const resultImproved =
        prev.numeric != null &&
        snap.numeric != null &&
        snap.numeric > prev.numeric;
      const firstResult = prev.result == null && snap.result != null;

      if (rankImproved && resultImproved) {
        pushTickerMessage({
          source: "watched",
          eventId: e.round.EventId,
          eventName,
          text: `${name} nousi ${eventName}-kilpailussa ${rankSuffix(prev.rank!)} → ${rankSuffix(snap.rank!)} sijalle tuloksella ${snap.result}`,
        });
      } else if (rankImproved) {
        pushTickerMessage({
          source: "watched",
          eventId: e.round.EventId,
          eventName,
          text: `${name} nousi ${eventName}-kilpailussa ${rankSuffix(prev.rank!)} → ${rankSuffix(snap.rank!)} sijalle`,
        });
      } else if (resultImproved) {
        const rankPart =
          snap.rank != null ? ` (${rankSuffix(snap.rank)} sija)` : "";
        pushTickerMessage({
          source: "watched",
          eventId: e.round.EventId,
          eventName,
          text: `${name} paransi ${eventName}-kilpailussa tulosta: ${snap.result}${rankPart}`,
        });
      } else if (firstResult) {
        const rankPart =
          snap.rank != null ? ` (${rankSuffix(snap.rank)} sija)` : "";
        pushTickerMessage({
          source: "watched",
          eventId: e.round.EventId,
          eventName,
          text: `${name} sai tuloksen ${eventName}-kilpailussa: ${snap.result}${rankPart}`,
        });
      }
    }
  }, [index, watched]);
}
