import { useEffect, useState, useCallback } from "react";

const KEY = "tuloslista.watchedAthletes";

export interface WatchedAthlete {
  key: string; // stable: surname|firstname|orgId
  surname: string;
  firstname: string;
  organization: string;
  organizationId: number | null;
}

function read(): WatchedAthlete[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(list: WatchedAthlete[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function useWatchedAthletes() {
  const [list, setList] = useState<WatchedAthlete[]>([]);

  useEffect(() => {
    setList(read());
  }, []);

  const add = useCallback((a: WatchedAthlete) => {
    setList((prev) => {
      if (prev.some((p) => p.key === a.key)) return prev;
      const next = [...prev, a];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((key: string) => {
    setList((prev) => {
      const next = prev.filter((p) => p.key !== key);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setList([]);
    write([]);
  }, []);

  return { list, add, remove, clear };
}

export function athleteKey(surname: string, firstname: string, orgId: number | null): string {
  return `${surname}|${firstname}|${orgId ?? ""}`;
}
