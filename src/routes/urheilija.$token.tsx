import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Award, Calendar, MapPin, Trophy } from "lucide-react";
import { useMemo } from "react";
import logo from "@/assets/lahden-ahkera-logo.png";

import { EventGroupView } from "@/components/RecordsPanel";
import {
  groupByEvent,
  isIndoorResult,
  isLowerBetter,
  type AthleteResultRow,
} from "@/lib/athlete-history";
import { loadSharedAthlete } from "@/lib/athlete-share";

export const Route = createFileRoute("/urheilija/$token")({
  head: () => ({
    meta: [
      { title: "Urheilijakortti" },
      {
        name: "description",
        content: "Urheilijakohtaiset tulokset ja ennätykset.",
      },
      { property: "og:title", content: "Urheilijakortti" },
      {
        property: "og:description",
        content: "Urheilijakohtaiset tulokset ja ennätykset.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Urheilijakortti" },
      {
        name: "twitter:description",
        content: "Urheilijakohtaiset tulokset ja ennätykset.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedAthletePage,
});

const HELSINKI_DATE = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return HELSINKI_DATE.format(new Date(iso));
  } catch {
    return "—";
  }
}

function SharedAthletePage() {
  const { token } = Route.useParams();

  const query = useQuery({
    queryKey: ["shared-athlete", token],
    queryFn: () => loadSharedAthlete(token),
  });

  const data = query.data;
  const rows: AthleteResultRow[] = data?.rows ?? [];
  const profile = data?.profile ?? null;

  const groups = useMemo(() => groupByEvent(rows), [rows]);

  const competitions = useMemo(() => {
    const map = new Map<
      number,
      {
        id: number;
        name: string;
        date: string | null;
        location: string;
        results: AthleteResultRow[];
      }
    >();
    for (const r of rows) {
      const c = map.get(r.competition_id);
      if (c) c.results.push(r);
      else
        map.set(r.competition_id, {
          id: r.competition_id,
          name: r.competition_name,
          date: r.competition_date,
          location: r.location,
          results: [r],
        });
    }
    return Array.from(map.values()).sort((a, b) =>
      (b.date ?? "").localeCompare(a.date ?? ""),
    );
  }, [rows]);

  const stats = useMemo(() => {
    const podiums = rows.filter((r) => r.result_rank != null && r.result_rank <= 3).length;
    const wins = rows.filter((r) => r.result_rank === 1).length;
    return {
      results: rows.length,
      events: groups.length,
      competitions: competitions.length,
      podiums,
      wins,
    };
  }, [rows, groups, competitions]);

  const allPbs = groups
    .map((g) => ({ pb: g.pb, pbIndoor: g.pbIndoor, pbOutdoor: g.pbOutdoor }))
    .filter(
      (
        g,
      ): g is {
        pb: AthleteResultRow;
        pbIndoor: AthleteResultRow | null;
        pbOutdoor: AthleteResultRow | null;
      } => g.pb != null,
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <img
            src={logo}
            alt=""
            className="h-9 w-9 shrink-0 rounded-md object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">
              {profile
                ? `${profile.surname} ${profile.firstname}`
                : "Jaettu urheilijakortti"}
            </h1>
            {profile?.organization && (
              <p className="truncate text-xs text-muted-foreground">
                {profile.organization}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
            Jaettu
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        {query.isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
        ) : data?.notFound ? (
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Linkkiä ei löytynyt.
            </p>
          </div>
        ) : data?.revoked ? (
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Jakaja on peruuttanut tämän jakolinkin.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
            <Activity className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Tälle urheilijalle ei ole vielä tallennettuja tuloksia.
            </p>
          </div>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <StatCard icon={<Activity className="h-4 w-4" />} value={stats.results} label="Tulosta" />
              <StatCard icon={<Award className="h-4 w-4" />} value={stats.events} label="Lajia" />
              <StatCard icon={<Calendar className="h-4 w-4" />} value={stats.competitions} label="Kisaa" />
              <StatCard icon={<Trophy className="h-4 w-4" />} value={stats.podiums} label="Mitalia" />
              <StatCard icon={<Trophy className="h-4 w-4 text-primary" />} value={stats.wins} label="Voittoa" />
            </section>

            {allPbs.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Henkilökohtaiset ennätykset
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {allPbs.map(({ pb, pbIndoor, pbOutdoor }) => {
                    const indoor = isIndoorResult(pb);
                    return (
                      <div
                        key={`${pb.event_name}-${pb.sub_category}`}
                        className="rounded-lg border bg-card p-3"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{pb.event_name}</p>
                          <p className="flex items-center gap-1.5 text-base font-bold tabular-nums">
                            {pb.result_text}
                            {indoor != null && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                                  indoor
                                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                {indoor ? "Halli" : "Ulko"}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {pb.competition_name} · {fmtDate(pb.competition_date)}
                          {isLowerBetter(pb.event_category) ? " · aika" : " · tulos"}
                        </p>
                        {(pbIndoor || pbOutdoor) &&
                          (pbIndoor?.id !== pb.id || pbOutdoor?.id !== pb.id) && (
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                              {pbIndoor && pbIndoor.id !== pb.id && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">
                                  Halli-PB
                                  <span className="font-semibold tabular-nums">
                                    {pbIndoor.result_text}
                                  </span>
                                </span>
                              )}
                              {pbOutdoor && pbOutdoor.id !== pb.id && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                                  Ulko-PB
                                  <span className="font-semibold tabular-nums">
                                    {pbOutdoor.result_text}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lajikohtainen kehitys
              </h2>
              <ul className="space-y-3">
                {groups.map((g) => (
                  <EventGroupView key={`${g.eventName}|${g.subCategory}`} group={g} />
                ))}
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Kilpailut ({competitions.length})
              </h2>
              <ul className="space-y-2">
                {competitions.map((c) => (
                  <li key={c.id} className="rounded-lg border bg-card p-3">
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {fmtDate(c.date)}
                      </p>
                    </div>
                    {c.location && (
                      <p className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {c.location}
                      </p>
                    )}
                    <ul className="divide-y divide-border text-xs">
                      {c.results.map((r) => (
                        <li key={r.id} className="py-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate">
                              {r.event_name}
                              {r.sub_category && (
                                <span className="text-muted-foreground"> · {r.sub_category}</span>
                              )}
                            </span>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums ${
                                r.was_pb ? "text-primary" : ""
                              }`}
                            >
                              {r.result_rank === 1 && (
                                <Trophy
                                  aria-label="Lajivoitto"
                                  className="h-3.5 w-3.5 text-yellow-500"
                                  fill="currentColor"
                                />
                              )}
                              {r.result_text}
                              {r.was_pb && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                                  <Trophy className="h-2.5 w-2.5" />
                                  PB
                                </span>
                              )}
                              {r.result_rank != null && (
                                <span className="font-normal text-muted-foreground">
                                  ({r.result_rank}.)
                                </span>
                              )}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>

            {profile?.ownerLabel && (
              <p className="pb-6 text-center text-xs text-muted-foreground">
                Jakanut {profile.ownerLabel}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
