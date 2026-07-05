import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ChevronRight, LogOut } from "lucide-react";
import logo from "@/assets/lahden-ahkera-logo.png";
import { TodayStatsSection } from "@/components/TodayStatsSection";

const NAVCARDS_COLLAPSED_KEY = "home.navCards.collapsed";

import {
  formatTime,
  helsinkiDateKey,
  STATUS_LABEL,
  type Round,
} from "@/lib/tuloslista";
import {
  competitionScheduleQueryOptions,
  competitionScheduleKey,
} from "@/lib/tuloslista-queries";
import { useCompetitionId } from "@/lib/competition-store";
import { useAuth, type Role } from "@/lib/auth";
import { CompetitionSwitcher } from "@/components/CompetitionSwitcher";
import { DailyBestSection } from "@/components/DailyBestSection";
import { HarvestStatusBadge } from "@/components/HarvestStatusBadge";
import { ClubTodaySection } from "@/components/ClubTodaySection";
import { LiveCompetitionsSection } from "@/components/LiveCompetitionsSection";
import { SeasonStatsSection } from "@/components/SeasonStatsSection";
import { Button } from "@/components/ui/button";
import { NoteLinkInvitesBanner } from "@/components/NoteLinkInvitesBanner";
import { DistrictRecordsSection } from "@/components/DistrictRecordsSection";

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
  const { role, loading, isAdmin, isPlanner } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (!role) return <Navigate to="/login" />;
  return <Index role={role} isAdmin={isAdmin} isPlanner={isPlanner} />;
}

const STATUS_STYLE: Record<Round["Status"], string> = {
  Unallocated: "bg-muted text-muted-foreground",
  Allocated: "bg-accent text-accent-foreground",
  Progress: "bg-primary text-primary-foreground",
  Official: "bg-foreground text-background",
};

function NavCards({ role, isAdmin = false, isPlanner = false }: { role: Role; isAdmin?: boolean; isPlanner?: boolean }) {
  const isOfficial = role === "official" && !isAdmin;
  const showOfficialLinks = role === "official" || isAdmin;
  const showPlannerLink = isPlanner || isAdmin;
  return (
    <div className="mx-auto grid max-w-2xl gap-3 px-4 pb-3 sm:grid-cols-2">
      {isAdmin && (
        <Link
          to="/admin/analytics"
          className="rounded-xl border-2 border-accent-warm-border bg-accent-warm px-4 py-3 text-center text-accent-warm-foreground hover:opacity-90 sm:col-span-2"
        >
          <div className="text-sm font-semibold leading-snug">Admin · Käyttöanalytiikka</div>
          <div className="mt-0.5 text-[11px] opacity-80">
            Sivuston käyttötilastot ja CSV-vienti (vain sinulle)
          </div>
        </Link>
      )}
      {isAdmin && (
        <Link
          to="/admin/roles"
          className="rounded-xl border-2 border-accent-warm-border bg-accent-warm px-4 py-2.5 text-center text-accent-warm-foreground hover:opacity-90"
        >
          <div className="text-sm font-semibold leading-tight">Admin · Käyttöoikeudet</div>
          <div className="mt-0.5 text-[11px] opacity-80">
            Myönnä planner-rooli sähköpostilla
          </div>
        </Link>
      )}
      {isAdmin && (
        <Link
          to="/admin/welcome"
          className="rounded-xl border-2 border-accent-warm-border bg-accent-warm px-4 py-2.5 text-center text-accent-warm-foreground hover:opacity-90"
        >
          <div className="text-sm font-semibold leading-tight">Admin · Tervehdysviesti</div>
          <div className="mt-0.5 text-[11px] opacity-80">
            Muokkaa kirjautumisen jälkeistä viestiä
          </div>
        </Link>
      )}

      {showPlannerLink && (
        <Link
          to="/planner"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Aikataulusuunnittelu</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Suunnittele kisan aikataulu ja hallinnoi stadioneita
          </div>
        </Link>
      )}
      {!isOfficial && (
        <Link
          to="/search"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Hae nimellä</div>
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
        <div
          className="cursor-not-allowed rounded-xl border-2 border-dashed border-muted bg-muted/30 px-4 py-2.5 text-center opacity-70"
          aria-disabled="true"
        >
          <div className="text-sm font-semibold leading-tight">Kauden kärki</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Palvelu ei käytössä vielä
          </div>
        </div>
      )}
      {role === "user" && (
        <Link
          to="/hauskat-tilastot"
          className="rounded-xl border-2 border-accent-warm-border bg-accent-warm px-4 py-3 text-center text-accent-warm-foreground hover:opacity-90"
        >
          <div className="text-sm font-semibold leading-snug">🎉 Hauskat tilastot</div>
          <div className="mt-0.5 text-[11px] opacity-80">
            Leikkimieliset kausimittarit seuratuille urheilijoille
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
        className="rounded-xl border-2 border-primary/30 bg-card px-4 py-3 text-center hover:bg-secondary"
      >
        <div className="text-sm font-semibold leading-snug">Kilpailun aikataulu</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Kisan lajit, seuran urheilijat tai omien lasten aikataulu PDF:ksi
        </div>
      </Link>
      <Link
        to="/print/club-report"
        className="rounded-xl border-2 border-primary/30 bg-card px-4 py-3 text-center hover:bg-secondary"
      >
        <div className="text-sm font-semibold leading-snug">Seuran kisaraportti</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Koko seuran tulokset valitusta kisasta lajeittain — sija, tulos ja PB
        </div>
      </Link>
      <Link
        to="/print/club-team-report"
        className="rounded-xl border-2 border-primary/30 bg-card px-4 py-3 text-center hover:bg-secondary"
      >
        <div className="text-sm font-semibold leading-snug">Joukkuekisa (kentät)</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Kunkin seuran kahden parhaan paras tulos 3 ensimmäisestä kierroksesta
        </div>
      </Link>
      {role && (
        <Link
          to="/settings/note-links"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Muistiinpanojen jakaminen</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Linkitä tilisi toisen käyttäjän kanssa — näette muistiinpanot ristiin
          </div>
        </Link>
      )}
      {role && (
        <Link
          to="/settings"
          className="rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-center hover:bg-secondary"
        >
          <div className="text-sm font-semibold leading-tight">Asetukset</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Päivitystiheys ja oman seurasi sijainti
          </div>
        </Link>
      )}
    </div>
  );
}

function Index({ role, isAdmin = false, isPlanner = false }: { role: Role; isAdmin?: boolean; isPlanner?: boolean }) {
  const { signOut, user } = useAuth();
  const [competitionId] = useCompetitionId();
  const queryClient = useQueryClient();
  const isOfficial = role === "official" && !isAdmin;
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const scheduleQuery = useQuery(competitionScheduleQueryOptions(competitionId));
  const data = scheduleQuery.data?.rounds ?? null;
  const name = scheduleQuery.data?.name ?? "";
  const loading = scheduleQuery.isFetching && !scheduleQuery.data;
  const error = scheduleQuery.error
    ? scheduleQuery.error instanceof Error
      ? scheduleQuery.error.message
      : "Tuntematon virhe"
    : null;
  const updatedAt = scheduleQuery.dataUpdatedAt
    ? new Date(scheduleQuery.dataUpdatedAt)
    : null;
  const load = () => {
    queryClient.invalidateQueries({ queryKey: competitionScheduleKey(competitionId) });
  };

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
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
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
            {user?.email && (
              <p className="truncate text-[11px] text-muted-foreground">
                Kirjautunut: <span className="font-medium">{user.email}</span>
              </p>
            )}
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            aria-label="Kirjaudu ulos"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* LOHKO 1 — Aktiivinen kilpailu */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Aktiivinen kilpailu
          </p>
          <CompetitionSwitcher className="w-full" confirmOnChange={isOfficial} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Vaihto vaikuttaa vain sinun näkymääsi.
          </p>
        </section>

        {/* LOHKO 2 — Päävalikko */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setNavCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-card px-3 py-2.5 text-base font-semibold text-foreground transition-colors hover:bg-secondary"
            aria-expanded={!navCollapsed}
          >
            {navCollapsed ? "Avaa valikko ▾" : "Piilota valikko ▴"}
          </button>
          {!navCollapsed && (
            <div className="mt-3">
              <NavCards role={role} isAdmin={isAdmin} isPlanner={isPlanner} />
            </div>
          )}
        </section>

        <NoteLinkInvitesBanner />
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isOfficial && (
          <>
            <TodayStatsSection />
            <DailyBestSection />
            <ClubTodaySection />
            <LiveCompetitionsSection />
            <SeasonStatsSection />

            {/* LOHKO 3 — Päivän lajit */}
            <section className="pt-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Päivän lajit
                </h2>
              </div>

              {dates.length > 1 && (
                <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
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
            </section>

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
        <p className="mt-1 text-center">
          <HarvestStatusBadge />
        </p>
        <p className="mt-3 text-center text-xs">
          <Link
            to="/tietoa-palvelusta"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Tärkeää tietoa palvelusta
          </Link>
        </p>
      </main>
    </div>
  );
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
