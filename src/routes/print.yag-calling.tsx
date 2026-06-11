import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Users } from "lucide-react";

import { competitionIndexQueryOptions } from "@/lib/tuloslista-queries";
import { useWatchedAthletes } from "@/lib/watch-store";
import { matchYagCalling } from "@/lib/yag-calling-match";
import { YAG_COMPETITION_ID } from "@/data/yag-calling";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/RequireRole";
import { PrintTabs } from "@/components/PrintTabs";
import { usePrintOrientation, type Orientation } from "@/hooks/usePrintOrientation";

const DATE_LABEL: Record<string, string> = {
  "2026-06-12": "Perjantai 12.6.2026",
  "2026-06-13": "Lauantai 13.6.2026",
  "2026-06-14": "Sunnuntai 14.6.2026",
};

export const Route = createFileRoute("/print/yag-calling")({
  validateSearch: (search: Record<string, unknown>) => ({
    auto: search.auto === "1" || search.auto === 1 || search.auto === true,
  }),
  head: () => ({
    meta: [
      { title: "YAG Calling-aikataulu – seuratut urheilijat" },
      {
        name: "description",
        content:
          "Seurattujen urheilijoiden Calling room -aikataulu YAG Espoo 2026 -kisalle.",
      },
    ],
  }),
  component: () => (
    <RequireRole allow={["user"]}>
      <YagCallingPage />
    </RequireRole>
  ),
});

function YagCallingPage() {
  const { auto } = Route.useSearch();
  const { list: watched } = useWatchedAthletes();
  const { orientation, setOrientation } = usePrintOrientation();
  const indexQuery = useQuery(competitionIndexQueryOptions(YAG_COMPETITION_ID));

  const entries = indexQuery.data?.entries ?? [];
  const compName = indexQuery.data?.name ?? "YAG Espoo 2026";

  const watchedKeys = useMemo(
    () =>
      new Set(
        watched.map(
          (w) => `${w.surname}|${w.firstname}|${w.organizationId ?? ""}`,
        ),
      ),
    [watched],
  );

  const matches = useMemo(() => {
    if (watchedKeys.size === 0) return [];
    const filtered = entries.filter((e) => {
      const k = `${e.alloc.Surname}|${e.alloc.Firstname}|${e.alloc.Organization?.Id ?? ""}`;
      return watchedKeys.has(k);
    });
    return matchYagCalling(filtered);
  }, [entries, watchedKeys]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof matches>();
    for (const m of matches) {
      const list = map.get(m.row.date) ?? [];
      list.push(m);
      map.set(m.row.date, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({
        date,
        rows: [...rows].sort((a, b) => a.row.calling.localeCompare(b.row.calling)),
      }));
  }, [matches]);

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
              YAG Calling-aikataulu
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {watched.length} urheilijaa seurannassa · {compName}
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
      </header>

      <PrintTabs />

      <main
        className={`mx-auto max-w-3xl px-4 py-6 print:py-2 print-schedule print-${orientation}`}
      >
        <div className="mb-5 rounded-xl border bg-card p-4 shadow-sm print:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tulostussuunta
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full gap-2 sm:w-auto">
              {(["portrait", "landscape"] as Orientation[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
                    orientation === o
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {o === "portrait" ? "Pysty" : "Vaaka"}
                </button>
              ))}
            </div>
            <Button
              onClick={() => window.print()}
              size="sm"
              className="gap-2 shrink-0"
              disabled={grouped.length === 0}
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Tulosta / PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Vinkki: erä-numero näkyy vasta kun tuloslista on julkaissut eräjaon.
          </p>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold print:text-lg">
            {compName} — Calling-aikataulu
          </h1>
          <p className="text-sm text-muted-foreground">
            Vain seurannassa olevien urheilijoiden lähdöt
          </p>
        </div>

        {watched.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground print:hidden">
            <Users className="mx-auto mb-2 h-6 w-6 opacity-60" />
            Ei urheilijoita seurannassa. Lisää urheilijoita{" "}
            <Link to="/watch" className="text-primary underline">
              kilpailijaseurannassa
            </Link>
            .
          </p>
        )}

        {watched.length > 0 && indexQuery.isLoading && entries.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ladataan…
          </p>
        )}

        {watched.length > 0 && !indexQuery.isLoading && grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Seuratuilla ei ole lähtöjä YAG-kisassa.
          </p>
        )}

        {grouped.map((g) => (
          <section key={g.date} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 border-b-2 border-primary pb-1 text-lg font-bold print:text-base">
              {DATE_LABEL[g.date] ?? g.date}
            </h2>
            <table className="w-full text-sm print:text-xs">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 pr-2 font-semibold">Calling</th>
                  <th className="py-1 pr-2 font-semibold">Kentälle</th>
                  <th className="py-1 pr-2 font-semibold">Alkaa</th>
                  <th className="py-1 pr-2 font-semibold">Sarja / Laji</th>
                  <th className="py-1 pr-2 font-semibold">Erä</th>
                  <th className="py-1 font-semibold">Paikka</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((m, idx) => {
                  // Yritä saada erä-numero tuloslista-entryistä jos kaikilla
                  // sama heatIndex, muuten PDF:stä.
                  const heatFromEntries = (() => {
                    const set = new Set(
                      m.entries.map((e) => e.heatIndex).filter((h) => h > 0),
                    );
                    if (set.size === 1) return [...set][0];
                    return null;
                  })();
                  const erä = heatFromEntries ?? m.heatNumber;
                  return (
                    <tr
                      key={`${m.row.date}-${m.row.calling}-${idx}`}
                      className="border-b border-border/50 align-top"
                    >
                      <td className="py-2 pr-2 font-semibold tabular-nums">
                        {m.row.calling}
                      </td>
                      <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                        {m.row.kentalle}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{m.row.alkaa}</td>
                      <td className="py-2 pr-2">
                        <div className="font-semibold leading-tight">
                          {m.row.sarja} {m.row.laji.replace(/\s*\(erä\s*\d+\)/, "")}
                        </div>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {m.entries.map((e, i) => (
                            <li key={`${e.alloc.Id}-${i}`}>
                              <span className="font-medium">
                                {e.alloc.Surname} {e.alloc.Firstname}
                              </span>
                              {e.alloc.Organization?.NameShort && (
                                <span className="ml-1 text-muted-foreground">
                                  {e.alloc.Organization.NameShort}
                                </span>
                              )}
                              {e.alloc.Number && (
                                <span className="ml-1 tabular-nums text-muted-foreground">
                                  #{e.alloc.Number}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-2 pr-2 tabular-nums">
                        {erä != null ? erä : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="py-2">{m.row.paikka}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}

        <p className="mt-8 text-center text-xs text-muted-foreground print:mt-4">
          Lähde: live.tuloslista.com + virallinen Calling-aikataulu · Tulostettu{" "}
          {new Date().toLocaleString("fi-FI")}
        </p>
      </main>
    </div>
  );
}
