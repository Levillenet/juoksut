import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, Calendar as CalendarIcon, ChevronDown, ChevronUp, Trophy } from "lucide-react";

import {
  fetchClubPbs,
  fetchClubTodayResults,
  fetchTodayClubs,
  normalizeEventName,
  type ClubTodayRow,
} from "@/lib/club-today";

const STORAGE_KEY = "clubToday.orgId";

function loadOrgId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function saveOrgId(id: number | null) {
  try {
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* ignore */
  }
}

function helsinkiTodayYmd(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function ymdToDate(ymd: string): Date {
  // Noon UTC lands on the same calendar day in Helsinki (UTC+2/+3).
  return new Date(`${ymd}T12:00:00Z`);
}

export function ClubTodaySection({
  excludeCompetitionId,
}: {
  excludeCompetitionId?: number | null;
} = {}) {
  const [orgId, setOrgId] = useState<number | null>(() => loadOrgId());
  const [open, setOpen] = useState(true);
  const [dateYmd, setDateYmd] = useState<string>(() => helsinkiTodayYmd());
  const isToday = dateYmd === helsinkiTodayYmd();
  const selectedDate = useMemo(() => ymdToDate(dateYmd), [dateYmd]);

  const clubsQuery = useQuery({
    queryKey: ["club-today", "clubs", excludeCompetitionId ?? 0, dateYmd],
    queryFn: () => fetchTodayClubs(excludeCompetitionId, selectedDate),
    staleTime: 5 * 60_000,
  });

  const primaryClubs = clubsQuery.data ?? [];
  const shouldFallback =
    clubsQuery.isSuccess &&
    primaryClubs.length === 0 &&
    isToday &&
    excludeCompetitionId != null;

  const fallbackClubsQuery = useQuery({
    queryKey: ["club-today", "clubs", "all", dateYmd],
    queryFn: () => fetchTodayClubs(undefined, selectedDate),
    enabled: shouldFallback,
    staleTime: 5 * 60_000,
  });

  const fallbackClubs = fallbackClubsQuery.data ?? [];
  const showingAll = shouldFallback && fallbackClubs.length > 0;

  const effectiveExcludeId = showingAll ? null : (excludeCompetitionId ?? null);

  const resultsQuery = useQuery({
    queryKey: ["club-today", "results", orgId ?? 0, effectiveExcludeId ?? 0, dateYmd],
    queryFn: () => fetchClubTodayResults(orgId!, effectiveExcludeId, selectedDate),
    enabled: orgId != null,
    staleTime: 60_000,
  });

  useEffect(() => saveOrgId(orgId), [orgId]);

  const pbInputs = useMemo(() => {
    const rows = resultsQuery.data ?? [];
    const athletes = Array.from(new Set(rows.map((r) => r.athlete_key)));
    const events = Array.from(new Set(rows.map((r) => r.event_name)));
    return { athletes, events };
  }, [resultsQuery.data]);

  const pbsQuery = useQuery({
    queryKey: [
      "club-today",
      "pbs",
      orgId ?? 0,
      pbInputs.athletes.join(","),
      pbInputs.events.join(","),
    ],
    queryFn: () => fetchClubPbs(pbInputs.athletes, pbInputs.events),
    enabled: pbInputs.athletes.length > 0 && pbInputs.events.length > 0,
    staleTime: 5 * 60_000,
  });
  const pbs = pbsQuery.data ?? {};

  const clubs = showingAll ? fallbackClubs : primaryClubs;
  const isLoadingClubs =
    clubsQuery.isLoading || (shouldFallback && fallbackClubsQuery.isLoading);
  const showExcludeLabel = excludeCompetitionId != null && !showingAll;

  // Group rows by competition, then sort athletes within each event-row.
  const grouped = useMemo(() => {
    const rows = (resultsQuery.data ?? []) as ClubTodayRow[];
    const byComp = new Map<
      number,
      { competitionId: number; competitionName: string; rows: ClubTodayRow[] }
    >();
    for (const r of rows) {
      if (!byComp.has(r.competition_id)) {
        byComp.set(r.competition_id, {
          competitionId: r.competition_id,
          competitionName: r.competition_name,
          rows: [],
        });
      }
      byComp.get(r.competition_id)!.rows.push(r);
    }
    return Array.from(byComp.values())
      .map((c) => ({
        ...c,
        rows: c.rows.slice().sort((a, b) => {
          const ageCmp = a.age_class.localeCompare(b.age_class, "fi");
          if (ageCmp !== 0) return ageCmp;
          const evCmp = a.event_name.localeCompare(b.event_name, "fi");
          if (evCmp !== 0) return evCmp;
          return `${a.surname} ${a.firstname}`.localeCompare(
            `${b.surname} ${b.firstname}`,
            "fi",
          );
        }),
      }))
      .sort((a, b) => a.competitionName.localeCompare(b.competitionName, "fi"));
  }, [resultsQuery.data]);

  const totalRows = resultsQuery.data?.length ?? 0;
  const athleteCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of resultsQuery.data ?? []) set.add(r.athlete_key);
    return set.size;
  }, [resultsQuery.data]);

  return (
    <section className="mb-4 rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Building2 className="h-4 w-4 text-primary" />
        <h2 className="flex-1 text-sm font-bold">
          {isToday
            ? `Seuran urheilijat tänään${showExcludeLabel ? " muissa kisoissa" : ""}`
            : `Seuran urheilijoiden suorituksia${showExcludeLabel ? " muissa kisoissa" : ""}`}
        </h2>
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:flex-1">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={orgId ?? ""}
                onChange={(e) =>
                  setOrgId(e.target.value ? parseInt(e.target.value, 10) : null)
                }
                className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Valitse seura"
                disabled={clubs.length === 0}
              >
                <option value="">
                  {isLoadingClubs
                    ? "Ladataan seuroja…"
                    : clubs.length === 0
                      ? (isToday ? "Ei seuroja tänään" : "Ei seuroja päivälle")
                      : `Valitse seura (${clubs.length})`}
                </option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.athletes})
                  </option>
                ))}
              </select>
            </div>
            <div className="relative sm:w-44">
              <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={dateYmd}
                max={helsinkiTodayYmd()}
                onChange={(e) => setDateYmd(e.target.value || helsinkiTodayYmd())}
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Valitse päivämäärä"
              />
            </div>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDateYmd(helsinkiTodayYmd())}
              className="mb-3 text-xs text-primary hover:underline"
            >
              Palaa tähän päivään
            </button>
          )}

          {orgId == null ? (
            <p className="text-xs text-muted-foreground">
              Valitse seura yltä, niin näet sen urheilijoiden päivän tulokset.
            </p>
          ) : resultsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Ladataan…</p>
          ) : grouped.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {isToday ? "Ei vielä tuloksia valitusta seurasta tänään." : "Ei tuloksia valitusta seurasta tältä päivältä."}
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-muted-foreground">
                {athleteCount} {athleteCount === 1 ? "urheilija" : "urheilijaa"} ·{" "}
                {totalRows} {totalRows === 1 ? "tulos" : "tulosta"} ·{" "}
                {grouped.length}{" "}
                {grouped.length === 1 ? "kilpailu" : "kilpailua"}
              </p>
              <div className="space-y-3">
                {grouped.map((g) => (
                  <div key={g.competitionId}>
                    <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {g.competitionName || `Kisa #${g.competitionId}`}
                    </h3>
                    <ul className="divide-y divide-border rounded-lg border bg-background/50">
                      {g.rows.map((r, idx) => {
                        const pb = pbs[`${r.athlete_key}|${normalizeEventName(r.event_name)}`];
                        return (
                          <li
                            key={`${r.athlete_key}-${r.event_name}-${idx}`}
                            className="flex items-baseline gap-3 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                <Link
                                  to="/athlete/$key"
                                  params={{ key: r.athlete_key }}
                                  className="hover:underline"
                                >
                                  {r.surname} {r.firstname}
                                </Link>
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {r.event_name}
                                {r.age_class && ` · ${r.age_class}`}
                                {r.result_rank != null && r.result_round_name
                                  ? ` · ${r.result_round_name} sija ${r.result_rank}`
                                  : r.result_rank != null
                                    ? ` · sija ${r.result_rank}`
                                    : null}
                                {pb && ` · PB ${pb.text}`}
                              </p>
                            </div>
                            {r.was_pb && (
                              <span
                                title="Henkilökohtainen ennätys"
                                className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary"
                              >
                                <Trophy className="h-2.5 w-2.5" />
                                PB
                              </span>
                            )}
                            <span
                              className={`shrink-0 text-base font-bold tabular-nums ${
                                r.was_pb ? "text-primary" : ""
                              }`}
                            >
                              {r.result_text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
