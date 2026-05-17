import { useEffect, useRef } from "react";
import { pushTickerMessage } from "@/lib/ticker-store";
import type { Allocation, EventResults } from "@/lib/tuloslista";
import type { DetailCache } from "@/hooks/useAnnouncerData";

interface LeaderSnapshot {
  leaderAllocId: number;
  leaderName: string;
  leaderOrg: string;
  leaderResult: string;
  leaderNumeric: number | null;
  secondResult: string | null;
  secondNumeric: number | null;
  secondName: string | null;
}

function parseNumeric(result: string | null): number | null {
  if (!result) return null;
  // Strip non-numeric except dot/comma/minus, take first number.
  const cleaned = result.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!cleaned) return null;
  const n = parseFloat(cleaned[0]);
  return Number.isFinite(n) ? n : null;
}

function formatDiff(diff: number): string {
  const abs = Math.abs(diff);
  if (abs < 1) {
    return `${Math.round(abs * 100)} cm`;
  }
  return `${abs.toFixed(2).replace(/\.?0+$/, "")} m`;
}

function diffToSecond(snap: LeaderSnapshot): string {
  if (
    snap.secondNumeric == null ||
    snap.leaderNumeric == null ||
    snap.leaderNumeric === snap.secondNumeric
  ) {
    return "";
  }
  let diffText = ` — ero ${formatDiff(snap.leaderNumeric - snap.secondNumeric)} kakkoseen`;
  if (snap.secondName) diffText += ` (${snap.secondName})`;
  return diffText;
}

function findLeader(ev: EventResults): LeaderSnapshot | null {
  if (ev.EventCategory !== "Field") return null;
  const allocs: Allocation[] = ev.Rounds.flatMap((r) => r.Heats.flatMap((h) => h.Allocations));
  const ranked = allocs
    .filter((a) => !a.NotInCompetition && a.ResultRank != null && a.Result)
    .sort((a, b) => (a.ResultRank ?? 999) - (b.ResultRank ?? 999));
  if (ranked.length === 0) return null;
  const first = ranked[0];
  const second = ranked[1] ?? null;
  return {
    leaderAllocId: first.AllocId,
    leaderName: first.Name,
    leaderOrg: first.Organization?.NameShort ?? first.Organization?.Name ?? "",
    leaderResult: first.Result ?? "",
    leaderNumeric: parseNumeric(first.Result),
    secondResult: second?.Result ?? null,
    secondNumeric: parseNumeric(second?.Result ?? null),
    secondName: second?.Name ?? null,
  };
}

export function useFieldLeaderChanges(details: DetailCache) {
  const snapshotsRef = useRef<Map<number, LeaderSnapshot>>(new Map());
  const initializedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    Object.values(details).forEach((ev) => {
      if (ev.EventCategory !== "Field") return;
      const snap = findLeader(ev);
      if (!snap) return;

      const prev = snapshotsRef.current.get(ev.Id);
      snapshotsRef.current.set(ev.Id, snap);

      // First time we see this event: baseline silently.
      if (!initializedRef.current.has(ev.Id)) {
        initializedRef.current.add(ev.Id);
        if (snap.leaderResult) {
          const orgPart = snap.leaderOrg ? ` (${snap.leaderOrg})` : "";
          pushTickerMessage({
            text: `${snap.leaderName}${orgPart} johtaa ${ev.Name} -kilpailua: ${snap.leaderResult}${diffToSecond(snap)}`,
            eventId: ev.Id,
            eventName: ev.Name,
            source: "announcer",
          });
        }
        return;
      }

      if (!prev) return;

      const leaderChanged = prev.leaderAllocId !== snap.leaderAllocId;
      const leaderImproved =
        !leaderChanged &&
        prev.leaderResult !== snap.leaderResult &&
        prev.leaderNumeric != null &&
        snap.leaderNumeric != null &&
        snap.leaderNumeric > prev.leaderNumeric;

      if (!leaderChanged && !leaderImproved) return;

      const orgPart = snap.leaderOrg ? ` (${snap.leaderOrg})` : "";
      let text: string;

      if (leaderChanged) {
        text = `${snap.leaderName}${orgPart} nousi ${ev.Name} -kilpailun kärkeen: ${snap.leaderResult}${diffToSecond(snap)}`;
      } else {
        // Same leader, improved.
        text = `${snap.leaderName}${orgPart} paransi ${ev.Name} -kilpailun kärkitulosta: ${snap.leaderResult}`;
        if (
          snap.secondNumeric != null &&
          snap.leaderNumeric != null &&
          snap.leaderNumeric > snap.secondNumeric
        ) {
          const diff = snap.leaderNumeric - snap.secondNumeric;
          text += ` — ero ${formatDiff(diff)} kakkoseen`;
        }
      }

      pushTickerMessage({
        text,
        eventId: ev.Id,
        eventName: ev.Name,
        source: "announcer",
      });
    });
  }, [details]);
}
