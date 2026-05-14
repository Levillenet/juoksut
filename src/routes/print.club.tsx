import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Building2 } from "lucide-react";

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
import { CompetitionSwitcher } from "@/components/CompetitionSwitcher";

export const Route = createFileRoute("/print/club")({
  validateSearch: (search: Record<string, unknown>) => ({
    org:
      typeof search.org === "string"
        ? parseInt(search.org, 10)
        : Number(search.org) || 0,
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
  const navigate = useNavigate();
  const indexQuery = useQuery(competitionIndexQueryOptions(competitionId));

  const entries: IndexedEntry[] = indexQuery.data?.entries ?? [];
  const compName = indexQuery.data?.name ?? "";

  // All clubs that appear in the current competition (id + name + athlete count)
  const clubs = useMemo(() => {
    const map = new Map<number, { id: number; name: string; athletes: Set<string> }>();
    for (const e of entries) {
      const id = e.alloc.Organization?.Id;
      if (id == null) continue;
      const nm = e.alloc.Organization?.Name ?? "";
      if (!map.has(id)) map.set(id, { id, name: nm, athletes: new Set() });
      map.get(id)!.athletes.add(`${e.alloc.Surname}|${e.alloc.Firstname}`);
    }
    return Array.from(map.values())
      .map((c) => ({ id: c.id, name: c.name, athletes: c.athletes.size }))
      .sort((a, b) => a.name.localeCompare(b.name, "fi"));
  }, [entries]);

  const orgName = useMemo(() => {
    const e = entries.find((x) => (x.alloc.Organization?.Id ?? -1) === org);
    return e?.alloc.Organization?.Name ?? "";
  }, [entries, org]);

  const grouped = useMemo(() => {
    if (!org) return [] as Array<{
      date: string;
      rounds: Array<{ round: IndexedEntry["round"]; allocs: IndexedEntry[] }>;
    }>;
    // Filter to allocations of selected club
    const filtered = entries.filter(
      (e) => (e.alloc.Organization?.Id ?? -1) === org,
    );

    // Group by date -> round (= event round) -> entries
    const byDate = new Map<
      string,
      Map<number, { round: IndexedEntry["round"]; allocs: IndexedEntry[] }>
    >();
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

  // Auto-trigger print when ready (only when org is preselected via URL)
  useEffect(() => {
    if (auto && org && !indexQuery.isLoading && grouped.length > 0) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [auto, org, indexQuery.isLoading, grouped.length]);

  const setOrg = (id: number) => {
    navigate({
      to: "/print/club",
      search: { org: id, auto: false },
      replace: true,
    });
  };

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
              {orgName || "Valitse seura"} ·{" "}
              {compName || `Kisa #${competitionId}`}
            </p>
          </div>
          <Button
            onClick={() => window.print()}
            size="sm"
            className="gap-2"
            disabled={!org || grouped.length === 0}
          >
            <Printer className="h-4 w-4" />
            Tulosta / PDF
          </Button>
        </div>

        {/* Competition + club selectors */}
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 pb-3 sm:flex-row">
          <CompetitionSwitcher className="flex-1" />
          <div className="relative flex-1">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={org || ""}
              onChange={(e) => setOrg(parseInt(e.target.value, 10) || 0)}
              className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Valitse seura"
              disabled={clubs.length === 0}
            >
              <option value="">
                {clubs.length === 0
                  ? indexQuery.isLoading
                    ? "Ladataan seuroja…"
                    : "Ei seuroja"
                  : `Valitse seura (${clubs.length})`}
              </option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.athletes})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 print:py-2">
        <div className="mb-6">
          <h1 className="text-xl font-bold print:text-lg">
            {compName || `Kisa #${competitionId}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ohjelma lajeittain — {orgName || "Seura"}
          </p>
        </div>

        {!org && (
          <p className="py-12 text-center text-sm text-muted-foreground print:hidden">
            Valitse kisa ja seura yltä, niin ohjelma näkyy lajeittain.
          </p>
        )}

        {org && indexQuery.isLoading && entries.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ladataan…
          </p>
        )}

        {org && !indexQuery.isLoading && grouped.length === 0 && (
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
