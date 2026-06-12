import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";

import {
  fetchRounds,
  fetchProperties,
  isRunningEvent,
  formatTime,
  type Round,
  type RoundsByDate,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";
import { PrintTabs } from "@/components/PrintTabs";
import { usePrintOrientation, type Orientation } from "@/hooks/usePrintOrientation";

type Filter = "running" | "all";

export const Route = createFileRoute("/print/")({
  head: () => ({
    meta: [
      { title: "Kilpailun aikataulu" },
      {
        name: "description",
        content: "Tulostettava ja mobiilioptimoitu kilpailun aikataulu.",
      },
    ],
  }),
  component: PrintPage,
});

function PrintPage() {
  const [competitionId] = useCompetitionId();
  const { orientation, setOrientation } = usePrintOrientation();
  const [data, setData] = useState<RoundsByDate | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [r, p] = await Promise.all([
          fetchRounds(competitionId),
          fetchProperties(competitionId).catch(() => null),
        ]);
        setData(r);
        setName(p?.Competition?.Name ?? "");
      } finally {
        setLoading(false);
      }
    })();
  }, [competitionId]);

  const grouped = useMemo(() => {
    if (!data) return [] as Array<{ date: string; runs: Round[] }>;
    return Object.entries(data)
      .map(([date, rounds]) => ({
        date,
        runs: rounds
          .filter((r) => (filter === "running" ? isRunningEvent(r) : true))
          .sort((a, b) => a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ)),
      }))
      .filter((g) => g.runs.length > 0)
      .sort((a, b) => {
        const [da, ma, ya] = a.date.split(".").map(Number);
        const [db, mb, yb] = b.date.split(".").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });
  }, [data, filter]);

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
              Kilpailun aikataulu
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {name || `Kisa #${competitionId}`}
            </p>
          </div>
        </div>
      </header>

      <PrintTabs />

      <main className={`mx-auto max-w-3xl px-4 py-4 print:py-2 print-schedule print-${orientation}`}>
        <div className="mb-5 rounded-xl border bg-card p-4 shadow-sm print:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lajisuodatus
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full gap-2 sm:w-auto">
              {(["all", "running"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
                    filter === f
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {f === "running" ? "Vain juoksulajit" : "Kaikki lajit"}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tulostussuunta
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full gap-2 sm:w-auto">
              {(["landscape", "portrait"] as Orientation[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
                    orientation === o
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {o === "landscape" ? "Vaaka (4 saraketta)" : "Pysty (2 saraketta)"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-muted-foreground">
                {orientation === "landscape"
                  ? "Mahtuu yhdelle A4:lle — taittele keskeltä vihkoseksi."
                  : "Tiivis 2-sarakkeinen aikataulu."}
              </p>
              <Button onClick={() => window.print()} size="sm" className="gap-2 shrink-0">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Tulosta / PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Vinkki: tulostusikkunassa valitse{" "}
            <strong className="font-semibold">"Tallenna PDF-tiedostona"</strong> ja sama suunta.
          </p>
        </div>


        <div className="mb-6 hidden print:block print-title">
          <h1 className="text-xl font-bold">{name || `Kisa #${competitionId}`}</h1>
          <p className="text-sm text-muted-foreground">
            {filter === "running" ? "Juoksulajien aikataulu" : "Kilpailun aikataulu"}
          </p>
        </div>

        {loading && !data && (
          <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
        )}

        {grouped.length === 0 && !loading && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {filter === "running" ? "Ei juoksulajeja tässä kisassa." : "Ei lajeja tässä kisassa."}
          </p>
        )}

        {grouped.map((g) => (
          <section key={g.date} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 border-b-2 border-primary pb-1 text-lg font-bold print:text-base">
              {g.date}
            </h2>
            <table className="w-full text-sm print:text-xs">
              <tbody>
                {g.runs.map((r) => (
                  <tr key={r.Id} className="border-b border-border/50 align-top hover:bg-secondary/60 print:hover:bg-transparent">
                    <td colSpan={2} className="p-0">
                      <Link
                        to="/round/$eventId/$roundId"
                        params={{ eventId: String(r.EventId), roundId: String(r.Id) }}
                        className="flex items-start gap-2 py-2 no-underline text-foreground print:cursor-default"
                      >
                        <span className="time w-14 shrink-0 pr-2 font-bold tabular-nums">
                          {formatTime(r.BeginDateTimeWithTZ)}
                        </span>
                        <span className="event min-w-0 flex-1">
                          <span className="font-semibold leading-tight">{r.EventName}</span>
                          <span className="sub"> · {r.Name}</span>
                          <span className="block text-xs text-muted-foreground print:hidden">
                            {r.Name}
                          </span>
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <p className="mt-8 text-center text-xs text-muted-foreground print:mt-4 print-footer">
          Lähde: live.tuloslista.com · Tulostettu {new Date().toLocaleString("fi-FI")}
        </p>
      </main>
    </div>
  );
}
