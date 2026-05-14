import { useEffect, useState } from "react";
import { useAuth } from "./auth";

const KEY_BASE = "tuloslista.competitionId";
const DEFAULT_ID = 19219;

function keyFor(role: string | null): string {
  // Eri valinta toimitsija- ja käyttäjäroolille, jotta kirjautuminen
  // sisään/ulos ei vaihda toisen näkymän aktiivista kisaa.
  return role === "official" ? `${KEY_BASE}.official` : `${KEY_BASE}.user`;
}

const listenersByKey = new Map<string, Set<(id: number) => void>>();
const valueByKey = new Map<string, number>();

function getValue(key: string): number {
  if (valueByKey.has(key)) return valueByKey.get(key)!;
  let v = DEFAULT_ID;
  try {
    // Migraatio: vanha yhteinen avain, jos roolikohtaista ei vielä ole
    const stored =
      localStorage.getItem(key) ?? localStorage.getItem(KEY_BASE);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n)) v = n;
    }
  } catch {
    /* ignore */
  }
  valueByKey.set(key, v);
  return v;
}

export function useCompetitionId(): [number, (id: number) => void] {
  const { role } = useAuth();
  const key = keyFor(role);
  const [id, setId] = useState<number>(() => getValue(key));

  useEffect(() => {
    setId(getValue(key));
    let set = listenersByKey.get(key);
    if (!set) {
      set = new Set();
      listenersByKey.set(key, set);
    }
    set.add(setId);
    return () => {
      set!.delete(setId);
    };
  }, [key]);

  const update = (next: number) => {
    valueByKey.set(key, next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      /* ignore */
    }
    listenersByKey.get(key)?.forEach((l) => l(next));
  };

  return [id, update];
}
