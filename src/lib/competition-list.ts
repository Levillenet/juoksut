import { useEffect, useState } from "react";
import { fetchRounds, helsinkiDateKey } from "./tuloslista";

const API = "https://cached-public-api.tuloslista.com/live/v1";

export interface CompetitionListItem {
  Id: number;
  Name: string;
  OrganizationName: string;
  Date: string;
  Location: string;
}

export async function fetchCompetitionList(): Promise<CompetitionListItem[]> {
  const res = await fetch(`${API}/competition`);
  if (!res.ok) throw new Error(`Kisalistan haku epäonnistui (${res.status})`);
  return res.json();
}

/** Return competitions whose date matches today (Helsinki). */
export function filterToday(list: CompetitionListItem[]): CompetitionListItem[] {
  const today = helsinkiDateKey(new Date().toISOString());
  return list.filter((c) => helsinkiDateKey(c.Date) === today);
}

/** Return competitions within [today - pastDays, today + futureDays]. */
export function filterWindow(
  list: CompetitionListItem[],
  pastDays: number,
  futureDays: number,
): CompetitionListItem[] {
  const now = new Date();
  const startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - pastDays * 86_400_000;
  const endMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() + (futureDays + 1) * 86_400_000;
  return list.filter((c) => {
    const t = new Date(c.Date).getTime();
    return Number.isFinite(t) && t >= startMs && t < endMs;
  });
}

// Module-level cache of competition schedule dates (DD.MM.YYYY keys from RoundsByDate)
const scheduleCache = new Map<number, { dates: Set<string>; fetchedAt: number }>();
const SCHEDULE_TTL_MS = 10 * 60 * 1000;

async function getScheduleDates(competitionId: number): Promise<Set<string> | null> {
  const cached = scheduleCache.get(competitionId);
  if (cached && Date.now() - cached.fetchedAt < SCHEDULE_TTL_MS) {
    return cached.dates;
  }
  try {
    const rounds = await fetchRounds(competitionId);
    const dates = new Set<string>(Object.keys(rounds ?? {}));
    scheduleCache.set(competitionId, { dates, fetchedAt: Date.now() });
    return dates;
  } catch {
    return null;
  }
}

/**
 * Return competitions that are currently running today, including multi-day
 * competitions whose listed start Date is on a previous day. For competitions
 * whose start date is within the past `pastDaysLookback` days, fetch the
 * schedule and include those where today's Helsinki date appears in the
 * schedule's date keys.
 */
export async function filterRunningToday(
  list: CompetitionListItem[],
  pastDaysLookback = 6,
): Promise<CompetitionListItem[]> {
  const todayKey = helsinkiDateKey(new Date().toISOString());
  const now = new Date();
  const startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - pastDaysLookback * 86_400_000;
  const endMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() + 86_400_000;

  const candidates = list.filter((c) => {
    const t = new Date(c.Date).getTime();
    return Number.isFinite(t) && t >= startMs && t < endMs;
  });

  const todayMatches: CompetitionListItem[] = [];
  const needSchedule: CompetitionListItem[] = [];
  for (const c of candidates) {
    if (helsinkiDateKey(c.Date) === todayKey) {
      todayMatches.push(c);
    } else {
      needSchedule.push(c);
    }
  }

  const checked = await Promise.all(
    needSchedule.map(async (c) => {
      const dates = await getScheduleDates(c.Id);
      return dates && dates.has(todayKey) ? c : null;
    }),
  );

  return [...todayMatches, ...checked.filter((c): c is CompetitionListItem => c !== null)];
}

export function useTodayCompetitions() {
  const [list, setList] = useState<CompetitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await fetchCompetitionList();
        const running = await filterRunningToday(all);
        if (cancelled) return;
        setList(running.sort((a, b) => a.Date.localeCompare(b.Date)));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Tuntematon virhe");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { list, loading, error };
}

export function useCompetitionsWindow(pastDays = 7, futureDays = 21) {
  const [list, setList] = useState<CompetitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCompetitionList()
      .then((all) => {
        if (cancelled) return;
        const filtered = filterWindow(all, pastDays, futureDays).sort((a, b) =>
          a.Date.localeCompare(b.Date),
        );
        setList(filtered);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Tuntematon virhe");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pastDays, futureDays]);

  return { list, loading, error };
}
