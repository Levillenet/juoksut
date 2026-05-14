import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ChevronRight, LogOut } from "lucide-react";
import logo from "@/assets/lahden-ahkera-logo.png";

import {
  fetchRounds,
  fetchProperties,
  isRunningEvent,
  formatTime,
  helsinkiDateKey,
  STATUS_LABEL,
  type Round,
  type RoundsByDate,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { useAuth } from "@/lib/auth";
import { CompetitionSwitcher } from "@/components/CompetitionSwitcher";
import { DailyBestSection } from "@/components/DailyBestSection";
import { ClubTodaySection } from "@/components/ClubTodaySection";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live tuloslista seuranta – Lahden Ahkera" },
      {
        name: "description",
        content:
          "Lahden Ahkeran live tuloslista seurantapalvelu yleisurheilun kisoihin.",
      },
    ],
  }),
  component: IndexGate,
});

function IndexGate() {
  const { role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (!role) return <Navigate to="/login" />;
  return <Index />;
}

const STATUS_STYLE: Record<Round["Status"], string> = {
  Unallocated: "bg-muted text-muted-foreground",
  Allocated: "bg-accent text-accent-foreground",
  Progress: "bg-primary text-primary-foreground",
  Official: "bg-foreground text-background",
};

function Index() {
  const { role, signOut } = useAuth();
  const [competitionId] = useCompetitionId();
  const [data, setData] = useState<RoundsByDate | null>(null);
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

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
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

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

  // Tick clock every 30s so past/upcoming filter stays accurate
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const allRuns = useMemo<Round[]>(() => {
    if (!data || !activeDate) return [];
    return (data[activeDate] ?? [])
      .filter(isRunningEvent)
      .sort((a, b) => a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ));
  }, [data, activeDate]);

  // The API encodes local time as UTC ("06:20:00+00:00" really means 06:20 local),
  // so compare using UTC parts of the round vs local parts of "now".
  // Kisat ovat usein hieman myöhässä → siirrä laji menneisiin vasta 5 min ajoitetun ajan jälkeen.
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
          <img
            src={logo}
            alt="Lahden Ahkera"
            className="h-9 w-9 shrink-0 rounded-md object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              {name || "Juoksulajit"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Kisa #{competitionId}
              {updatedAt && ` · päivitetty ${formatClock(updatedAt)}`}
            </p>
          </div>
          <h2 className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-lg font-black uppercase tracking-widest text-primary xl:block">
            Juoksujen näkymä
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            disabled={loading}
            aria-label="Päivitä"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            aria-label="Kirjaudu ulos"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <div className="mx-auto px-4 pb-3 max-w-2xl">
          <CompetitionSwitcher className="w-full" />
        </div>

        <div className="mx-auto flex max-w-2xl flex-wrap gap-2 px-4 pb-3">
          <Link
            to="/search"
            className="flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-center text-xs font-medium hover:bg-secondary"
          >
            Hae sukunimellä
          </Link>
          {role === "user" && (
            <Link
              to="/watch"
              className="flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-center text-xs font-medium hover:bg-secondary"
            >
              Kilpailijaseuranta
            </Link>
          )}
          {role === "official" && (
            <Link
              to="/announcer"
              className="flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-center text-xs font-medium hover:bg-secondary"
            >
              Kuuluttaja
            </Link>
          )}
          <Link
            to="/print"
            className="flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-center text-xs font-medium hover:bg-secondary"
          >
            Tulostettava aikataulu
          </Link>
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
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DailyBestSection />

        {loading && !data && (
          <div className="py-12 text-center text-sm text-muted-foreground">Ladataan…</div>
        )}

        {data && allRuns.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {runs.length} lajia
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
              ? "Päivän juoksulajit on jo juostu. Paina ”Näytä menneet”."
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
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.Name}
                    {r.SubCategory && ` · ${translateSub(r.SubCategory)}`}
                  </p>
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

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · automaattinen päivitys 30&nbsp;s välein
        </p>
      </main>
    </div>
  );
}

function translateSub(sub: string): string {
  switch (sub) {
    case "Sprint":
      return "Pikajuoksu";
    case "Run":
      return "Juoksu";
    case "Hurdles":
      return "Aidat";
    case "Steeple":
      return "Estejuoksu";
    case "Relay":
      return "Viesti";
    case "Walk":
      return "Kävely";
    default:
      return sub;
  }
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
