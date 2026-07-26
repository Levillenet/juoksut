import { useEffect, useState } from "react";
import { fetchRounds, helsinkiDateKey } from "./tuloslista";

// Käytetään sisäistä proxya, jotta selain ei törmää CORS/verkko-ongelmiin
// suoraan upstream-osoitteeseen. Muut tuloslistan endpointit menevät jo
// saman proxyn läpi (`/api/public/tuloslista/…`).
const LIST_URL = "/api/public/tuloslista/live/v1/competition";

export interface CompetitionListItem {
  Id: number;
  Name: string;
  OrganizationName: string;
  Date: string;
  Location: string;
}

export async function fetchCompetitionList(): Promise<CompetitionListItem[]> {
  const res = await fetch(LIST_URL);
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

// Monipäiväisten kisojen jatkopäivät luetaan omasta tietokannasta
// (`harvest_competitions.last_event_date`), ei enää hakemalla jokaisen
// kilpailun aikataulua erikseen tuloslistalta. Aiemmin tämä tuotti kymmeniä
// rinnakkaisia origin-kutsuja jokaista kävijää kohti.
let runningIdsCache: { ids: Set<number>; fetchedAt: number } | null = null;
const RUNNING_IDS_TTL_MS = 5 * 60 * 1000;

async function fetchRunningTodayIds(): Promise<Set<number>> {
  if (runningIdsCache && Date.now() - runningIdsCache.fetchedAt < RUNNING_IDS_TTL_MS) {
    return runningIdsCache.ids;
  }
  const ids = new Set<number>();
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const now = new Date();
    const fromIso = new Date(now.getTime() - 14 * 86_400_000).toISOString();
    const { data } = await supabase
      .from("harvest_competitions")
      .select("competition_id, competition_date, last_event_date, exists_in_source")
      .gte("competition_date", fromIso)
      .limit(500);
    const todayKey = helsinkiDateKey(now.toISOString());
    const [d, m, y] = todayKey.split(".").map(Number);
    const todayIsoKey = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    for (const row of data ?? []) {
      if (row.exists_in_source === false) continue;
      const startKey = row.competition_date
        ? new Date(row.competition_date).toISOString().slice(0, 10)
        : null;
      const endKey = row.last_event_date ?? startKey;
      if (!startKey || !endKey) continue;
      if (startKey <= todayIsoKey && todayIsoKey <= endKey) ids.add(row.competition_id);
    }
    runningIdsCache = { ids, fetchedAt: Date.now() };
  } catch {
    /* tietokanta ei käytettävissä — palautetaan tyhjä joukko */
  }
  return ids;
}

/**
 * Return competitions that are currently running today, including multi-day
 * competitions whose listed start Date is on a previous day. Jatkopäivät
 * tunnistetaan tietokannan `last_event_date`-kentästä.
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

  if (needSchedule.length === 0) return todayMatches;

  const runningIds = await fetchRunningTodayIds();
  return [...todayMatches, ...needSchedule.filter((c) => runningIds.has(c.Id))];
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
