import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "@/integrations/supabase/client";

const KEY_BASE = "tuloslista.competitionId";
const DEFAULT_ID = 19219;
const META_KEY = "last_competition_id";

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

function setValueLocal(key: string, next: number) {
  valueByKey.set(key, next);
  try {
    localStorage.setItem(key, String(next));
  } catch {
    /* ignore */
  }
  listenersByKey.get(key)?.forEach((l) => l(next));
}

export function useCompetitionId(): [number, (id: number) => void] {
  const { role, user } = useAuth();
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

  // Hydrate from user metadata when (re)logging in — overrides local default
  // so the last selected competition follows the user across devices/sessions.
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const raw = meta[META_KEY];
    const remote = typeof raw === "number" ? raw : typeof raw === "string" ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(remote) || remote <= 0) return;
    if (getValue(key) === remote) return;
    setValueLocal(key, remote);
  }, [user, key]);

  const update = (next: number) => {
    setValueLocal(key, next);
    // Persist per-user so the choice survives logout/login on any device.
    if (user) {
      void supabase.auth.updateUser({ data: { [META_KEY]: next } }).catch(() => {
        /* ignore — local copy still saved */
      });
    }
  };

  return [id, update];
}
