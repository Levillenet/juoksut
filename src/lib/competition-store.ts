import { useEffect, useState } from "react";

const KEY = "tuloslista.competitionId";
const DEFAULT_ID = 19219;

type Listener = (id: number) => void;
const listeners = new Set<Listener>();
let currentId: number = DEFAULT_ID;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n)) currentId = n;
    }
  } catch {
    /* ignore */
  }
}

export function useCompetitionId(): [number, (id: number) => void] {
  init();
  const [id, setId] = useState<number>(currentId);

  useEffect(() => {
    const listener: Listener = (next) => setId(next);
    listeners.add(listener);
    // Sync in case currentId changed before subscription
    if (currentId !== id) setId(currentId);
    return () => {
      listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (next: number) => {
    currentId = next;
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l(next));
  };

  return [id, update];
}
