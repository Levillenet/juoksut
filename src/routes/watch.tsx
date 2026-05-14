import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search as SearchIcon, RefreshCw, Pin, X, UserPlus, Printer, Building2 } from "lucide-react";
import logo from "@/assets/lahden-ahkera-logo.png";

import {
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
  translateSub,
  STATUS_LABEL,
} from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { useWatchedAthletes, athleteKey, type WatchedAthlete } from "@/lib/watch-store";
import { RecordBadge } from "@/lib/records";
import { effectiveRecord } from "@/lib/record-baseline";
import {
  competitionIndexQueryOptions,
  competitionIndexKey,
  type IndexedEntry,
} from "@/lib/tuloslista-queries";
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

const STATUS_STYLE: Record<"Unallocated" | "Allocated" | "Progress" | "Official", string> = {
  Unallocated: "bg-muted text-muted-foreground",
  Allocated: "bg-accent text-accent-foreground",
  Progress: "bg-primary text-primary-foreground",
  Official: "bg-foreground text-background",
};

function WatchPage() {
  const [competitionId] = useCompetitionId();
  const queryClient = useQueryClient();
  const { list: watched, add, remove } = useWatchedAthletes();
  const [query, setQuery] = useState<string>("");
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const indexQuery = useQuery(
    competitionIndexQueryOptions(competitionId, (done, total) =>
      setProgress({ done, total }),
    ),
  );

  const index: IndexedEntry[] | null = indexQuery.data?.entries ?? null;
  const name = indexQuery.data?.name ?? "";
  const loading = indexQuery.isFetching;
  const error = indexQuery.error
    ? indexQuery.error instanceof Error
      ? indexQuery.error.message
      : "Tuntematon virhe"
    : null;
  const updatedAt = indexQuery.dataUpdatedAt
    ? new Date(indexQuery.dataUpdatedAt)
    : null;

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: competitionIndexKey(competitionId) });
  };

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

  // Club selector state + derived data
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  const clubs = useMemo(() => {
    if (!index) return [] as Array<{ id: number; name: string; athletes: number; entries: number }>;
    const map = new Map<number, { id: number; name: string; athletes: Set<string>; entries: number }>();
    for (const e of index) {
      const id = e.alloc.Organization?.Id;
      if (id == null) continue;
      const nm = e.alloc.Organization?.Name ?? "";
      if (!map.has(id)) map.set(id, { id, name: nm, athletes: new Set(), entries: 0 });
      const c = map.get(id)!;
      c.athletes.add(`${e.alloc.Surname}|${e.alloc.Firstname}`);
      c.entries += 1;
    }
    return Array.from(map.values())
      .map((c) => ({ id: c.id, name: c.name, athletes: c.athletes.size, entries: c.entries }))
      .sort((a, b) => a.name.localeCompare(b.name, "fi"));
  }, [index]);

  const clubProgram = useMemo(() => {
    if (!index || selectedOrgId == null) return [] as Array<{
      date: string;
      rounds: Array<{ round: IndexedEntry["round"]; allocs: IndexedEntry[] }>;
    }>;
    const filtered = index.filter(
      (e) => (e.alloc.Organization?.Id ?? -1) === selectedOrgId,
    );
    const byDate = new Map<string, Map<number, { round: IndexedEntry["round"]; allocs: IndexedEntry[] }>>();
    for (const e of filtered) {
      const dk = helsinkiDateKey(e.heatBegin);
      if (!byDate.has(dk)) byDate.set(dk, new Map());
      const rounds = byDate.get(dk)!;
      if (!rounds.has(e.round.Id)) rounds.set(e.round.Id, { round: e.round, allocs: [] });
      rounds.get(e.round.Id)!.allocs.push(e);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => {
        const [da, ma, ya] = a[0].split(".").map(Number);
        const [db, mb, yb] = b[0].split(".").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      })
      .map(([date, rounds]) => ({
        date,
        rounds: Array.from(rounds.values()).sort((a, b) =>
          a.round.BeginDateTimeWithTZ.localeCompare(b.round.BeginDateTimeWithTZ),
        ),
      }));
  }, [index, selectedOrgId]);

  const selectedClub = clubs.find((c) => c.id === selectedOrgId) ?? null;

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
            onClick={reload}
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

        <div>

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

        {/* Club program */}
        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Seuran ohjelma
          </h3>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={selectedOrgId ?? ""}
                  onChange={(e) =>
                    setSelectedOrgId(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                  className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Valitse seura"
                  disabled={clubs.length === 0}
                >
                  <option value="">
                    {clubs.length === 0 ? "Ladataan seuroja…" : `Valitse seura (${clubs.length})`}
                  </option>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.athletes})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                disabled={!selectedClub}
                onClick={() => {
                  if (!selectedClub) return;
                  window.open(
                    `/print/club?org=${selectedClub.id}&auto=1`,
                    "_blank",
                    "noopener",
                  );
                }}
                className="gap-2"
              >
                <Printer className="h-4 w-4" /> Tulosta ohjelma
              </Button>
            </div>

            {selectedClub && (
              <p className="mt-3 text-xs text-muted-foreground">
                {selectedClub.name} · {selectedClub.athletes}{" "}
                {selectedClub.athletes === 1 ? "urheilija" : "urheilijaa"} ·{" "}
                {selectedClub.entries}{" "}
                {selectedClub.entries === 1 ? "lähtö" : "lähtöä"}
              </p>
            )}

            {selectedClub && clubProgram.length > 0 && (
              <div className="mt-4 space-y-4">
                {clubProgram.map((g) => (
                  <div key={g.date}>
                    <h4 className="mb-1 border-b border-border pb-1 text-sm font-bold">
                      {g.date}
                    </h4>
                    <ul className="divide-y divide-border">
                      {g.rounds.map(({ round, allocs }) => {
                        const isRun = isRunningEvent(round);
                        return (
                          <li key={round.Id} className="py-2">
                            <Link
                              to="/round/$eventId/$roundId"
                              params={{
                                eventId: String(round.EventId),
                                roundId: String(round.Id),
                              }}
                              className="flex items-baseline gap-3 hover:opacity-80"
                            >
                              <span className="w-12 shrink-0 text-sm font-bold tabular-nums">
                                {formatTime(round.BeginDateTimeWithTZ)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                  {round.EventName}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {round.SubCategory && translateSub(round.SubCategory)}
                                  {round.Name && ` · ${round.Name}`}
                                </p>
                                <ul className="mt-1 space-y-0.5">
                                  {allocs
                                    .slice()
                                    .sort((a, b) => {
                                      if (a.heatIndex !== b.heatIndex)
                                        return a.heatIndex - b.heatIndex;
                                      return (
                                        (a.alloc.Position ?? 0) -
                                        (b.alloc.Position ?? 0)
                                      );
                                    })
                                    .map((e, idx) => (
                                      <li
                                        key={`${e.alloc.Id}-${idx}`}
                                        className="flex flex-wrap items-baseline gap-x-2 text-xs"
                                      >
                                        <span className="font-medium text-foreground">
                                          {e.alloc.Surname} {e.alloc.Firstname}
                                        </span>
                                        {e.alloc.Number && (
                                          <span className="tabular-nums text-muted-foreground">
                                            #{e.alloc.Number}
                                          </span>
                                        )}
                                        <span className="text-muted-foreground">
                                          {isRun
                                            ? `Erä ${e.heatIndex}${e.alloc.Position != null ? ` · Rata ${e.alloc.Position}` : ""}`
                                            : e.alloc.Position != null
                                              ? `Järj. ${e.alloc.Position}`
                                              : ""}
                                        </span>
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {selectedClub && clubProgram.length === 0 && !loading && (
              <p className="mt-3 text-sm text-muted-foreground">
                Ei lähtöjä valitulla seuralla.
              </p>
            )}
          </div>
        </section>

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
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        to="/athlete/$key"
                        params={{ key: athlete.key }}
                        className="inline-flex items-center rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
                      >
                        Dashboard
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(athlete.key)}
                        aria-label="Poista seurannasta"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
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
                                  <>
                                    <p className="mt-1 text-sm font-bold tabular-nums">
                                      {e.alloc.Result}
                                      {e.alloc.ResultRank != null && (
                                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                                          ({e.alloc.ResultRank}.)
                                        </span>
                                      )}
                                    </p>
                                    <div className="mt-1 flex justify-end">
                                      {(() => {
                                        const eff = effectiveRecord(e.round.EventId, e.alloc);
                                        return (
                                          <RecordBadge
                                            category={e.round.Category}
                                            result={e.alloc.Result}
                                            pb={eff.pb}
                                            sb={eff.sb}
                                            size="sm"
                                            layout="row"
                                          />
                                        );
                                      })()}
                                    </div>
                                  </>
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
        </div>


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
