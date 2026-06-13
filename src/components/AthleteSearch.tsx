import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, UserPlus, Check } from "lucide-react";
import {
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
} from "@/lib/tuloslista";
import {
  competitionIndexQueryOptions,
  type IndexedEntry,
} from "@/lib/tuloslista-queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { athleteKey, useWatchedAthletes } from "@/lib/watch-store";

interface GroupedAthlete {
  key: string;
  name: string;
  surname: string;
  firstname: string;
  organization: string;
  organizationId: number | null;
  entries: IndexedEntry[];
}

interface Props {
  competitionId: number;
  /** When true, only running events are returned in the index. */
  runningOnly?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function AthleteSearch({
  competitionId,
  runningOnly = false,
  placeholder = "Nimi (etu- tai sukunimi)",
  autoFocus = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const { list: watched, add, remove } = useWatchedAthletes();
  const watchedKeys = useMemo(
    () => new Set(watched.map((w) => w.key)),
    [watched],
  );

  // Käytetään samaa jaettua indeksiä kuin /watch — saa myös pelkkien
  // ilmoittautumisten kautta tulevat rivit (huomisen lajit ilman eräjakoa).
  // skipBaselines: true → ei kirjoiteta record-baselineja pelkän haun vuoksi.
  const indexQuery = useQuery(
    competitionIndexQueryOptions(competitionId, {
      skipBaselines: true,
      onProgress: (done, total) => setProgress({ done, total }),
    }),
  );

  const loading = indexQuery.isFetching && !indexQuery.data;
  const error = indexQuery.error
    ? indexQuery.error instanceof Error
      ? indexQuery.error.message
      : "Tuntematon virhe"
    : null;

  const index = useMemo<IndexedEntry[] | null>(() => {
    const all = indexQuery.data?.entries ?? null;
    if (!all) return null;
    return runningOnly ? all.filter((e) => isRunningEvent(e.round)) : all;
  }, [indexQuery.data, runningOnly]);

  const groups = useMemo<GroupedAthlete[]>(() => {
    if (!index) return [];
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const tokens = q.split(/\s+/).filter((t) => t.length > 0);
    const matches = index.filter((e) => {
      const s = (e.alloc.Surname ?? "").toLowerCase();
      const f = (e.alloc.Firstname ?? "").toLowerCase();
      const haystack = `${s} ${f} ${f} ${s}`;
      return tokens.every((t) => haystack.includes(t));
    });
    const map = new Map<string, GroupedAthlete>();
    for (const e of matches) {
      const orgId = e.alloc.Organization?.Id ?? null;
      const key = athleteKey(e.alloc.Surname, e.alloc.Firstname, orgId);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: `${e.alloc.Surname} ${e.alloc.Firstname}`.trim(),
          surname: e.alloc.Surname,
          firstname: e.alloc.Firstname,
          organization: e.alloc.Organization?.Name ?? "",
          organizationId: orgId,
          entries: [],
        });
      }
      map.get(key)!.entries.push(e);
    }
    for (const g of map.values()) {
      g.entries.sort((a, b) => a.heatBegin.localeCompare(b.heatBegin));
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fi"));
  }, [index, query]);

  return (
    <div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label="Nimi"
        />
      </div>
      {loading && progress.total > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Ladataan osallistujatietoja… {progress.done}/{progress.total}
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && index && query.trim().length >= 2 && groups.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Ei osumia haulla "{query}".
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {groups.map((g) => (
          <li key={g.key} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to="/athlete/$key"
                  params={{ key: g.key }}
                  className="block truncate text-base font-bold leading-tight hover:underline"
                >
                  {g.name}
                </Link>
                {g.organization && (
                  <p className="truncate text-xs text-muted-foreground">{g.organization}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                {g.entries.length} lajia
              </span>
            </div>
            <ul className="divide-y divide-border">
              {g.entries.map((e, idx) => {
                const isRun = isRunningEvent(e.round);
                const enrollmentOnly = e.fromEnrollment === true;
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
                        <p className="truncate text-sm font-semibold">{e.round.EventName}</p>
                        {e.round.Name && (
                          <p className="truncate text-xs text-muted-foreground">
                            {e.round.Name}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        {enrollmentOnly ? (
                          <p className="text-muted-foreground">Ilmoittautunut</p>
                        ) : isRun ? (
                          <>
                            <p className="font-semibold">Erä {e.heatIndex}</p>
                            {e.alloc.Position != null && (
                              <p className="text-muted-foreground">Rata {e.alloc.Position}</p>
                            )}
                          </>
                        ) : (
                          e.alloc.Position != null && (
                            <p className="text-muted-foreground">Järj. {e.alloc.Position}</p>
                          )
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
