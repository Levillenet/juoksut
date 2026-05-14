import { useEffect, useState } from "react";
import { helsinkiDateKey } from "./tuloslista";

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

export function useTodayCompetitions() {
  return useCompetitionsWindow(0, 0);
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

