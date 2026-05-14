import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const KEY = "tuloslista.watchedAthletes";

export interface WatchedAthlete {
  key: string; // stable: surname|firstname|orgId
  surname: string;
  firstname: string;
  organization: string;
  organizationId: number | null;
}

function readLocal(): WatchedAthlete[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeLocal(list: WatchedAthlete[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function useWatchedAthletes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [list, setList] = useState<WatchedAthlete[]>([]);
  const migratedFor = useRef<string | null>(null);

  // Load + migrate on auth change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        setList(readLocal());
        return;
      }
      // One-time migration of any localStorage entries to user's row set
      const local = readLocal();
      if (local.length > 0 && migratedFor.current !== userId) {
        migratedFor.current = userId;
        try {
          await supabase.from("watched_athletes").upsert(
            local.map((a) => ({
              user_id: userId,
              athlete_key: a.key,
              surname: a.surname,
              firstname: a.firstname,
              organization: a.organization,
              organization_id: a.organizationId,
            })),
            { onConflict: "user_id,athlete_key", ignoreDuplicates: true },
          );
          writeLocal([]);
        } catch {
          /* ignore */
        }
      }
      const { data } = await supabase
        .from("watched_athletes")
        .select("athlete_key, surname, firstname, organization, organization_id")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setList(
        (data ?? []).map((r) => ({
          key: r.athlete_key,
          surname: r.surname,
          firstname: r.firstname,
          organization: r.organization ?? "",
          organizationId: r.organization_id,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const add = useCallback(
    async (a: WatchedAthlete) => {
      setList((prev) => (prev.some((p) => p.key === a.key) ? prev : [...prev, a]));
      if (!userId) {
        const cur = readLocal();
        if (!cur.some((p) => p.key === a.key)) writeLocal([...cur, a]);
        return;
      }
      await supabase.from("watched_athletes").upsert(
        {
          user_id: userId,
          athlete_key: a.key,
          surname: a.surname,
          firstname: a.firstname,
          organization: a.organization,
          organization_id: a.organizationId,
        },
        { onConflict: "user_id,athlete_key", ignoreDuplicates: true },
      );
    },
    [userId],
  );

  const remove = useCallback(
    async (key: string) => {
      setList((prev) => prev.filter((p) => p.key !== key));
      if (!userId) {
        writeLocal(readLocal().filter((p) => p.key !== key));
        return;
      }
      await supabase
        .from("watched_athletes")
        .delete()
        .eq("user_id", userId)
        .eq("athlete_key", key);
    },
    [userId],
  );

  const clear = useCallback(async () => {
    setList([]);
    if (!userId) {
      writeLocal([]);
      return;
    }
    await supabase.from("watched_athletes").delete().eq("user_id", userId);
  }, [userId]);

  return { list, add, remove, clear };
}

export function athleteKey(surname: string, firstname: string, orgId: number | null): string {
  return `${surname}|${firstname}|${orgId ?? ""}`;
}
