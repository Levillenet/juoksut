import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ChevronRight, LogOut, ChevronDown, ChevronUp } from "lucide-react";
import logo from "@/assets/lahden-ahkera-logo.png";
import { TodayStatsSection } from "@/components/TodayStatsSection";

const NAVCARDS_COLLAPSED_KEY = "home.navCards.collapsed";

import {
  fetchRounds,
  fetchProperties,
  formatTime,
  helsinkiDateKey,
  STATUS_LABEL,
  type Round,
  type RoundsByDate,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { useAuth, type Role } from "@/lib/auth";
import { CompetitionSwitcher } from "@/components/CompetitionSwitcher";
import { DailyBestSection } from "@/components/DailyBestSection";
import { ClubTodaySection } from "@/components/ClubTodaySection";
import { LiveCompetitionsSection } from "@/components/LiveCompetitionsSection";
import { SeasonStatsSection } from "@/components/SeasonStatsSection";
import { Button } from "@/components/ui/button";
import { useRefreshIntervalSec } from "@/lib/settings-store";

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
  const { role, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (!role) return <Navigate to="/login" />;
  const isAdmin = (user?.email ?? "").toLowerCase() === "samiaavikko@gmail.com";
  return <Index role={role} isAdmin={isAdmin} />;
}

const STATUS_STYLE: Record<Round["Status"], string> = {
  Unallocated: "bg-muted text-muted-foreground",
  Allocated: "bg-accent text-accent-foreground",
  Progress: "bg-primary text-primary-foreground",
  Official: "bg-foreground text-background",
};

function NavCards({ role, isAdmin = false }: { role: Role; isAdmin?: boolean }) {
  const isOfficial = role === "official" && !isAdmin;
  const showOfficialLinks = role === "official" || isAdmin;
  return (
    <div className="mx-auto grid max-w-2xl gap-2 px-4 pb-3 sm:grid-cols-2">
      {isAdmin && (
        <Link
          to="/admin/analytics"
          className="rounded-xl border-2 border-amber-500/60 bg-amber-50 px-4 py-2.5 text-center hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 sm:col-span-2"
        >
          <div className="text-sm font-semibold leading-tight">Admin · Käyttöanalytiikka</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Sivuston käyttötilastot ja CSV-vienti (vain sinulle)
          </div>
        </Link>
      )}
      {!isOfficial && (
        <Link
          to="/search"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Hae sukunimellä</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Etsi urheilijaa nimellä kisan osallistujista
          </div>
        </Link>
      )}
      {role === "user" && (
        <Link
          to="/watch"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Kilpailijaseuranta</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Lisää haluamiasi urheilijoita helppoon tulosseurantaan
          </div>
        </Link>
      )}
      {!isOfficial && (
        <Link
          to="/season-leaders"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Kauden kärki</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Kauden parhaat tulokset lajeittain ja ikäluokittain
          </div>
        </Link>
      )}
      {!isOfficial && (
        <Link
          to="/kilpailukalenteri"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Kilpailukalenteri</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Tulevat yleisurheilukisat lähteestä kilpailukalenteri.fi
          </div>
        </Link>
      )}
      {showOfficialLinks && (
        <Link
          to="/running-ops"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Juoksulajien operointi</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Päivän juoksulajit ja sukunimihaku erään tunnistamiseen
          </div>
        </Link>
      )}
      {showOfficialLinks && (
        <Link
          to="/announcer"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Kuuluttaja</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Erä kerrallaan etenevä kuuluttajanäkymä
          </div>
        </Link>
      )}
      <Link
        to="/scoreboard"
        search={{ top: 10 }}
        className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
      >
        <div className="text-sm font-semibold leading-tight">Suorituspaikan livenäyttö</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Kenttälajin kärki isolla – pöydälle näkyviin kilpailijoille
        </div>
      </Link>
      <Link
        to="/print"
        className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
      >
        <div className="text-sm font-semibold leading-tight">Tulostettava aikataulu</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Kisan lajit, seuran urheilijat tai omien lasten aikataulu PDF:ksi
        </div>
      </Link>
      {showOfficialLinks && (
        <Link
          to="/settings"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Asetukset</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Päivitystiheys, seurojen sijainnit ja muut asetukset
          </div>
        </Link>
      )}
    </div>
  );
}

function Index({ role, isAdmin = false }: { role: Role; isAdmin?: boolean }) {
  const { signOut } = useAuth();
  const [competitionId] = useCompetitionId();
  const isOfficial = role === "official" && !isAdmin;
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
      if (isOfficial) {
        const props = await fetchProperties(competitionId).catch(() => null);
        setName(props?.Competition?.Name ?? "");
        setUpdatedAt(new Date());
      } else {
        const [rounds, props] = await Promise.all([
          fetchRounds(competitionId),
          fetchProperties(competitionId).catch(() => null),
        ]);
        setData(rounds);
        setName(props?.Competition?.Name ?? "");
        setUpdatedAt(new Date());
      }
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
  }, [competitionId, refreshSec, isOfficial]);

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

  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(NAVCARDS_COLLAPSED_KEY);
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(NAVCARDS_COLLAPSED_KEY, navCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [navCollapsed]);

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
              {name || "Lajit"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Kisa #{competitionId}
              {updatedAt && ` · päivitetty ${formatClock(updatedAt)}`}
            </p>
          </div>
          <h2 className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-lg font-black uppercase tracking-widest text-primary xl:block">
            {isOfficial ? "Toimitsija" : "Päivän lajit"}
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
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            Valitse tästä seurattava kilpailu
          </p>
          <CompetitionSwitcher className="w-full" confirmOnChange={isOfficial} />
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-2">
          <button
            type="button"
            onClick={() => setNavCollapsed((v) => !v)}
            className="flex w-full items-center justify-center rounded-lg border-2 border-red-500/60 bg-card px-3 py-2 text-lg font-bold tracking-widest text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            aria-expanded={!navCollapsed}
          >
            VALIKKO
          </button>
        </div>
        {!navCollapsed && <NavCards role={role} isAdmin={isAdmin} />}

        {!isOfficial && dates.length > 1 && (
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

        {!isOfficial && (
          <>
            <TodayStatsSection />
            <DailyBestSection />
            <ClubTodaySection excludeCompetitionId={competitionId} />
            <LiveCompetitionsSection />
            <SeasonStatsSection />

            {loading && !data && (
              <div className="py-12 text-center text-sm text-muted-foreground">Ladataan…</div>
            )}

            {data && allRuns.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {runs.length} lajia
                  {!showPast &&
                    hiddenPastCount > 0 &&
                    ` · ${hiddenPastCount} mennyttä piilotettu`}
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
                  ? "Päivän lajit on jo suoritettu. Paina ”Näytä menneet”."
                  : "Ei lajeja valitulle päivälle."}
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
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · automaattinen päivitys 30&nbsp;s välein
        </p>
      </main>
    </div>
  );
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
