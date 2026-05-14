import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import {
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
  translateSub,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import {
  competitionIndexQueryOptions,
  type IndexedEntry,
} from "@/lib/tuloslista-queries";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/print/club")({
  validateSearch: (search: Record<string, unknown>) => ({
    org: typeof search.org === "string" ? parseInt(search.org, 10) : Number(search.org) || 0,
    auto: search.auto === "1" || search.auto === 1 || search.auto === true,
  }),
  head: () => ({
    meta: [
      { title: "Seuran ohjelma – tulostettava" },
      {
        name: "description",
        content: "Päiväkohtainen kilpailuohjelma valitun seuran urheilijoista.",
      },
    ],
  }),
  component: PrintClubPage,
});

function PrintClubPage() {
  const [competitionId] = useCompetitionId();
  const { org, auto } = Route.useSearch();
  const indexQuery = useQuery(competitionIndexQueryOptions(competitionId));

  const entries: IndexedEntry[] = indexQuery.data?.entries ?? [];
  const compName = indexQuery.data?.name ?? "";

  const orgName = useMemo(() => {
    const e = entries.find((x) => (x.alloc.Organization?.Id ?? -1) === org);
    return e?.alloc.Organization?.Name ?? "";
  }, [entries, org]);

  const grouped = useMemo(() => {
    // Filter to allocations of selected club
    const filtered = entries.filter(
      (e) => (e.alloc.Organization?.Id ?? -1) === org,
    );

    // Group by date -> round -> entries
    const byDate = new Map<string, Map<number, { round: IndexedEntry["round"]; allocs: IndexedEntry[] }>>();
    for (const e of filtered) {
      const dk = helsinkiDateKey(e.heatBegin);
      if (!byDate.has(dk)) byDate.set(dk, new Map());
      const rounds = byDate.get(dk)!;
      if (!rounds.has(e.round.Id)) {
        rounds.set(e.round.Id, { round: e.round, allocs: [] });
      }
      rounds.get(e.round.Id)!.allocs.push(e);
    }

    return Array.from(byDate.entries())
      .sort((a, b) => {
        const [da, ma, ya] = a[0].split(".").map(Number);
        const [db, mb, yb] = b[0].split(".").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      })
      .map(([date, rounds]) => ({
        date,
        rounds: Array.from(rounds.values())
          .sort((a, b) =>
            a.round.BeginDateTimeWithTZ.localeCompare(b.round.BeginDateTimeWithTZ),
          )
          .map((g) => ({
            ...g,
            allocs: [...g.allocs].sort((a, b) => {
              if (a.heatIndex !== b.heatIndex) return a.heatIndex - b.heatIndex;
              return (a.alloc.Position ?? 0) - (b.alloc.Position ?? 0);
            }),
          })),
      }));
  }, [entries, org]);

  // Auto-trigger print when ready
  useEffect(() => {
    if (auto && !indexQuery.isLoading && grouped.length > 0) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [auto, indexQuery.isLoading, grouped.length]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/watch">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              Seuran ohjelma
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {orgName || "Seura"} · {compName || `Kisa #${competitionId}`}
            </p>
          </div>
          <Button onClick={() => window.print()} size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Tulosta / PDF
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 print:py-2">
        <div className="mb-6">
          <h1 className="text-xl font-bold print:text-lg">
            {compName || `Kisa #${competitionId}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Päiväkohtainen ohjelma — {orgName || "Seura"}
          </p>
        </div>

        {indexQuery.isLoading && entries.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ladataan…
          </p>
        )}

        {!indexQuery.isLoading && grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ei lähtöjä valitulla seuralla.
          </p>
        )}

        {grouped.map((g) => (
          <section key={g.date} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 border-b-2 border-primary pb-1 text-lg font-bold print:text-base">
              {g.date}
            </h2>
            <table className="w-full text-sm print:text-xs">
              <tbody>
                {g.rounds.map(({ round, allocs }) => {
                  const isRun = isRunningEvent(round);
                  return (
                    <tr key={round.Id} className="border-b border-border/50 align-top">
                      <td className="w-14 py-2 pr-2 font-bold tabular-nums">
                        {formatTime(round.BeginDateTimeWithTZ)}
                      </td>
                      <td className="py-2">
                        <div className="font-semibold leading-tight">
                          {round.EventName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {round.SubCategory && translateSub(round.SubCategory)}
                          {round.Name && ` · ${round.Name}`}
                        </div>
                        <ul className="mt-1 space-y-0.5 text-sm print:text-xs">
                          {allocs.map((e, idx) => (
                            <li
                              key={`${e.alloc.Id}-${idx}`}
                              className="flex flex-wrap items-baseline gap-x-2"
                            >
                              <span className="font-medium">
                                {e.alloc.Surname} {e.alloc.Firstname}
                              </span>
                              {e.alloc.Number && (
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  #{e.alloc.Number}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {isRun
                                  ? `Erä ${e.heatIndex}${e.alloc.Position != null ? ` · Rata ${e.alloc.Position}` : ""}`
                                  : e.alloc.Position != null
                                    ? `Järj. ${e.alloc.Position}`
                                    : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}

        <p className="mt-8 text-center text-xs text-muted-foreground print:mt-4">
          Lähde: live.tuloslista.com · Tulostettu {new Date().toLocaleString("fi-FI")}
        </p>
      </main>
    </div>
  );
}
