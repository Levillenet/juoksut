import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

import {
  fetchRounds,
  fetchProperties,
  isRunningEvent,
  formatTime,
  helsinkiDateKey,
  translateSub,
  STATUS_LABEL,
  type Round,
  type RoundsByDate,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/announcer")({
  head: () => ({
    meta: [
      { title: "Kuuluttajanäkymä – juoksulajit" },
      {
        name: "description",
        content: "Suuriksi tekstein näytetty kuuluttajanäkymä juoksulajien aikataulusta.",
      },
    ],
  }),
  component: AnnouncerPage,
});

function AnnouncerPage() {
  const [competitionId] = useCompetitionId();
  const [data, setData] = useState<RoundsByDate | null>(null);
  const [name, setName] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);

  const load = async () => {
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
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const upcoming = useMemo<Round[]>(() => {
    if (!data) return [];
    const todayKey = helsinkiDateKey(new Date().toISOString());
    const rounds = data[todayKey] ?? [];
    return rounds
      .filter(isRunningEvent)
      .sort((a, b) => a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ));
  }, [data]);

  const nowMs = now.getTime();
  // Current = käynnissä OR last started in past 15 min
  const current = upcoming.find(
    (r) =>
      r.Status === "Progress" ||
      (new Date(r.BeginDateTimeWithTZ).getTime() <= nowMs &&
        nowMs - new Date(r.BeginDateTimeWithTZ).getTime() < 15 * 60_000 &&
        r.Status !== "Official"),
  );
  const next = upcoming
    .filter((r) => new Date(r.BeginDateTimeWithTZ).getTime() > nowMs && r.Status !== "Official")
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">Kuuluttaja</h1>
            <p className="truncate text-xs text-muted-foreground">{name || `Kisa #${competitionId}`}</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tabular-nums leading-none">
              {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={load} aria-label="Päivitä">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Käynnissä
          </h2>
          {current ? (
            <Link
              to="/round/$eventId/$roundId"
              params={{ eventId: String(current.EventId), roundId: String(current.Id) }}
              className="block rounded-2xl border-2 border-primary bg-primary/10 p-6 shadow-lg"
            >
              <div className="flex items-baseline gap-4">
                <div className="text-4xl font-black tabular-nums text-primary sm:text-5xl">
                  {formatTime(current.BeginDateTimeWithTZ)}
                </div>
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase text-primary-foreground">
                  {STATUS_LABEL[current.Status]}
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
                {current.EventName}
              </p>
              <p className="mt-1 text-base text-muted-foreground sm:text-lg">
                {current.Name}
                {current.SubCategory && ` · ${translateSub(current.SubCategory)}`}
              </p>
            </Link>
          ) : (
            <div className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">
              Ei käynnissä olevaa juoksulajia
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Seuraavaksi
          </h2>
          {next.length === 0 ? (
            <div className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">
              Ei tulevia juoksulajeja tänään.
            </div>
          ) : (
            <ul className="space-y-2">
              {next.map((r, i) => (
                <li key={r.Id}>
                  <Link
                    to="/round/$eventId/$roundId"
                    params={{ eventId: String(r.EventId), roundId: String(r.Id) }}
                    className={`flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-secondary ${
                      i === 0 ? "border-accent" : ""
                    }`}
                  >
                    <div className="w-20 shrink-0 text-2xl font-bold tabular-nums sm:text-3xl">
                      {formatTime(r.BeginDateTimeWithTZ)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xl font-semibold leading-tight sm:text-2xl">
                        {r.EventName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {r.Name}
                        {r.SubCategory && ` · ${translateSub(r.SubCategory)}`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {STATUS_LABEL[r.Status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
