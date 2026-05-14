import { useEffect, useState } from "react";

const KEY = "tuloslista.competitionId";
const DEFAULT_ID = 19219;

export function useCompetitionId(): [number, (id: number) => void] {
  const [id, setId] = useState<number>(DEFAULT_ID);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) {
        const n = parseInt(stored, 10);
        if (!isNaN(n)) setId(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const update = (next: number) => {
    setId(next);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  return [id, update];
}
