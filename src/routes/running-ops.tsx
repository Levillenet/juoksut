import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, ChevronRight } from "lucide-react";
import logo from "@/assets/lahden-ahkera-logo.png";

import {
  fetchRounds,
  fetchProperties,
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
  STATUS_LABEL,
  type Round,
  type RoundsByDate,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { useRefreshIntervalSec } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { AthleteSearch } from "@/components/AthleteSearch";
import { RequireRole } from "@/components/RequireRole";

export const Route = createFileRoute("/running-ops")({
  head: () => ({
    meta: [
      { title: "Juoksulajien operointi – Lahden Ahkera" },
      {
        name: "description",
        content:
          "Toimitsijan näkymä juoksulajien operointiin: päivän juoksulajit ja sukunimihaku.",
      },
    ],
  }),
  component: () => (
    <RequireRole allow={["official"]}>
      <RunningOps />
    </RequireRole>
  ),
});

const STATUS_STYLE: Record<Round["Status"], string> = {
  Unallocated: "bg-muted text-muted-foreground",
  Allocated: "bg-accent text-accent-foreground",
  Progress: "bg-primary text-primary-foreground",
  Official: "bg-foreground text-background",
};

function RunningOps() {
  const [competitionId] = useCompetitionId();
  const [data, setData] = useState<RoundsByDate | null>(null);
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshSec] = useRefreshIntervalSec();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rounds, props] = await Promise.all([
        fetchRounds(competitionId),
        fetchProperties(competitionId).catch(() => null),
      ]);
      setData(rounds);
      setName(props?.Competition?.Name ?? "");
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tuntematon virhe");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, Math.max(5, refreshSec) * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, refreshSec]);

  const dates = useMemo(() => {
    if (!data) return [];
    return Object.keys(data).sort((a, b) => {
      const [da, ma, ya] = a.split(".").map(Number);
      const [db, mb, yb] = b.split(".").map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
  }, [data]);

  useEffect(() => {
    if (!activeDate && dates.length) {
      const todayKey = helsinkiDateKey(new Date().toISOString());
      setActiveDate(dates.includes(todayKey) ? todayKey : dates[0]);
    }
  }, [dates, activeDate]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const allRuns = useMemo<Round[]>(() => {
    if (!data || !activeDate) return [];
    return (data[activeDate] ?? [])
      .filter((r) => isRunningEvent(r))
      .slice()
      .sort((a, b) => a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ));
  }, [data, activeDate]);

  const isPast = (iso: string): boolean =>
    new Date(iso).getTime() + 5 * 60_000 < now.getTime();

  const runs = useMemo(
    () => (showPast ? allRuns : allRuns.filter((r) => !isPast(r.BeginDateTimeWithTZ))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRuns, showPast, now, activeDate],
  );

  const hiddenPastCount = allRuns.length - runs.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <img
            src={logo}
            alt="Lahden Ahkera"
            className="h-9 w-9 shrink-0 rounded-md object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              {name || `Kisa #${competitionId}`}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Juoksulajien operointi
              {updatedAt && ` · päivitetty ${formatClock(updatedAt)}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            disabled={loading}
            aria-label="Päivitä"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {dates.length > 1 && (
          <div className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pb-3">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDate(d)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  d === activeDate
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <section className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Hae kilpailijaa sukunimellä – näet mihin erään hän kuuluu
          </p>
          <AthleteSearch competitionId={competitionId} runningOnly />
        </section>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="py-12 text-center text-sm text-muted-foreground">Ladataan…</div>
        )}

        {data && allRuns.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {runs.length} juoksulajia
              {!showPast && hiddenPastCount > 0 && ` · ${hiddenPastCount} mennyttä piilotettu`}
            </p>
            <button
              onClick={() => setShowPast((v) => !v)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                showPast
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {showPast ? "Piilota menneet" : "Näytä menneet"}
            </button>
          </div>
        )}

        {!loading && data && runs.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {hiddenPastCount > 0
              ? "Päivän juoksulajit on jo suoritettu. Paina ”Näytä menneet”."
              : "Ei juoksulajeja valitulle päivälle."}
          </div>
        )}

        <ul className="space-y-2">
          {runs.map((r) => {
            const past = isPast(r.BeginDateTimeWithTZ);
            return (
              <li key={r.Id}>
                <Link
                  to="/round/$eventId/$roundId"
                  params={{ eventId: String(r.EventId), roundId: String(r.Id) }}
                  className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-secondary active:bg-secondary ${past ? "opacity-50" : ""}`}
                >
                  <div className="flex w-14 shrink-0 flex-col items-center">
                    <span className="text-lg font-bold tabular-nums tracking-tight text-foreground">
                      {formatTime(r.BeginDateTimeWithTZ)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{r.EventName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.Name}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.Status]}`}
                  >
                    {STATUS_LABEL[r.Status]}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
