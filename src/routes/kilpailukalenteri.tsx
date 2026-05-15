import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  getExternalCompetitions,
  type ExternalCompetitionRow,
} from "@/lib/external-competitions.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/kilpailukalenteri")({
  component: KilpailukalenteriPage,
  head: () => ({
    meta: [
      { title: "Kilpailukalenteri – tulevat yleisurheilukisat" },
      {
        name: "description",
        content:
          "Hae tulevat yleisurheilukisat luokituksen, paikkakunnan tai päivämäärän mukaan. Lähde: kilpailukalenteri.fi.",
      },
    ],
  }),
});

const FIN_WEEKDAYS = ["su", "ma", "ti", "ke", "to", "pe", "la"];

function formatRange(start: string, end: string | null): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const wd = FIN_WEEKDAYS[startDate.getDay()];
  const startStr = `${wd} ${String(sd).padStart(2, "0")}.${String(sm).padStart(2, "0")}.`;
  if (!end || end === start) return startStr;
  const [, em, ed] = end.split("-").map(Number);
  if (em === sm) {
    return `${wd} ${String(sd).padStart(2, "0")}.–${String(ed).padStart(2, "0")}.${String(sm).padStart(2, "0")}.`;
  }
  return `${startStr} – ${String(ed).padStart(2, "0")}.${String(em).padStart(2, "0")}.`;
}

function classificationLabel(c: string): string {
  const m: Record<string, string> = {
    SM: "SM",
    pk: "Piirin myöntämä",
    ak: "Kansallinen am",
    pm: "Piirinmestaruus",
    seura: "Seurakisa",
    maantie: "Maantie",
    kävely: "Kävely",
  };
  return m[c] ?? c;
}

const ALL_CLASSES = [
  "SM",
  "ak",
  "pk",
  "pm",
  "seura",
  "maantie",
  "kävely",
];

function KilpailukalenteriPage() {
  const fetchFn = useServerFn(getExternalCompetitions);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["external-competitions"],
    queryFn: () => fetchFn(),
    staleTime: 60 * 60 * 1000,
  });

  const [search, setSearch] = useState("");
  const [activeClasses, setActiveClasses] = useState<Set<string>>(new Set());
  const [daysAhead, setDaysAhead] = useState<number>(60);

  const filtered = useMemo(() => {
    const rows: ExternalCompetitionRow[] = data?.rows ?? [];
    const term = search.trim().toLowerCase();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

    return rows.filter((r) => {
      if (r.start_date > cutoffKey) return false;
      if (activeClasses.size > 0 && !activeClasses.has(r.classification)) return false;
      if (term) {
        const hay = `${r.name} ${r.location} ${r.classification}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [data, search, activeClasses, daysAhead]);

  const grouped = useMemo(() => {
    const byDate = new Map<string, ExternalCompetitionRow[]>();
    for (const r of filtered) {
      const arr = byDate.get(r.start_date) ?? [];
      arr.push(r);
      byDate.set(r.start_date, arr);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggleClass = (c: string) => {
    setActiveClasses((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← Etusivulle
        </Link>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Päivitetään…" : "Päivitä"}
        </Button>
      </div>

      <h1 className="text-2xl font-bold">Kilpailukalenteri</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tulevat yleisurheilukisat. Lähde:{" "}
        <a
          href="https://www.kilpailukalenteri.fi/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          kilpailukalenteri.fi
        </a>
        {data?.state?.last_run_at && (
          <>
            {" "}
            · päivitetty{" "}
            {new Date(data.state.last_run_at).toLocaleString("fi-FI", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </>
        )}
      </p>

      <div className="mt-4 space-y-3">
        <Input
          placeholder="Hae nimellä tai paikkakunnalla…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {ALL_CLASSES.map((c) => {
            const on = activeClasses.has(c);
            return (
              <button
                key={c}
                onClick={() => toggleClass(c)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-secondary"
                }`}
              >
                {classificationLabel(c)}
              </button>
            );
          })}
          {activeClasses.size > 0 && (
            <button
              onClick={() => setActiveClasses(new Set())}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
            >
              Tyhjennä
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Aikaväli:</span>
          {[14, 30, 60, 120, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDaysAhead(d)}
              className={`rounded-full border px-3 py-1 transition ${
                daysAhead === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
            >
              {d === 365 ? "Vuosi" : `${d} pv`}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="mt-8 text-center text-sm text-muted-foreground">Ladataan…</div>
      )}
      {error && (
        <div className="mt-8 text-center text-sm text-destructive">
          Virhe: {error instanceof Error ? error.message : "tuntematon"}
        </div>
      )}

      {!isLoading && !error && grouped.length === 0 && (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Ei kisoja valituilla suodattimilla.
        </div>
      )}

      <div className="mt-4 space-y-4">
        {grouped.map(([date, rows]) => (
          <div key={date}>
            <div className="sticky top-0 z-10 -mx-4 mb-2 bg-background/95 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
              {formatRange(date, null)}
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {rows.map((r) => (
                <li key={r.source_id} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {r.name}
                      </a>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {r.location}
                        {r.end_date && r.end_date !== r.start_date && (
                          <> · {formatRange(r.start_date, r.end_date)}</>
                        )}
                        {r.registration_deadline && (
                          <> · ilm. päättyy {r.registration_deadline}</>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {classificationLabel(r.classification)}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
