import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Users } from "lucide-react";

import {
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import {
  competitionIndexQueryOptions,
  type IndexedEntry,
} from "@/lib/tuloslista-queries";
import { useWatchedAthletes } from "@/lib/watch-store";
import { Button } from "@/components/ui/button";
import { CompetitionSwitcher } from "@/components/CompetitionSwitcher";
import { RequireRole } from "@/components/RequireRole";
import { PrintTabs } from "@/components/PrintTabs";

export const Route = createFileRoute("/print/watched")({
  validateSearch: (search: Record<string, unknown>) => ({
    auto: search.auto === "1" || search.auto === 1 || search.auto === true,
  }),
  head: () => ({
    meta: [
      { title: "Seurattujen ohjelma – tulostettava" },
      {
        name: "description",
        content:
          "Päiväkohtainen kilpailuohjelma omassa seurannassa olevista urheilijoista.",
      },
    ],
  }),
  component: () => (
    <RequireRole allow={["user"]}>
      <PrintWatchedPage />
    </RequireRole>
  ),
});

function PrintWatchedPage() {
  const [competitionId] = useCompetitionId();
  const { auto } = Route.useSearch();
  const { list: watched } = useWatchedAthletes();
  const indexQuery = useQuery(competitionIndexQueryOptions(competitionId));

  const entries: IndexedEntry[] = indexQuery.data?.entries ?? [];
  const compName = indexQuery.data?.name ?? "";

  const watchedKeys = useMemo(
    () => new Set(watched.map((w) => `${w.surname}|${w.firstname}|${w.organizationId ?? ""}`)),
    [watched],
  );

  const grouped = useMemo(() => {
    if (watchedKeys.size === 0) return [] as Array<{
      date: string;
      rounds: Array<{ round: IndexedEntry["round"]; allocs: IndexedEntry[] }>;
    }>;
    const filtered = entries.filter((e) => {
      const k = `${e.alloc.Surname}|${e.alloc.Firstname}|${e.alloc.Organization?.Id ?? ""}`;
      return watchedKeys.has(k);
    });
    const byDate = new Map<
      string,
      Map<number, { round: IndexedEntry["round"]; allocs: IndexedEntry[] }>
    >();
    for (const e of filtered) {
      const dk = helsinkiDateKey(e.heatBegin);
      if (!byDate.has(dk)) byDate.set(dk, new Map());
      const rounds = byDate.get(dk)!;
      if (!rounds.has(e.round.Id)) rounds.set(e.round.Id, { round: e.round, allocs: [] });
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
              const ar = a.alloc.ResultRank;
              const br = b.alloc.ResultRank;
              const hasRank = g.allocs.some((x) => x.alloc.ResultRank != null);
              if (hasRank) {
                const av = ar ?? Number.POSITIVE_INFINITY;
                const bv = br ?? Number.POSITIVE_INFINITY;
                if (av !== bv) return av - bv;
              }
              if (a.heatIndex !== b.heatIndex) return a.heatIndex - b.heatIndex;
              return (a.alloc.Position ?? 0) - (b.alloc.Position ?? 0);
            }),
          })),
      }));
  }, [entries, watchedKeys]);

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
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              Seurattujen ohjelma
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {watched.length} urheilijaa · {compName || `Kisa #${competitionId}`}
            </p>
          </div>
          <Button
            onClick={() => window.print()}
            size="sm"
            className="gap-2"
            disabled={grouped.length === 0}
          >
            <Printer className="h-4 w-4" />
            Tulosta / PDF
          </Button>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <CompetitionSwitcher className="w-full" />
        </div>
      </header>

      <PrintTabs />

      <main className="mx-auto max-w-3xl px-4 py-6 print:py-2">
        <div className="mb-6">
          <h1 className="text-xl font-bold print:text-lg">
            {compName || `Kisa #${competitionId}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ohjelma seurannassa olevista urheilijoista
          </p>
        </div>

        {watched.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground print:hidden">
            <Users className="mx-auto mb-2 h-6 w-6 opacity-60" />
            Ei urheilijoita seurannassa. Lisää urheilijoita
            {" "}
            <Link to="/watch" className="text-primary underline">
              kilpailijaseurannassa
            </Link>
            .
          </p>
        )}

        {watched.length > 0 && indexQuery.isLoading && entries.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
        )}

        {watched.length > 0 && !indexQuery.isLoading && grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Seuratuilla ei ole lähtöjä tässä kisassa.
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
                        {round.Name && (
                          <div className="text-xs text-muted-foreground">
                            {round.Name}
                          </div>
                        )}
                        <ul className="mt-1 space-y-0.5 text-sm print:text-xs">
                          {allocs.map((e, idx) => (
                            <li
                              key={`${e.alloc.Id}-${idx}`}
                              className="flex flex-wrap items-baseline gap-x-2"
                            >
                              <span className="font-medium">
                                {e.alloc.Surname} {e.alloc.Firstname}
                              </span>
                              {e.alloc.Organization?.NameShort && (
                                <span className="text-xs text-muted-foreground">
                                  {e.alloc.Organization.NameShort}
                                </span>
                              )}
                              {e.alloc.Number && (
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  #{e.alloc.Number}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {e.fromEnrollment
                                  ? "Eräjako tekemättä"
                                  : isRun
                                    ? `Erä ${e.heatIndex}${e.alloc.Position ? ` · Rata ${e.alloc.Position}` : ""}`
                                    : e.alloc.Position
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
