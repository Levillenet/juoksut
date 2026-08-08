import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface PickedAthlete {
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string | null;
  organization_id: number | null;
}

interface Props {
  onPick: (a: PickedAthlete) => void;
  existingKeys: Set<string>;
}

/**
 * Haetaan urheilijat kerätystä tulostietokannasta, jotta kiinnitys onnistuu
 * riippumatta siitä mikä kilpailu on seurannassa.
 */
export function OfficialAthletePicker({ onPick, existingKeys }: Props) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PickedAthlete[]>([]);
  const [loading, setLoading] = useState(false);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        const { data } = await supabase
          .from("athlete_results")
          .select("athlete_key, surname, firstname, organization, organization_id")
          .or(`surname.ilike.%${term}%,firstname.ilike.%${term}%`)
          .limit(300);
        if (cancelled) return;
        const map = new Map<string, PickedAthlete>();
        for (const r of data ?? []) {
          if (!map.has(r.athlete_key)) {
            map.set(r.athlete_key, {
              athlete_key: r.athlete_key,
              surname: r.surname,
              firstname: r.firstname,
              organization: r.organization ?? null,
              organization_id: r.organization_id ?? null,
            });
          }
        }
        setRows(
          Array.from(map.values()).sort((a, b) =>
            `${a.surname} ${a.firstname}`.localeCompare(`${b.surname} ${b.firstname}`, "fi"),
          ),
        );
        setLoading(false);
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  const visible = useMemo(() => rows.slice(0, 25), [rows]);

  return (
    <div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hae urheilijaa nimellä"
          className="pl-9"
          aria-label="Hae urheilijaa nimellä"
        />
      </div>
      {loading && <p className="mt-2 text-xs text-muted-foreground">Haetaan…</p>}
      {!loading && term.length >= 2 && visible.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Ei osumia haulla "{term}".</p>
      )}
      <ul className="mt-2 divide-y divide-border">
        {visible.map((a) => {
          const added = existingKeys.has(a.athlete_key);
          return (
            <li key={a.athlete_key} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {a.surname} {a.firstname}
                </p>
                {a.organization && (
                  <p className="truncate text-xs text-muted-foreground">{a.organization}</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant={added ? "secondary" : "outline"}
                disabled={added}
                onClick={() => onPick(a)}
              >
                <Plus className="h-4 w-4" />
                <span className="ml-1">{added ? "Lisätty" : "Kiinnitä"}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
