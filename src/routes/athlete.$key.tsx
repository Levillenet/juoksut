import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getTeammateLabels } from "@/lib/teams.functions";
import {
  ArrowLeft,
  Award,
  Calendar,
  MapPin,
  Trophy,
  Activity,
  StickyNote,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

import { RequireRole } from "@/components/RequireRole";
import { ShareAthleteButton } from "@/components/ShareAthleteButton";
import { EventGroupView } from "@/components/RecordsPanel";
import { AthleteAnalytics } from "@/components/AthleteAnalytics";
import { ResultVideoButton } from "@/components/ResultVideoButton";
import { AthleteNoteEditor as NoteEditor } from "@/components/AthleteNoteEditor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  fetchStoredHistory,
  groupByEvent,
  isIndoorResult,
  isLowerBetter,
  type AthleteResultRow,
} from "@/lib/athlete-history";
import {
  competitionScopeKey,
  eventScopeKey,
  fetchNotesForAthlete,
  noteKey,
  noteScopeOf,
  placeholderForCompetition,
  placeholderForEvent,
  placeholderForEventOverall,
  upsertNote,
  type AthleteNote,
} from "@/lib/athlete-notes";
import {
  fetchVideosForAthlete,
  videoKey,
  type ResultVideo,
} from "@/lib/result-videos";
import { loadAthleteSeasonTopFlags, type SeasonTopFlag } from "@/lib/season-top";

export const Route = createFileRoute("/athlete/$key")({
  head: ({ params }) => ({
    meta: [
      { title: `Urheilijan dashboard – ${decodeURIComponent(params.key)}` },
      {
        name: "description",
        content: "Urheilijan kaikki tulokset, ennätykset ja kilpailut.",
      },
    ],
  }),
  component: () => (
    <RequireRole allow={["user"]}>
      <AthletePage />
    </RequireRole>
  ),
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

function AthletePage() {
  const { key } = Route.useParams();
  const router = useRouter();
  const { user } = useAuth();
  const myUserId = user?.id ?? "";
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/watch" });
    }
  };

  const query = useQuery({
    queryKey: ["athlete-dashboard", key],
    queryFn: () => fetchStoredHistory([key]),
  });

  const notesQuery = useQuery({
    queryKey: ["athlete-notes", key],
    queryFn: () => fetchNotesForAthlete(key),
  });

  const videosQuery = useQuery({
    queryKey: ["athlete-videos", key],
    queryFn: () => fetchVideosForAthlete(key),
  });

  const fetchLabels = useServerFn(getTeammateLabels);
  const otherUserIds = useMemo(() => {
    const set = new Set<string>();
    for (const list of notesQuery.data?.values() ?? []) {
      for (const n of list) if (n.user_id !== myUserId) set.add(n.user_id);
    }
    return Array.from(set);
  }, [notesQuery.data, myUserId]);

  const labelsQuery = useQuery({
    queryKey: ["teammate-labels", otherUserIds.sort().join(",")],
    queryFn: () => fetchLabels({ data: { userIds: otherUserIds } }),
    enabled: otherUserIds.length > 0,
    staleTime: 5 * 60_000,
  });
  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of labelsQuery.data?.labels ?? []) m.set(l.userId, l.label);
    return m;
  }, [labelsQuery.data]);

  const rows: AthleteResultRow[] = query.data ?? [];

  const seasonTopQuery = useQuery({
    queryKey: ["athlete-season-top", key, rows.length],
    queryFn: () => loadAthleteSeasonTopFlags(rows),
    enabled: rows.length > 0,
    staleTime: 60_000,
  });
  const seasonTop = seasonTopQuery.data ?? new Map<string, SeasonTopFlag>();

  const meta = useMemo(() => {
    if (rows.length === 0) return null;
    // Take most recent row's identity
    const sorted = [...rows].sort((a, b) =>
      (b.competition_date ?? "").localeCompare(a.competition_date ?? ""),
    );
    return {
      surname: sorted[0].surname,
      firstname: sorted[0].firstname,
      organization: sorted[0].organization,
    };
  }, [rows]);

  const trackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (trackedRef.current === key) return;
    trackedRef.current = key;
    const name = meta ? `${meta.firstname} ${meta.surname}`.trim() : null;
    trackEvent("athlete_view", {
      metadata: {
        athlete_key: key,
        athlete_name: name,
        organization: meta?.organization ?? null,
      },
    });
  }, [key, meta]);

  const groups = useMemo(() => groupByEvent(rows), [rows]);

  // Group competitions
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
      if (c) {
        c.results.push(r);
      } else {
        map.set(r.competition_id, {
          id: r.competition_id,
          name: r.competition_name,
          date: r.competition_date,
          location: r.location,
          results: [r],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (b.date ?? "").localeCompare(a.date ?? ""),
    );
  }, [rows]);

  // Headline stats
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

  // Determine top PBs by event (just the PB row from each group)
  const allPbs = groups
    .map((g) => ({ pb: g.pb, pbIndoor: g.pbIndoor, pbOutdoor: g.pbOutdoor }))
    .filter((g): g is { pb: AthleteResultRow; pbIndoor: AthleteResultRow | null; pbOutdoor: AthleteResultRow | null } => g.pb != null);

  // Kauden kärkitulokset ryhmiteltynä lajeittain (uusin ensin per laji)
  const seasonLeaderships = useMemo(() => {
    interface Item {
      row: AthleteResultRow;
      flag: SeasonTopFlag;
    }
    const map = new Map<string, Item[]>();
    for (const r of rows) {
      const flag = seasonTop.get(r.id);
      if (!flag || !flag.wasLeader) continue;
      const k = `${r.event_name}|${r.age_class ?? ""}|${flag.season}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push({ row: r, flag });
    }
    return Array.from(map.entries())
      .map(([k, items]) => {
        items.sort((a, b) =>
          (b.row.competition_date ?? "").localeCompare(a.row.competition_date ?? ""),
        );
        return { key: k, items };
      })
      .sort((a, b) => {
        const da = a.items[0]?.row.competition_date ?? "";
        const db = b.items[0]?.row.competition_date ?? "";
        return db.localeCompare(da);
      });
  }, [rows, seasonTop]);

  const seasonLeadershipsCount = seasonLeaderships.reduce(
    (n, g) => n + g.items.length,
    0,
  );

  const [allNotesOpen, setAllNotesOpen] = useState(false);

  // Group existing notes; bucket by scope + event (event scope + result scope
  // group under the event name; competition scope goes in its own bucket).
  const notesByEvent = useMemo(() => {
    const notes = notesQuery.data;
    if (!notes || notes.size === 0) return [] as Array<{
      eventName: string;
      items: Array<{
        note: AthleteNote;
        competitionName: string;
        competitionDate: string | null;
        location: string;
        scope: "result" | "event" | "competition";
      }>;
    }>;
    // Lookups from result rows
    const rowLookup = new Map<string, AthleteResultRow>();
    const compLookup = new Map<number, { name: string; date: string | null; location: string }>();
    for (const r of rows) {
      rowLookup.set(
        `${r.competition_id}|${r.event_name}|${r.sub_category ?? ""}`,
        r,
      );
      if (!compLookup.has(r.competition_id)) {
        compLookup.set(r.competition_id, {
          name: r.competition_name,
          date: r.competition_date,
          location: r.location,
        });
      }
    }
    const groupsMap = new Map<
      string,
      Array<{
        note: AthleteNote;
        competitionName: string;
        competitionDate: string | null;
        location: string;
        scope: "result" | "event" | "competition";
      }>
    >();
    for (const noteList of notes.values()) {
      for (const n of noteList) {
        if (!n.note?.trim()) continue;
        const scope = noteScopeOf(n);
        let bucket: string;
        let competitionName = "";
        let competitionDate: string | null = null;
        let location = "";
        if (scope === "competition") {
          bucket = "Kilpailun muistiinpanot";
          const c = compLookup.get(n.competition_id);
          competitionName = c?.name ?? "";
          competitionDate = c?.date ?? null;
          location = c?.location ?? "";
        } else if (scope === "event") {
          bucket = n.event_name;
          competitionName = "Lajitason muistiinpano (kaikki kilpailut)";
        } else {
          bucket = n.event_name;
          const r = rowLookup.get(
            `${n.competition_id}|${n.event_name}|${n.sub_category ?? ""}`,
          );
          competitionName = r?.competition_name ?? "";
          competitionDate = r?.competition_date ?? null;
          location = r?.location ?? "";
        }
        const list = groupsMap.get(bucket) ?? [];
        list.push({ note: n, competitionName, competitionDate, location, scope });
        groupsMap.set(bucket, list);
      }
    }
    return Array.from(groupsMap.entries())
      .map(([eventName, items]) => {
        items.sort((a, b) =>
          (b.competitionDate ?? "").localeCompare(a.competitionDate ?? ""),
        );
        return { eventName, items };
      })
      .sort((a, b) => {
        if (b.items.length !== a.items.length) return b.items.length - a.items.length;
        return a.eventName.localeCompare(b.eventName, "fi");
      });
  }, [notesQuery.data, rows]);

  const totalNotesCount = notesByEvent.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Takaisin"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">
              {meta ? `${meta.surname} ${meta.firstname}` : decodeURIComponent(key)}
            </h1>
            {meta?.organization && (
              <p className="truncate text-xs text-muted-foreground">{meta.organization}</p>
            )}
          </div>
          <ShareAthleteButton
            target={
              meta
                ? {
                    athleteKey: key,
                    surname: meta.surname,
                    firstname: meta.firstname,
                    organization: meta.organization ?? "",
                    organizationId: null,
                  }
                : null
            }
          />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        {query.isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Ladataan…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
            <Activity className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Tälle urheilijalle ei löydy vielä tallennettuja tuloksia.
              Tausta-ajo kerää tuloksia tuloslistalta — tarkista hetken
              kuluttua uudelleen.
            </p>
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <StatCard
                icon={<Activity className="h-4 w-4" />}
                value={stats.results}
                label="Tulosta"
              />
              <StatCard
                icon={<Award className="h-4 w-4" />}
                value={stats.events}
                label="Lajia"
              />
              <StatCard
                icon={<Calendar className="h-4 w-4" />}
                value={stats.competitions}
                label="Kisaa"
              />
              <StatCard
                icon={<Trophy className="h-4 w-4" />}
                value={stats.podiums}
                label="Mitalia"
              />
              <StatCard
                icon={<Trophy className="h-4 w-4 text-primary" />}
                value={stats.wins}
                label="Voittoa"
              />
            </section>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-4 grid w-full grid-cols-2 sm:w-auto">
                <TabsTrigger value="overview">Yhteenveto</TabsTrigger>
                <TabsTrigger value="analytics">Analytiikka</TabsTrigger>
              </TabsList>
              <TabsContent value="analytics" className="mt-0">
                <AthleteAnalytics
                  athleteKey={key}
                  rows={rows}
                  notes={notesQuery.data}
                  videos={videosQuery.data}
                  myUserId={myUserId}
                  labelMap={labelMap}
                />
              </TabsContent>
              <TabsContent value="overview" className="mt-0 space-y-0">

            {/* Top PBs summary */}
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
                          <p className="truncate text-sm font-semibold">
                            {pb.event_name}
                          </p>
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
                        {(pbIndoor || pbOutdoor) && (pbIndoor?.id !== pb.id || pbOutdoor?.id !== pb.id) && (
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                            {pbIndoor && pbIndoor.id !== pb.id && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">
                                Halli-PB
                                <span className="font-semibold tabular-nums">{pbIndoor.result_text}</span>
                              </span>
                            )}
                            {pbOutdoor && pbOutdoor.id !== pb.id && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                                Ulko-PB
                                <span className="font-semibold tabular-nums">{pbOutdoor.result_text}</span>
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

            {/* Kauden kärkitulokset */}
            {seasonLeaderships.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  Kauden kärkitulokset
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    {seasonLeadershipsCount}
                  </span>
                </h2>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Kerrat, jolloin tulos on ollut Suomen kauden ykkönen
                  lajissa+ikäluokassa. Vihreä = edelleen voimassa, keltainen
                  = sittemmin ohitettu.
                </p>
                <ul className="space-y-2">
                  {seasonLeaderships.map((g) => {
                    const head = g.items[0];
                    const stillCurrent = g.items.some((i) => i.flag.isCurrent);
                    return (
                      <li
                        key={g.key}
                        className={`rounded-lg border p-3 ${
                          stillCurrent
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-amber-500/40 bg-amber-500/5"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-semibold">
                            {head.row.event_name}
                            {head.row.age_class && (
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                · {head.row.age_class}
                              </span>
                            )}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              stillCurrent
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {stillCurrent ? "Voimassa" : "Ohitettu"}
                          </span>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs">
                          {g.items.map((it) => (
                            <li
                              key={it.row.id}
                              className="flex items-baseline justify-between gap-2"
                            >
                              <span className="truncate text-muted-foreground">
                                {it.row.competition_name} ·{" "}
                                {fmtDate(it.row.competition_date)}
                              </span>
                              <span className="shrink-0 font-semibold tabular-nums">
                                {it.row.result_text}
                                {it.flag.isCurrent && (
                                  <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                    1.
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {!stillCurrent && head.flag.current && (
                          <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
                            Voimassa oleva kauden 1.:{" "}
                            <span className="font-semibold tabular-nums text-foreground">
                              {head.flag.current.resultText}
                            </span>{" "}
                            – {head.flag.current.firstname}{" "}
                            {head.flag.current.surname}
                            {head.flag.current.competitionDate &&
                              ` (${fmtDate(head.flag.current.competitionDate)})`}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* All notes grouped by event */}
            {totalNotesCount > 0 && (
              <section className="mb-6">
                <button
                  type="button"
                  onClick={() => setAllNotesOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm font-semibold hover:bg-secondary/50"
                >
                  <span className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-primary" />
                    Näytä kaikki muistiinpanot ({totalNotesCount})
                  </span>
                  {allNotesOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {allNotesOpen && (
                  <ul className="mt-2 space-y-3">
                    {notesByEvent.map((g) => (
                      <li key={g.eventName} className="rounded-lg border bg-card p-3">
                        <div className="mb-2 flex items-baseline justify-between gap-2">
                          <h3 className="truncate text-sm font-bold">{g.eventName}</h3>
                          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {g.items.length} kpl
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {g.items.map(({ note, competitionName, competitionDate }) => (
                            <li
                              key={note.id}
                              className="rounded-md border bg-background/50 p-2"
                            >
                              <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                                <span className="min-w-0 truncate">
                                  {competitionName || "—"}
                                  {note.sub_category && (
                                    <span> · {note.sub_category}</span>
                                  )}
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {fmtDate(competitionDate)}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                                {note.note}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Per-event detailed groups with charts */}
            <section className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lajikohtainen kehitys
              </h2>
              <ul className="space-y-3">
                {groups.map((g) => {
                  const all = notesQuery.data?.get(
                    eventScopeKey(g.eventName, g.subCategory ?? ""),
                  ) ?? [];
                  const own = all.find((n) => n.user_id === myUserId) ?? null;
                  const others = all.filter((n) => n.user_id !== myUserId);
                  return (
                    <EventGroupView
                      key={`${g.eventName}|${g.subCategory}`}
                      group={g}
                      rowActions={(row) => {
                        const rowAll = notesQuery.data?.get(
                          noteKey(row.competition_id, row.event_name, row.sub_category ?? ""),
                        ) ?? [];
                        const rowOwn = rowAll.find((n) => n.user_id === myUserId) ?? null;
                        const rowOthers = rowAll.filter((n) => n.user_id !== myUserId);
                        const vids =
                          videosQuery.data?.get(
                            videoKey(row.competition_id, row.event_name, row.sub_category ?? ""),
                          ) ?? [];
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <ResultVideoButton
                                athleteKey={key}
                                competitionId={row.competition_id}
                                eventName={row.event_name}
                                subCategory={row.sub_category ?? ""}
                                videos={vids}
                                contextLabel={`${row.event_name} · ${row.competition_name}`}
                                size="sm"
                              />
                            </div>
                            <NoteEditor
                              athleteKey={key}
                              competitionId={row.competition_id}
                              eventName={row.event_name}
                              subCategory={row.sub_category ?? ""}
                              placeholder={placeholderForEvent(row.event_name, row.event_category)}
                              addLabel="Lisää muistiinpano"
                              note={rowOwn}
                              otherNotes={rowOthers}
                              labelMap={labelMap}
                            />
                          </div>
                        );
                      }}
                      footer={
                        <NoteEditor
                          athleteKey={key}
                          competitionId={0}
                          eventName={g.eventName}
                          subCategory={g.subCategory ?? ""}
                          placeholder={placeholderForEventOverall(g.eventName, g.category)}
                          addLabel="Lisää lajitason muistiinpano (tekniikka, kausitavoite)"
                          note={own}
                          otherNotes={others}
                          labelMap={labelMap}
                        />
                      }
                    />
                  );
                })}
              </ul>
            </section>

            {/* Competitions list */}
            <section className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Kilpailut ({competitions.length})
              </h2>
              <ul className="space-y-2">
                {competitions.map((c) => {
                  const compAll = notesQuery.data?.get(competitionScopeKey(c.id)) ?? [];
                  const compOwn = compAll.find((n) => n.user_id === myUserId) ?? null;
                  const compOthers = compAll.filter((n) => n.user_id !== myUserId);
                  return (
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
                      <div className="mb-2">
                        <NoteEditor
                          athleteKey={key}
                          competitionId={c.id}
                          eventName=""
                          subCategory=""
                          placeholder={placeholderForCompetition()}
                          addLabel="Lisää kilpailun muistiinpano (olosuhteet, matka, tunnelma)"
                          note={compOwn}
                          otherNotes={compOthers}
                          labelMap={labelMap}
                        />
                      </div>
                      <ul className="divide-y divide-border text-xs">
                        {c.results.map((r) => {
                          const all = notesQuery.data?.get(
                            noteKey(r.competition_id, r.event_name, r.sub_category ?? ""),
                          ) ?? [];
                          const own = all.find((n) => n.user_id === myUserId) ?? null;
                          const others = all.filter((n) => n.user_id !== myUserId);
                          const vids =
                            videosQuery.data?.get(
                              videoKey(r.competition_id, r.event_name, r.sub_category ?? ""),
                            ) ?? [];
                          return (
                            <CompetitionResultRow
                              key={r.id}
                              row={r}
                              athleteKey={key}
                              note={own}
                              otherNotes={others}
                              labelMap={labelMap}
                              seasonTop={seasonTop.get(r.id) ?? null}
                              videos={vids}
                            />
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </section>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

function CompetitionResultRow({
  row,
  athleteKey,
  note,
  otherNotes = [],
  labelMap,
  seasonTop,
  videos = [],
}: {
  row: AthleteResultRow;
  athleteKey: string;
  note: AthleteNote | null;
  otherNotes?: AthleteNote[];
  labelMap?: Map<string, string>;
  seasonTop: SeasonTopFlag | null;
  videos?: ResultVideo[];
}) {
  return (
    <li className="py-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate">
          {row.event_name}
          {row.sub_category && (
            <span className="text-muted-foreground"> · {row.sub_category}</span>
          )}
        </span>
        <span
          className={`shrink-0 inline-flex items-center gap-1 tabular-nums font-semibold ${
            row.was_pb ? "text-primary" : ""
          }`}
        >
          {row.result_rank === 1 && (
            <Trophy
              aria-label="Lajivoitto"
              className="h-3.5 w-3.5 text-yellow-500"
              fill="currentColor"
            />
          )}
          {row.result_text}
          {row.was_pb && (
            <span
              title="Henkilökohtainen ennätys"
              className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary"
            >
              <Trophy className="h-2.5 w-2.5" />
              PB
            </span>
          )}
          {row.result_rank != null && (
            <span className="font-normal text-muted-foreground">
              ({row.result_rank}.)
            </span>
          )}
          {seasonTop && <SeasonTopBadge flag={seasonTop} />}
          <ResultVideoButton
            athleteKey={athleteKey}
            competitionId={row.competition_id}
            eventName={row.event_name}
            subCategory={row.sub_category ?? ""}
            videos={videos}
            contextLabel={`${row.event_name} · ${row.competition_name}`}
          />
        </span>
      </div>
      <NoteEditor
        athleteKey={athleteKey}
        competitionId={row.competition_id}
        eventName={row.event_name}
        subCategory={row.sub_category ?? ""}
        placeholder={placeholderForEvent(row.event_name, row.event_category)}
        addLabel="Lisää muistiinpano (esim. askelmerkki)"
        note={note}
        otherNotes={otherNotes}
        labelMap={labelMap}
      />
    </li>
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
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function SeasonTopBadge({ flag }: { flag: SeasonTopFlag }) {
  if (flag.isCurrent) {
    return (
      <span
        title={`Kauden voimassa oleva ykkönen (${flag.season === "indoor" ? "halli" : "ulko"})`}
        className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
      >
        <Trophy className="h-2.5 w-2.5" />
        Kauden 1.
      </span>
    );
  }
  if (flag.wasLeader) {
    const cur = flag.current;
    const curName = cur ? `${cur.firstname} ${cur.surname}`.trim() : "";
    return (
      <span
        title={
          cur
            ? `Oli kauden ykkönen tuolloin. Nyt 1.: ${cur.resultText} – ${curName}`
            : "Oli kauden ykkönen tuolloin"
        }
        className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300"
      >
        <Trophy className="h-2.5 w-2.5" />
        Oli 1.
        {cur && (
          <span className="font-normal normal-case tracking-normal opacity-80">
            · nyt {cur.resultText} {curName}
          </span>
        )}
      </span>
    );
  }
  return null;
}

