import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";

import {
  fetchRounds,
  fetchProperties,
  isRunningEvent,
  formatTime,
  translateSub,
  type Round,
  type RoundsByDate,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: "Tulostettava aikataulu – juoksulajit" },
      {
        name: "description",
        content: "Tulostettava ja mobiilioptimoitu juoksulajien aikataulu.",
      },
    ],
  }),
  component: PrintPage,
});

function PrintPage() {
  const [competitionId] = useCompetitionId();
  const [data, setData] = useState<RoundsByDate | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

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
          .filter(isRunningEvent)
          .sort((a, b) => a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ)),
      }))
      .filter((g) => g.runs.length > 0)
      .sort((a, b) => {
        const [da, ma, ya] = a.date.split(".").map(Number);
        const [db, mb, yb] = b.date.split(".").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });
  }, [data]);

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
              Tulostettava aikataulu
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {name || `Kisa #${competitionId}`}
            </p>
          </div>
          <Button onClick={() => window.print()} size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Tulosta
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 print:py-2">
        <div className="mb-6 hidden print:block">
          <h1 className="text-xl font-bold">{name || `Kisa #${competitionId}`}</h1>
          <p className="text-sm text-muted-foreground">Juoksulajien aikataulu</p>
        </div>

        {loading && !data && (
          <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
        )}

        {grouped.length === 0 && !loading && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ei juoksulajeja tässä kisassa.
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
                  <tr key={r.Id} className="border-b border-border/50 align-top">
                    <td className="w-14 py-2 pr-2 font-bold tabular-nums">
                      {formatTime(r.BeginDateTimeWithTZ)}
                    </td>
                    <td className="py-2">
                      <div className="font-semibold leading-tight">{r.EventName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.Name}
                        {r.SubCategory && ` · ${translateSub(r.SubCategory)}`}
                      </div>
                    </td>
                  </tr>
                ))}
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
