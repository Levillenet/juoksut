import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search as SearchIcon, RefreshCw, Pin, X, UserPlus, Printer, Building2, Trophy } from "lucide-react";
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
import { fetchDailyBestForAthletes } from "@/lib/daily-best";

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

  // Today's-best comparable result (same event + age class) for each watched athlete
  const watchedKeysList = useMemo(() => watched.map((w) => w.key), [watched]);
  const dailyBestQuery = useQuery({
    queryKey: ["daily-best-for-athletes", watchedKeysList.slice().sort().join(",")],
    queryFn: () => fetchDailyBestForAthletes(watchedKeysList),
    enabled: watchedKeysList.length > 0,
    staleTime: 60_000,
  });

  // Club selector state + derived data
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  // Separate club selector for the "lisää urheilijoita seurantaan" bulk flow
  const [selectedBulkOrgId, setSelectedBulkOrgId] = useState<number | null>(null);
  const [selectedAgeClasses, setSelectedAgeClasses] = useState<Set<string>>(new Set());

  // Reset age-class selection when bulk club changes
  const onSelectBulkClub = (id: number | null) => {
    setSelectedBulkOrgId(id);
    setSelectedAgeClasses(new Set());
  };

  // Age classes available for the selected bulk-add club, with athlete counts
  const clubAgeClasses = useMemo(() => {
    if (!index || selectedBulkOrgId == null) return [] as Array<{
      group: string;
      athletes: Array<{ key: string; surname: string; firstname: string; organization: string; organizationId: number | null }>;
    }>;
    const map = new Map<string, Map<string, { key: string; surname: string; firstname: string; organization: string; organizationId: number | null }>>();
    for (const e of index) {
      if ((e.alloc.Organization?.Id ?? -1) !== selectedBulkOrgId) continue;
      const group = e.round.GroupName || "(Muu)";
      const orgId = e.alloc.Organization?.Id ?? null;
      const k = athleteKey(e.alloc.Surname, e.alloc.Firstname, orgId);
      if (!map.has(group)) map.set(group, new Map());
      const inner = map.get(group)!;
      if (!inner.has(k)) {
        inner.set(k, {
          key: k,
          surname: e.alloc.Surname,
          firstname: e.alloc.Firstname,
          organization: e.alloc.Organization?.Name ?? "",
          organizationId: orgId,
        });
      }
    }
    return Array.from(map.entries())
      .map(([group, ath]) => ({ group, athletes: Array.from(ath.values()) }))
      .sort((a, b) => a.group.localeCompare(b.group, "fi"));
  }, [index, selectedBulkOrgId]);

  const toggleAgeClass = (group: string) => {
    setSelectedAgeClasses((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const bulkAddSelection = useMemo(() => {
    const seen = new Map<string, { key: string; surname: string; firstname: string; organization: string; organizationId: number | null }>();
    for (const g of clubAgeClasses) {
      if (!selectedAgeClasses.has(g.group)) continue;
      for (const a of g.athletes) {
        if (!seen.has(a.key)) seen.set(a.key, a);
      }
    }
    return Array.from(seen.values());
  }, [clubAgeClasses, selectedAgeClasses]);

  const bulkAddNewCount = bulkAddSelection.filter((a) => !watchedKeys.has(a.key)).length;

  const addSelectedToWatch = async () => {
    for (const a of bulkAddSelection) {
      if (watchedKeys.has(a.key)) continue;
      await add({
        key: a.key,
        surname: a.surname,
        firstname: a.firstname,
        organization: a.organization,
        organizationId: a.organizationId,
      } satisfies WatchedAthlete);
    }
    setSelectedAgeClasses(new Set());
  };

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

        {/* Bulk add: club + age classes → seurantaan */}
        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lisää seuran urheilijat seurantaan
          </h3>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={selectedBulkOrgId ?? ""}
                onChange={(e) =>
                  onSelectBulkClub(e.target.value ? parseInt(e.target.value, 10) : null)
                }
                className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Valitse seura, jonka urheilijoita haluat seurata"
                disabled={clubs.length === 0}
              >
                <option value="">
                  {clubs.length === 0
                    ? "Ladataan seuroja…"
                    : `1) Valitse seura (${clubs.length})`}
                </option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.athletes})
                  </option>
                ))}
              </select>
            </div>

            {selectedBulkOrgId != null && clubAgeClasses.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Ei ikäluokkia tälle seuralle.
              </p>
            )}

            {selectedBulkOrgId != null && clubAgeClasses.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    2) Valitse ikäluokat
                  </p>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                      onClick={() =>
                        setSelectedAgeClasses(
                          new Set(clubAgeClasses.map((g) => g.group)),
                        )
                      }
                      disabled={selectedAgeClasses.size === clubAgeClasses.length}
                    >
                      Valitse kaikki
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:underline disabled:cursor-not-allowed disabled:no-underline"
                      onClick={() => setSelectedAgeClasses(new Set())}
                      disabled={selectedAgeClasses.size === 0}
                    >
                      Tyhjennä
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {clubAgeClasses.map((g) => {
                    const active = selectedAgeClasses.has(g.group);
                    return (
                      <button
                        key={g.group}
                        type="button"
                        onClick={() => toggleAgeClass(g.group)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-accent"
                        }`}
                      >
                        {g.group} ({g.athletes.length})
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {selectedAgeClasses.size === 0
                      ? "Valitse yksi tai useampi ikäluokka."
                      : `${bulkAddSelection.length} valittu · ${bulkAddNewCount} uutta (jo seurattavia ei lisätä uudestaan)`}
                  </p>
                  <Button
                    size="sm"
                    disabled={bulkAddNewCount === 0}
                    onClick={addSelectedToWatch}
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    {bulkAddNewCount > 0
                      ? `Lisää ${bulkAddNewCount} seurantaan`
                      : "Lisää seurantaan"}
                  </Button>
                </div>
              </div>
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

                  {(() => {
                    const bests = dailyBestQuery.data?.[athlete.key] ?? [];
                    if (bests.length === 0) return null;
                    return (
                      <div className="mb-3 rounded-md border border-dashed bg-background/40 px-2 py-1.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Päivän parhaat tulokset ympäri Suomen
                        </p>
                        <ul className="space-y-1">
                          {bests.map((b) => (
                            <li
                              key={`${b.event_name}|${b.age_class}|${b.competition_id}`}
                              className="flex items-baseline gap-2 text-[11px]"
                            >
                              <Trophy className="h-3 w-3 shrink-0 text-primary" />
                              <span className="font-semibold">
                                {b.event_name} {b.age_class}:
                              </span>
                              <span className="font-bold tabular-nums">{b.result_text}</span>
                              <span className="min-w-0 truncate text-muted-foreground">
                                — {b.surname} {b.firstname} ({b.organization}) ·{" "}
                                {b.competition_name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

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
