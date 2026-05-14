import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Trophy, Activity, Clock } from "lucide-react";

import {
  fetchRounds,
  fetchEvent,
  fetchProperties,
  formatTime,
  helsinkiDateKey,
  translateSub,
  type Round,
  type RoundsByDate,
  type Allocation,
  type EventResults,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/announcer")({
  head: () => ({
    meta: [
      { title: "Kuuluttajan dashboard" },
      {
        name: "description",
        content:
          "Desktop-kokoinen kuuluttajanäkymä: käynnissä olevien lajien kärki ja juuri valmistuneet tulokset.",
      },
    ],
  }),
  component: AnnouncerPage,
});

interface EventDetailCache {
  [eventId: number]: EventResults;
}

function AnnouncerPage() {
  const [competitionId] = useCompetitionId();
  const [data, setData] = useState<RoundsByDate | null>(null);
  const [name, setName] = useState("");
  const [details, setDetails] = useState<EventDetailCache>({});
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);

  const loadSchedule = async () => {
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
    loadSchedule();
    const t = setInterval(loadSchedule, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  const todayKey = helsinkiDateKey(new Date().toISOString());
  const todayRounds = useMemo<Round[]>(() => {
    if (!data) return [];
    return [...(data[todayKey] ?? [])].sort((a, b) =>
      a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ),
    );
  }, [data, todayKey]);

  const inProgress = todayRounds.filter((r) => r.Status === "Progress");
  const completed = todayRounds.filter((r) => r.Status === "Official").reverse().slice(0, 8);
  const upcoming = todayRounds
    .filter((r) => {
      if (r.Status === "Official" || r.Status === "Progress") return false;
      return new Date(r.BeginDateTimeWithTZ).getTime() > now.getTime() - 5 * 60_000;
    })
    .slice(0, 12);

  // Fetch detailed results for Progress + Official events
  useEffect(() => {
    const ids = [...inProgress, ...completed].map((r) => r.EventId);
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        ids.map((id) => fetchEvent(competitionId, id)),
      );
      if (cancelled) return;
      setDetails((prev) => {
        const next = { ...prev };
        results.forEach((res, i) => {
          if (res.status === "fulfilled") next[ids[i]] = res.value;
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [competitionId, JSON.stringify(inProgress.map((r) => r.EventId)), JSON.stringify(completed.map((r) => r.EventId))]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">
              {name || `Kisa #${competitionId}`}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Kuuluttajan dashboard · {todayKey}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black tabular-nums leading-none">
              {String(now.getHours()).padStart(2, "0")}:
              {String(now.getMinutes()).padStart(2, "0")}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {inProgress.length} käynnissä · {completed.length} valmis
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={loadSchedule} aria-label="Päivitä">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* IN PROGRESS */}
          <section className="lg:col-span-2">
            <SectionTitle icon={<Activity className="h-4 w-4" />} title="Käynnissä" count={inProgress.length} />
            {inProgress.length === 0 ? (
              <EmptyCard text="Ei käynnissä olevia lajeja." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {inProgress.map((r) => (
                  <EventCard key={r.Id} round={r} detail={details[r.EventId]} live />
                ))}
              </div>
            )}

            <div className="mt-8">
              <SectionTitle icon={<Trophy className="h-4 w-4" />} title="Juuri valmistunut" count={completed.length} />
              {completed.length === 0 ? (
                <EmptyCard text="Ei valmistuneita lajeja vielä." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {completed.map((r) => (
                    <EventCard key={r.Id} round={r} detail={details[r.EventId]} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* UPCOMING */}
          <aside>
            <SectionTitle icon={<Clock className="h-4 w-4" />} title="Seuraavaksi" count={upcoming.length} />
            {upcoming.length === 0 ? (
              <EmptyCard text="Ei tulevia lajeja tänään." />
            ) : (
              <ul className="space-y-2">
                {upcoming.map((r, i) => (
                  <li
                    key={r.Id}
                    className={`flex items-center gap-3 rounded-xl border bg-card p-3 ${
                      i === 0 ? "border-accent" : "border-border"
                    }`}
                  >
                    <div className="w-14 shrink-0 text-xl font-bold tabular-nums">
                      {formatTime(r.BeginDateTimeWithTZ)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold leading-tight">{r.EventName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.Name}
                        {r.SubCategory && ` · ${translateSub(r.SubCategory)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · automaattinen päivitys 30&nbsp;s välein
        </p>
      </main>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
        {icon}
      </span>
      <h2 className="text-sm font-bold uppercase tracking-widest">{title}</h2>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function EventCard({
  round,
  detail,
  live = false,
}: {
  round: Round;
  detail?: EventResults;
  live?: boolean;
}) {
  const top3 = useMemo<Allocation[]>(() => {
    if (!detail) return [];
    const all: Allocation[] = [];
    detail.Rounds.forEach((rd) => rd.Heats.forEach((h) => all.push(...h.Allocations)));
    return all
      .filter((a) => !a.NotInCompetition && (a.ResultRank != null || a.Result))
      .sort((a, b) => {
        const ra = a.ResultRank ?? 999;
        const rb = b.ResultRank ?? 999;
        return ra - rb;
      })
      .slice(0, 3);
  }, [detail]);

  return (
    <Link
      to="/round/$eventId/$roundId"
      params={{ eventId: String(round.EventId), roundId: String(round.Id) }}
      className={`block rounded-2xl border bg-card p-4 transition-colors hover:bg-secondary/50 ${
        live ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold leading-tight">{round.EventName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {round.Name}
            {round.SubCategory && ` · ${translateSub(round.SubCategory)}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {live ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
              Live
            </span>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {formatTime(round.BeginDateTimeWithTZ)}
            </span>
          )}
        </div>
      </div>

      {top3.length === 0 ? (
        <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
          {detail ? "Tulokset eivät vielä saatavilla" : "Ladataan tuloksia…"}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {top3.map((a) => (
            <li
              key={a.AllocId}
              className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums ${
                  a.ResultRank === 1
                    ? "bg-primary text-primary-foreground"
                    : a.ResultRank === 2
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-secondary-foreground"
                }`}
              >
                {a.ResultRank ?? "–"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{a.Name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.Organization?.NameShort ?? a.Organization?.Name ?? ""}
                </p>
              </div>
              <span className="shrink-0 text-base font-bold tabular-nums">
                {a.Result ?? "–"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Link>
  );
}
