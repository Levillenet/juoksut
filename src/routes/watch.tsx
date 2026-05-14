import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search as SearchIcon, RefreshCw, Pin, X, UserPlus } from "lucide-react";
import logo from "@/assets/lahden-ahkera-logo.png";

import {
  fetchRounds,
  fetchEvent,
  fetchProperties,
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
  translateSub,
  STATUS_LABEL,
  type Round,
  type Allocation,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { useWatchedAthletes, athleteKey, type WatchedAthlete } from "@/lib/watch-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { RequireRole } from "@/components/RequireRole";

export const Route = createFileRoute("/watch")({
  head: () => ({
    meta: [
      { title: "Kilpailijaseuranta" },
      {
        name: "description",
        content: "Kiinnitä urheilijoita seurantaan ja seuraa heidän lajejaan kisassa.",
      },
    ],
  }),
  component: () => (
    <RequireRole allow={["user"]}>
      <WatchPage />
    </RequireRole>
  ),
});

interface IndexedEntry {
  round: Round;
  alloc: Allocation;
  heatIndex: number;
  heatBegin: string;
}

const STATUS_STYLE: Record<Round["Status"], string> = {
  Unallocated: "bg-muted text-muted-foreground",
  Allocated: "bg-accent text-accent-foreground",
  Progress: "bg-primary text-primary-foreground",
  Official: "bg-foreground text-background",
};

function WatchPage() {
  const [competitionId] = useCompetitionId();
  const { list: watched, add, remove } = useWatchedAthletes();
  const [name, setName] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState<IndexedEntry[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const buildIndex = async () => {
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const [byDate, props] = await Promise.all([
        fetchRounds(competitionId),
        fetchProperties(competitionId).catch(() => null),
      ]);
      setName(props?.Competition?.Name ?? "");

      const allRounds: Round[] = Object.values(byDate).flat();
      const eventIds = Array.from(new Set(allRounds.map((r) => r.EventId)));
      setProgress({ done: 0, total: eventIds.length });

      const collected: IndexedEntry[] = [];
      const CONCURRENCY = 6;
      let cursor = 0;
      const worker = async () => {
        while (cursor < eventIds.length) {
          const i = cursor++;
          const eid = eventIds[i];
          try {
            const ev = await fetchEvent(competitionId, eid);
            for (const round of ev.Rounds) {
              const matchingRound = allRounds.find((r) => r.Id === round.Id) ?? {
                ...allRounds.find((r) => r.EventId === eid)!,
                Id: round.Id,
                BeginDateTimeWithTZ: round.BeginDateTimeWithTZ,
                Name: round.Name,
                Status: round.Status,
              };
              for (const heat of round.Heats) {
                for (const alloc of heat.Allocations) {
                  collected.push({
                    round: matchingRound,
                    alloc,
                    heatIndex: heat.Index,
                    heatBegin: round.BeginDateTimeWithTZ,
                  });
                }
              }
            }
          } catch {
            /* skip */
          } finally {
            setProgress((p) => ({ done: p.done + 1, total: p.total }));
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      setIndex(collected);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tuntematon virhe");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buildIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  // Auto-refresh every 60s to pick up status / result updates
  useEffect(() => {
    const t = setInterval(() => {
      if (!loading) buildIndex();
    }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, loading]);

  // Search results (grouped by athlete) — only when 2+ chars typed
  const searchGroups = useMemo(() => {
    if (!index) return [];
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const map = new Map<
      string,
      { key: string; surname: string; firstname: string; organization: string; organizationId: number | null; count: number }
    >();
    for (const e of index) {
      if (!e.alloc.Surname?.toLowerCase().includes(q)) continue;
      const orgId = e.alloc.Organization?.Id ?? null;
      const k = athleteKey(e.alloc.Surname, e.alloc.Firstname, orgId);
      if (!map.has(k)) {
        map.set(k, {
          key: k,
          surname: e.alloc.Surname,
          firstname: e.alloc.Firstname,
          organization: e.alloc.Organization?.Name ?? "",
          organizationId: orgId,
          count: 0,
        });
      }
      map.get(k)!.count += 1;
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.surname} ${a.firstname}`.localeCompare(`${b.surname} ${b.firstname}`, "fi"),
    );
  }, [index, query]);

  const watchedKeys = useMemo(() => new Set(watched.map((w) => w.key)), [watched]);

  // Per watched athlete: their entries sorted by start time
  const watchedSections = useMemo(() => {
    if (!index) return [];
    return watched.map((w) => {
      const entries = index
        .filter(
          (e) =>
            e.alloc.Surname === w.surname &&
            e.alloc.Firstname === w.firstname &&
            (e.alloc.Organization?.Id ?? null) === w.organizationId,
        )
        .sort((a, b) => a.heatBegin.localeCompare(b.heatBegin));
      return { athlete: w, entries };
    });
  }, [index, watched]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <img
            src={logo}
            alt="Lahden Ahkera"
            className="h-10 w-10 shrink-0 rounded-md object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              {name || `Kisa #${competitionId}`}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {updatedAt ? `Päivitetty ${formatClock(updatedAt)}` : "Ladataan…"}
              {watched.length > 0 && ` · ${watched.length} seurannassa`}
            </p>
          </div>
          <h2 className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-3xl font-black uppercase tracking-widest text-primary lg:block">
            Kilpailijaseuranta
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={buildIndex}
            disabled={loading}
            aria-label="Päivitä"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hae sukunimellä ja kiinnitä seurantaan"
              className="pl-9"
              aria-label="Sukunimi"
            />
          </div>
          {loading && progress.total > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ladataan osallistujatietoja… {progress.done}/{progress.total}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Search results */}
        {query.trim().length >= 2 && (
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hakutulokset
            </h3>
            {searchGroups.length === 0 ? (
              <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
                Ei osumia haulla "{query}".
              </p>
            ) : (
              <ul className="space-y-2">
                {searchGroups.map((g) => {
                  const isWatched = watchedKeys.has(g.key);
                  return (
                    <li
                      key={g.key}
                      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {g.surname} {g.firstname}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {g.organization} · {g.count} {g.count === 1 ? "laji" : "lajia"}
                        </p>
                      </div>
                      {isWatched ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => remove(g.key)}
                          aria-label="Poista seurannasta"
                        >
                          <X className="h-4 w-4" /> Seurannassa
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            add({
                              key: g.key,
                              surname: g.surname,
                              firstname: g.firstname,
                              organization: g.organization,
                              organizationId: g.organizationId,
                            } satisfies WatchedAthlete)
                          }
                          aria-label="Lisää seurantaan"
                        >
                          <UserPlus className="h-4 w-4" /> Seuraa
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* Watched athletes */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Seurattavat kilpailijat
          </h3>
          {watched.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
              <Pin className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Ei vielä kiinnitettyjä urheilijoita. Hae sukunimellä yltä ja paina <em>Seuraa</em>.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {watchedSections.map(({ athlete, entries }) => (
                <li key={athlete.key} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold leading-tight">
                        {athlete.surname} {athlete.firstname}
                      </p>
                      {athlete.organization && (
                        <p className="truncate text-xs text-muted-foreground">
                          {athlete.organization}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(athlete.key)}
                      aria-label="Poista seurannasta"
                    >
                      <X className="h-4 w-4" /> Poista
                    </Button>
                  </div>

                  {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Ei lajeja tässä kisassa.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {entries.map((e, idx) => {
                        const isRun = isRunningEvent(e.round);
                        return (
                          <li key={`${e.round.Id}-${e.alloc.Id}-${idx}`} className="py-2">
                            <Link
                              to="/round/$eventId/$roundId"
                              params={{
                                eventId: String(e.round.EventId),
                                roundId: String(e.round.Id),
                              }}
                              className="flex items-center gap-3 hover:opacity-80"
                            >
                              <div className="flex w-16 shrink-0 flex-col items-start">
                                <span className="text-sm font-bold tabular-nums">
                                  {formatTime(e.heatBegin)}
                                </span>
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  {helsinkiDateKey(e.heatBegin)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                  {e.round.EventName}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {e.round.SubCategory && translateSub(e.round.SubCategory)}
                                  {e.round.Name && ` · ${e.round.Name}`}
                                  {isRun && ` · Erä ${e.heatIndex}`}
                                  {e.alloc.Position != null &&
                                    (isRun ? ` · Rata ${e.alloc.Position}` : ` · Järj. ${e.alloc.Position}`)}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[e.round.Status]}`}
                                >
                                  {STATUS_LABEL[e.round.Status]}
                                </span>
                                {e.alloc.Result && (
                                  <p className="mt-1 text-sm font-bold tabular-nums">
                                    {e.alloc.Result}
                                    {e.alloc.ResultRank != null && (
                                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                                        ({e.alloc.ResultRank}.)
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · päivittyy automaattisesti minuutin välein
        </p>
      </main>
    </div>
  );
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
