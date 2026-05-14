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

export function useTodayCompetitions() {
  const [list, setList] = useState<CompetitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCompetitionList()
      .then((all) => {
        if (cancelled) return;
        setList(filterToday(all));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Tuntematon virhe");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { list, loading, error };
}
