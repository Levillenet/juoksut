// Lookup for an athlete's historical best (across all age classes) and
// current-season best for a given normalized event. Used by the live
// announcer/scoreboard so that a new result is only flagged as PB/SB if it
// actually beats the athlete's historical best — even when the source
// tuloslista has no PB/SB row (common for juniors).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  isLowerBetter,
  normalizeEventName,
} from "@/lib/athlete-history";
import { pbEventKey } from "@/lib/pb-key";

interface HistoricalBest {
  resultText: string;
  resultNumeric: number;
}

interface BaselineEntry {
  pb: HistoricalBest | null;
  sb: HistoricalBest | null;
}

// competitionId -> (pbEventKey + athleteKey -> entry)
const cache = new Map<number, Map<string, BaselineEntry>>();
const inflight = new Map<number, Promise<Map<string, BaselineEntry>>>();

function lookupKeyFor(
  athleteKey: string,
  eventName: string,
  ageClass: string | null | undefined,
): string {
  return `${athleteKey}|${pbEventKey({ event_name: eventName, age_class: ageClass }).toLowerCase()}`;
}

const PAGE_SIZE = 1000;
const HARD_CAP = 50_000;

interface Row {
  athlete_key: string;
  event_name: string;
  event_category: string;
  sub_category: string;
  result_text: string;
  result_numeric: number | null;
  competition_date: string | null;
  age_class: string | null;
}

/** Current season = calendar year of "now". Best effort fallback for SB. */
function currentSeasonYear(): number {
  return new Date().getFullYear();
}

function isInCurrentSeason(date: string | null, seasonYear: number): boolean {
  if (!date) return false;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) && y === seasonYear;
}

async function fetchKeysForCompetition(competitionId: number): Promise<string[]> {
  const out = new Set<string>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select("athlete_key")
      .eq("competition_id", competitionId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { athlete_key: string }[];
    for (const r of rows) out.add(r.athlete_key);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (out.size >= HARD_CAP) break;
  }
  return Array.from(out);
}

async function fetchHistoryForKeys(
  keys: string[],
  excludeCompetitionId: number,
): Promise<Row[]> {
  if (keys.length === 0) return [];
  const out: Row[] = [];
  // Supabase .in() handles ~1000 values comfortably; chunk to be safe.
  const CHUNK = 500;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("athlete_results")
        .select(
          "athlete_key, event_name, event_category, sub_category, result_text, result_numeric, competition_date",
        )
        .in("athlete_key", chunk)
        .neq("competition_id", excludeCompetitionId)
        .not("result_numeric", "is", null)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      out.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
      if (out.length >= HARD_CAP) break;
    }
  }
  return out;
}

function buildBaselineMap(rows: Row[]): Map<string, BaselineEntry> {
  const map = new Map<string, BaselineEntry>();
  const seasonYear = currentSeasonYear();
  for (const r of rows) {
    if (r.result_numeric == null) continue;
    const norm = normalizeEventName(r.event_name);
    if (!norm) continue;
    const lower = isLowerBetter(r.event_category, r.sub_category);
    const k = lookupKey(r.athlete_key, norm);
    let entry = map.get(k);
    if (!entry) {
      entry = { pb: null, sb: null };
      map.set(k, entry);
    }
    const candidate: HistoricalBest = {
      resultText: r.result_text,
      resultNumeric: r.result_numeric,
    };
    const better = (a: number, b: number) => (lower ? a < b : a > b);
    if (!entry.pb || better(candidate.resultNumeric, entry.pb.resultNumeric)) {
      entry.pb = candidate;
    }
    if (
      isInCurrentSeason(r.competition_date, seasonYear) &&
      (!entry.sb || better(candidate.resultNumeric, entry.sb.resultNumeric))
    ) {
      entry.sb = candidate;
    }
  }
  return map;
}

/** Load (or return cached) historical-best lookup for a competition. */
export async function loadHistoryBaselineForCompetition(
  competitionId: number,
): Promise<Map<string, BaselineEntry>> {
  if (!competitionId) return new Map();
  const cached = cache.get(competitionId);
  if (cached) return cached;
  const pending = inflight.get(competitionId);
  if (pending) return pending;

  const p = (async () => {
    try {
      const keys = await fetchKeysForCompetition(competitionId);
      const rows = await fetchHistoryForKeys(keys, competitionId);
      const map = buildBaselineMap(rows);
      cache.set(competitionId, map);
      return map;
    } catch {
      const empty = new Map<string, BaselineEntry>();
      cache.set(competitionId, empty);
      return empty;
    } finally {
      inflight.delete(competitionId);
    }
  })();
  inflight.set(competitionId, p);
  return p;
}

/** Load (or return cached) historical-best lookup for a shared watch token.
 * Uses an anon-callable RPC so unauthenticated visitors can also see PB stars. */
export async function loadHistoryBaselineForSharedWatch(
  token: string,
  competitionId: number,
): Promise<Map<string, BaselineEntry>> {
  if (!competitionId || !token) return new Map();
  const cached = cache.get(competitionId);
  if (cached) return cached;
  const pending = inflight.get(competitionId);
  if (pending) return pending;

  const p = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_shared_watch_history", {
        p_token: token,
        p_exclude_competition_id: competitionId,
      });
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const map = buildBaselineMap(rows);
      cache.set(competitionId, map);
      return map;
    } catch {
      const empty = new Map<string, BaselineEntry>();
      cache.set(competitionId, empty);
      return empty;
    } finally {
      inflight.delete(competitionId);
    }
  })();
  inflight.set(competitionId, p);
  return p;
}


/** Synchronous lookup from the cached baseline. Returns the result text
 * (the format detectRecord knows how to parse) or null. */
export function getHistoricalBest(
  competitionId: number,
  athleteKey: string,
  eventName: string,
): string | null {
  const map = cache.get(competitionId);
  if (!map) return null;
  const norm = normalizeEventName(eventName);
  if (!norm) return null;
  return map.get(lookupKey(athleteKey, norm))?.pb?.resultText ?? null;
}

/** Synchronous lookup for the athlete's season best (current calendar year). */
export function getHistoricalSeasonBest(
  competitionId: number,
  athleteKey: string,
  eventName: string,
): string | null {
  const map = cache.get(competitionId);
  if (!map) return null;
  const norm = normalizeEventName(eventName);
  if (!norm) return null;
  return map.get(lookupKey(athleteKey, norm))?.sb?.resultText ?? null;
}

/** React hook: loads (or returns cached) historical baseline and re-renders
 * the calling component once the data is ready. Returns `dataUpdatedAt`
 * which can be included in `useMemo` deps to recompute derived rows. */
export function useHistoryBaseline(competitionId: number | null | undefined) {
  const q = useQuery({
    queryKey: ["history-baseline", competitionId ?? 0],
    queryFn: () => loadHistoryBaselineForCompetition(competitionId!),
    enabled: !!competitionId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  return { dataUpdatedAt: q.dataUpdatedAt, isLoading: q.isLoading };
}

export function useSharedHistoryBaseline(
  token: string | null | undefined,
  competitionId: number | null | undefined,
) {
  const q = useQuery({
    queryKey: ["history-baseline-shared", token ?? "", competitionId ?? 0],
    queryFn: () =>
      loadHistoryBaselineForSharedWatch(token!, competitionId!),
    enabled: !!token && !!competitionId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  return { dataUpdatedAt: q.dataUpdatedAt, isLoading: q.isLoading };
}
