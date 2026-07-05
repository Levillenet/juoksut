import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award } from "lucide-react";
import { AGE_CLASSES, fetchDistrictRecords, type DistrictRecord } from "@/lib/district-records";

export const Route = createFileRoute("/piirienn")({
  head: () => ({
    meta: [
      { title: "Lahden piirin piiriennätykset (P/T 8–22) — Tulokset online" },
      {
        name: "description",
        content:
          "Kaikki Lahden yleisurheilupiirin sisulisäsarjojen piiriennätykset ikäluokittain (P8–P22, T8–T22).",
      },
      { property: "og:title", content: "Lahden piirin piiriennätykset" },
      {
        property: "og:description",
        content:
          "Sisulisäsarjojen (poikien ja tyttöjen) voimassa olevat piiriennätykset Lahden piirissä.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DistrictRecordsPage,
});

function DistrictRecordsPage() {
  const [activeAge, setActiveAge] = useState<string>("P15");
  const query = useQuery({
    queryKey: ["district-records", "all"],
    queryFn: fetchDistrictRecords,
    staleTime: 10 * 60_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, DistrictRecord[]>();
    for (const r of query.data ?? []) {
      if (!map.has(r.age_class)) map.set(r.age_class, []);
      map.get(r.age_class)!.push(r);
    }
    return map;
  }, [query.data]);

  const rows = grouped.get(activeAge) ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-md p-1 hover:bg-secondary" aria-label="Takaisin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate text-base font-semibold leading-tight">
              <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Lahden piirin piiriennätykset
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Sisulisäsarjat (poikien P8–P22, tyttöjen T8–T22)
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <section className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {AGE_CLASSES.map((ac) => {
              const has = (grouped.get(ac)?.length ?? 0) > 0;
              return (
                <button
                  key={ac}
                  onClick={() => setActiveAge(ac)}
                  disabled={!has}
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    ac === activeAge
                      ? "bg-primary text-primary-foreground"
                      : has
                        ? "bg-muted text-muted-foreground hover:bg-secondary"
                        : "opacity-40"
                  }`}
                >
                  {ac}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-sm">
          {query.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Ladataan…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Ei ennätyksiä ikäluokassa {activeAge}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Laji</th>
                    <th className="px-3 py-2">Tulos</th>
                    <th className="px-3 py-2">Tekijä</th>
                    <th className="px-3 py-2 hidden sm:table-cell">Seura</th>
                    <th className="px-3 py-2 text-right">Vuosi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium">{r.event_name_raw}</td>
                      <td className="px-3 py-2 tabular-nums font-bold">
                        {r.result_text}
                        {r.indoor && (
                          <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                            halli
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.record_holder}
                        {r.birth_year && (
                          <span className="text-[11px] text-muted-foreground">
                            {" "}
                            -{String(r.birth_year).slice(-2)}
                          </span>
                        )}
                        <span className="ml-1 text-[11px] text-muted-foreground sm:hidden">
                          · {r.club}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">
                        {r.club}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.record_year ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="px-2 text-[11px] text-muted-foreground">
          Lähde: Lahden yleisurheilupiirin piiriennätystiedosto (31.12.2025).
          Uudet piiriennätykset merkitään automaattisesti PE-merkinnällä, kun jonkin
          piiriin kuuluvan nykyseuran urheilija rikkoo ennätyksen.
        </p>
      </main>
    </div>
  );
}
