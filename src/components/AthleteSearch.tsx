import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import {
  fetchRounds,
  fetchEvent,
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
  type Round,
  type Allocation,
} from "@/lib/tuloslista";
import { Input } from "@/components/ui/input";
import { athleteKey } from "@/lib/watch-store";

interface IndexedEntry {
  round: Round;
  alloc: Allocation;
  heatIndex: number;
  heatBegin: string;
}

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
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState<IndexedEntry[] | null>(null);

  const buildIndex = async () => {
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const byDate = await fetchRounds(competitionId);
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
              if (runningOnly && !isRunningEvent(matchingRound)) continue;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tuntematon virhe");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buildIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, runningOnly]);

  const groups = useMemo<GroupedAthlete[]>(() => {
    if (!index) return [];
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const matches = index.filter((e) => e.alloc.Surname?.toLowerCase().includes(q));
    const map = new Map<string, GroupedAthlete>();
    for (const e of matches) {
      const key = `${e.alloc.Surname}|${e.alloc.Firstname}|${e.alloc.Organization?.Id ?? ""}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: `${e.alloc.Surname} ${e.alloc.Firstname}`.trim(),
          organization: e.alloc.Organization?.Name ?? "",
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
          aria-label="Sukunimi"
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
                <p className="truncate text-base font-bold leading-tight">{g.name}</p>
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
                        {isRun ? (
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
