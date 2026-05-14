import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";

import {
  fetchDailyBest,
  fetchTodayAgeClasses,
  sortAgeClass,
} from "@/lib/daily-best";

const STORAGE_KEY = "dailyBest.ageClasses";

function loadSelected(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveSelected(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function DailyBestSection() {
  const [selected, setSelected] = useState<string[]>(() => loadSelected());
  const [open, setOpen] = useState(true);

  const ageClassesQuery = useQuery({
    queryKey: ["daily-best", "age-classes"],
    queryFn: fetchTodayAgeClasses,
    staleTime: 5 * 60_000,
  });

  const bestQuery = useQuery({
    queryKey: ["daily-best", "rows", selected.slice().sort().join(",")],
    queryFn: () => fetchDailyBest(selected),
    enabled: selected.length > 0,
    staleTime: 60_000,
  });

  useEffect(() => saveSelected(selected), [selected]);

  const allClasses = ageClassesQuery.data ?? [];

  const toggle = (cls: string) =>
    setSelected((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls].sort(sortAgeClass),
    );

  const grouped = useMemo(() => {
    const rows = bestQuery.data ?? [];
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = m.get(r.age_class) ?? [];
      arr.push(r);
      m.set(r.age_class, arr);
    }
    return Array.from(m.entries()).sort((a, b) => sortAgeClass(a[0], b[0]));
  }, [bestQuery.data]);

  return (
    <section className="mb-4 rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Trophy className="h-4 w-4 text-primary" />
        <h2 className="flex-1 text-sm font-bold">Päivän parhaat tulokset ympäri Suomen</h2>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          {ageClassesQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Ladataan ikäluokkia…</p>
          ) : allClasses.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Tälle päivälle ei vielä ole tuloksia tietokannassa. Tausta-ajo
              kerää tuloksia tuloslistalta — tarkista hetken kuluttua.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {allClasses.map((c) => {
                  const on = selected.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggle(c)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-secondary"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              {selected.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Valitse yksi tai useampi ikäluokka yltä.
                </p>
              ) : bestQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Ladataan…</p>
              ) : grouped.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Ei vielä tuloksia valituista ikäluokista tänään.
                </p>
              ) : (
                <div className="space-y-3">
                  {grouped.map(([age, rows]) => (
                    <div key={age}>
                      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {age}
                      </h3>
                      <ul className="divide-y divide-border rounded-lg border bg-background/50">
                        {rows.map((r) => (
                          <li
                            key={`${r.event_name}|${r.competition_id}|${r.surname}-${r.firstname}`}
                            className="flex items-baseline gap-3 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {r.event_name}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {r.surname} {r.firstname} ({r.organization}) ·{" "}
                                {r.competition_name}
                              </p>
                            </div>
                            <span className="shrink-0 text-base font-bold tabular-nums">
                              {r.result_text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
