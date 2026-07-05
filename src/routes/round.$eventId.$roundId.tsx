import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Wind } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchHeatVideos, heatAthleteKey, type ResultVideo } from "@/lib/result-videos";
import { ResultVideoButton } from "@/components/ResultVideoButton";


import { formatRelayLegs, formatTime, STATUS_LABEL, type Heat, type Allocation, type Enrollment } from "@/lib/tuloslista";
import { RecordBadge } from "@/lib/records";
import { effectiveRecord } from "@/lib/record-baseline";
import { useHistoryBaseline } from "@/lib/history-baseline";
import {
  eventDetailsQueryOptions,
  eventDetailsKey,
} from "@/lib/tuloslista-queries";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";
import { athleteKey } from "@/lib/watch-store";
import { ConfirmedDot } from "@/components/ConfirmedDot";
import { decodeGroupParam } from "@/lib/round-grouping";

export const Route = createFileRoute("/round/$eventId/$roundId")({
  validateSearch: (search: Record<string, unknown>): { group?: string } => ({
    group: typeof search.group === "string" ? search.group : undefined,
  }),
  head: () => ({
    meta: [{ title: "Erän lähtöjärjestys" }],
  }),
  component: RoundView,
});


type AllocWithMeta = Allocation & { _series?: string; _eventId: number };
type EnrollmentWithMeta = Enrollment & { _series?: string; _eventId: number };

function extractAgeLabel(name: string): string | undefined {
  const m = name.match(/\b([WMNTP]\d{2,3})\b/i);
  return m ? m[1].toUpperCase() : undefined;
}


function RoundView() {
  const { eventId, roundId } = Route.useParams();
  const { group: groupParam } = Route.useSearch();
  const router = useRouter();
  const [competitionId] = useCompetitionId();
  const queryClient = useQueryClient();
  useHistoryBaseline(competitionId);

  const eid = parseInt(eventId, 10);
  const groupPairs = useMemo(() => {
    const pairs = decodeGroupParam(groupParam);
    if (pairs.length > 0) return pairs;
    return [{ eventId: eid, roundId: parseInt(roundId, 10) }];
  }, [groupParam, eid, roundId]);

  const uniqueEventIds = useMemo(
    () => Array.from(new Set(groupPairs.map((p) => p.eventId))),
    [groupPairs],
  );

  const eventQueries = useQueries({
    queries: uniqueEventIds.map((id) => eventDetailsQueryOptions(competitionId, id)),
  });

  const primaryIdx = uniqueEventIds.indexOf(eid);
  const primaryQuery = primaryIdx >= 0 ? eventQueries[primaryIdx] : eventQueries[0];
  const data = primaryQuery?.data ?? null;
  const loading = eventQueries.some((q) => q.isFetching);
  const error = (() => {
    const e = eventQueries.find((q) => q.error)?.error;
    if (!e) return null;
    return e instanceof Error ? e.message : "Tuntematon virhe";
  })();

  const reload = () => {
    for (const id of uniqueEventIds) {
      queryClient.invalidateQueries({ queryKey: eventDetailsKey(competitionId, id) });
    }
  };

  const isGrouped = groupPairs.length > 1;

  /** Yhdistetyt roundit + niiden allocations/enrollments. */
  const merged = useMemo(() => {
    const enrollments: EnrollmentWithMeta[] = [];
    const heatMap = new Map<number, AllocWithMeta[]>();
    const heatMeta = new Map<number, { Id: number; Wind: number | null }>();
    let primaryRound: import("@/lib/tuloslista").RoundDetailRound | null = null;
    for (const pair of groupPairs) {
      const qIdx = uniqueEventIds.indexOf(pair.eventId);
      const ev = qIdx >= 0 ? eventQueries[qIdx]?.data ?? null : null;
      if (!ev) continue;
      const r = ev.Rounds.find((x) => x.Id === pair.roundId);
      if (!r) continue;
      if (pair.eventId === eid && pair.roundId === parseInt(roundId, 10)) {
        primaryRound = r;
      }
      const label = isGrouped ? extractAgeLabel(ev.Name) || ev.Name : undefined;

      for (const h of r.Heats) {
        const cur = heatMap.get(h.Index) ?? [];
        for (const a of h.Allocations) {
          cur.push({ ...a, _series: label, _eventId: pair.eventId });
        }
        heatMap.set(h.Index, cur);
        if (!heatMeta.has(h.Index)) {
          heatMeta.set(h.Index, { Id: h.Id, Wind: h.Wind });
        }
      }
      if (ev.Enrollments && ev.Enrollments.length > 0) {
        for (const e of ev.Enrollments) {
          enrollments.push({ ...e, _series: label, _eventId: pair.eventId });
        }
      }
    }
    const heats = Array.from(heatMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([Index, allocs]) => {
        const meta = heatMeta.get(Index)!;
        return {
          Id: meta.Id,
          Index,
          Wind: meta.Wind,
          Allocations: allocs.sort((a, b) => a.Position - b.Position),
        } as Heat & { Allocations: AllocWithMeta[] };
      });
    return { heats, enrollments, primaryRound };
  }, [groupPairs, uniqueEventIds, eventQueries, eid, roundId, isGrouped]);

  const round = isGrouped
    ? merged.primaryRound
    : data?.Rounds.find((r) => r.Id === parseInt(roundId, 10)) ?? data?.Rounds[0];

  const heats = merged.heats;

  const overall = useMemo(() => {
    const all = heats.flatMap((h) =>
      h.Allocations.map((a) => ({ ...(a as AllocWithMeta), _heatIndex: h.Index })),
    );
    const ranked = all.filter((a) => a.Result && a.ResultRank != null);
    if (ranked.length === 0) return [];
    return ranked.sort((a, b) => (a.ResultRank ?? 0) - (b.ResultRank ?? 0));
  }, [heats]);

  const eventName = data?.Name ?? "";
  const allAthleteKeys = useMemo(() => {
    const set = new Set<string>();
    for (const h of heats) {
      for (const a of h.Allocations) {
        set.add(athleteKey(a.Surname, a.Firstname, a.Organization?.Id ?? null));
      }
    }
    return Array.from(set);
  }, [heats]);

  const eventCategory = data?.EventCategory ?? null;
  const isTrack = eventCategory === "Track" || eventCategory === "Relay";
  const heatIds = useMemo(() => heats.map((h) => h.Id), [heats]);

  const videosQuery = useQuery({
    queryKey: ["round-videos", competitionId, eventName, allAthleteKeys.slice().sort().join(",")],
    queryFn: async () => {
      if (allAthleteKeys.length === 0 || !eventName) return new Map<string, ResultVideo[]>();
      const { data, error } = await supabase
        .from("result_videos")
        .select("id, user_id, athlete_key, competition_id, event_name, sub_category, youtube_url, youtube_video_id, is_public, event_category, heat_key, updated_at")
        .eq("competition_id", competitionId)
        .eq("event_name", eventName)
        .in("athlete_key", allAthleteKeys);
      if (error) throw error;
      const map = new Map<string, ResultVideo[]>();
      for (const v of (data ?? []) as ResultVideo[]) {
        const list = map.get(v.athlete_key) ?? [];
        list.push(v);
        map.set(v.athlete_key, list);
      }
      return map;
    },
    enabled: allAthleteKeys.length > 0 && !!eventName && !isTrack,
    staleTime: 30_000,
  });
  const videosByAthlete = videosQuery.data ?? new Map<string, ResultVideo[]>();

  const heatVideosQuery = useQuery({
    queryKey: ["heat-videos", competitionId, heatIds.slice().sort().join(",")],
    queryFn: () => fetchHeatVideos(competitionId, heatIds),
    enabled: isTrack && heatIds.length > 0,
    staleTime: 30_000,
  });
  const heatVideos = heatVideosQuery.data ?? new Map<string, ResultVideo[]>();






  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sig = `${competitionId}:${eventId}:${roundId}`;
    if (trackedRef.current === sig) return;
    trackedRef.current = sig;
    trackEvent("round_view", {
      metadata: {
        competition_id: competitionId,
        event_id: eid,
        event_name: data?.Name ?? null,
        round_id: parseInt(roundId, 10),
        round_name: round?.Name ?? null,
      },
    });
  }, [competitionId, eventId, roundId, eid, data?.Name, round?.Name]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.history.back()}
            aria-label="Takaisin"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              {isGrouped ? (data?.Name ? data.Name.replace(/\s*\b[WMNTP]\d{2,3}\b\s*/i, " ").replace(/\s{2,}/g, " ").trim() : "Laji") : (data?.Name ?? "Laji")}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {round
                ? `${round.Name} · ${formatTime(round.BeginDateTimeWithTZ)} · ${STATUS_LABEL[round.Status]}`
                : "Ladataan…"}
            </p>
            {isGrouped && (
              <p className="truncate text-[11px] text-muted-foreground">
                Niputettu {groupPairs.length} sarjaa
              </p>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={reload} disabled={loading} aria-label="Päivitä">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="py-12 text-center text-sm text-muted-foreground">Ladataan…</div>
        )}

        {data && heats.length === 0 && (() => {
          const sourceEnrollments: EnrollmentWithMeta[] = isGrouped
            ? merged.enrollments
            : (data.Enrollments ?? []).map((e) => ({ ...e, _eventId: eid }));
          const enrollments = [...sourceEnrollments].sort((a, b) =>
            a.Surname.localeCompare(b.Surname, "fi") ||
            a.Firstname.localeCompare(b.Firstname, "fi"),
          );

          if (enrollments.length === 0) {
            return (
              <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Eräjakoja ei ole vielä tehty.
                <div className="mt-3">
                  <Link to="/" className="text-primary underline">
                    Takaisin listaan
                  </Link>
                </div>
              </div>
            );
          }
          return (
            <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b bg-secondary px-4 py-2">
                <h2 className="text-sm font-semibold">
                  Ilmoittautuneet{" "}
                  <span className="font-normal text-muted-foreground">
                    ({enrollments.length})
                  </span>
                </h2>
                <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                  <span>Eräjakoja ei ole vielä tehty</span>
                  <span className="inline-flex items-center">
                    Urheilija varmistanut
                    <ConfirmedDot confirmed className="ml-1.5" />
                  </span>
                </div>
              </div>
              <ol className="divide-y">
                {enrollments.map((e, i) => (
                  <li key={e.Id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">
                        <Link
                          to="/athlete/$key"
                          params={{
                            key: athleteKey(e.Surname, e.Firstname, e.Organization?.Id ?? null),
                          }}
                          className="hover:underline"
                        >
                          {e.Name}
                        </Link>
                        <ConfirmedDot confirmed={e.Confirmed} className="ml-2 align-middle" />
                        {e._series && (
                          <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground">
                            {e._series}
                          </span>
                        )}

                        {e.NotInCompetition && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                            ei lisenssiä?
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.Organization?.Name ?? e.Organization?.NameShort ?? ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs tabular-nums text-muted-foreground">
                      {e.Number && <div>#{e.Number}</div>}
                      {(() => {
                        const eff = effectiveRecord(e._eventId ?? eid, e, {
                          competitionId,
                          athleteKey: athleteKey(e.Surname, e.Firstname, e.Organization?.Id ?? null),
                          eventName: data?.Name ?? "",
                          ageClass: data?.Group ?? null,
                          category: data?.EventCategory ?? null,
                        });
                        return (
                          <>
                            {eff.sb && <div>SB {eff.sb}</div>}
                            {eff.pb && <div>PB {eff.pb}</div>}
                          </>
                        );
                      })()}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })()}

        <LayoutGroup>
          <div className="space-y-4">
            {heats.length > 0 && heats.some((h) => h.Allocations.some((a) => !a.Result)) && (
              <div className="flex justify-end text-xs text-muted-foreground">
                <span className="inline-flex items-center">
                  Urheilija varmistanut
                  <ConfirmedDot confirmed className="ml-1.5" />
                </span>
              </div>
            )}
            {heats.map((heat) => {
              const allocs = [...heat.Allocations].sort((a, b) => a.Position - b.Position);
              return (
                <section
                  key={heat.Id}
                  className="overflow-hidden rounded-xl border bg-card shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 border-b bg-secondary px-4 py-2">
                    <h2 className="text-sm font-semibold">
                      Erä {heat.Index}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({allocs.length} kilpailijaa)
                      </span>
                    </h2>
                    <div className="flex items-center gap-2">
                      {heat.Wind != null && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Wind className="h-3 w-3" />
                          {heat.Wind} m/s
                        </span>
                      )}
                      {isTrack && (
                        <ResultVideoButton
                          athleteKey={heatAthleteKey(heat.Id)}
                          competitionId={competitionId}
                          eventName={eventName}
                          subCategory={`Erä ${heat.Index}`}
                          eventCategory={eventCategory}
                          heatKey={`heat:${heat.Id}`}
                          videos={heatVideos.get(`heat:${heat.Id}`) ?? []}
                          contextLabel={`${eventName} · Erä ${heat.Index}`}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                  <ol className="divide-y">
                    {allocs.map((a) => (
                      <motion.li
                        key={a.AllocId}
                        layout="position"
                        data-alloc-id={`heat-${a.AllocId}`}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-bold tabular-nums text-primary-foreground">
                          {a.Position}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium leading-tight">
                            <Link
                              to="/athlete/$key"
                              params={{
                                key: athleteKey(a.Surname, a.Firstname, a.Organization?.Id ?? null),
                              }}
                              className="hover:underline"
                            >
                              {a.Name}
                            </Link>
                            {!a.Result && (
                              <ConfirmedDot confirmed={a.Confirmed} className="ml-2 align-middle" />
                            )}
                            {(a as AllocWithMeta)._series && (
                              <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground">
                                {(a as AllocWithMeta)._series}
                              </span>
                            )}
                            {a.NotInCompetition && (
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                                ei lisenssiä?
                              </span>
                            )}

                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.Organization?.Name ?? a.Organization?.NameShort ?? ""}
                          </p>
                          {(() => {
                            const legs = formatRelayLegs(a);
                            return legs ? (
                              <p className="truncate text-xs text-muted-foreground">{legs}</p>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs tabular-nums text-muted-foreground">
                          {a.Result ? (
                            <>
                              <div className="flex items-center gap-1">
                                <span className="text-base font-bold tabular-nums text-foreground">
                                  {a.Result}
                                </span>
                                {a.ResultRank != null && (
                                  <span className="text-xs text-muted-foreground">
                                    ({a.ResultRank}.)
                                  </span>
                                )}
                              </div>
                              {(() => {
                                const eff = effectiveRecord(
                                  (a as AllocWithMeta)._eventId ?? parseInt(eventId, 10),
                                  a,
                                  {
                                    competitionId,
                                    athleteKey: athleteKey(
                                      a.Surname,
                                      a.Firstname,
                                      a.Organization?.Id ?? null,
                                    ),
                                    eventName: data?.Name ?? "",
                                    ageClass: data?.Group ?? null,
                                    category: data?.EventCategory ?? null,
                                  },
                                );
                                return (
                                  <RecordBadge
                                    category={data?.EventCategory ?? ""}
                                    result={a.Result}
                                    pb={eff.pb}
                                    sb={eff.sb}
                                    size="sm"
                                  />
                                );
                              })()}

                            </>
                          ) : (
                            <>
                              {a.Number && <div>#{a.Number}</div>}
                              {(() => {
                                const eff = effectiveRecord(
                                  (a as AllocWithMeta)._eventId ?? eid,
                                  a,
                                  {
                                    competitionId,
                                    athleteKey: athleteKey(
                                      a.Surname,
                                      a.Firstname,
                                      a.Organization?.Id ?? null,
                                    ),
                                    eventName: data?.Name ?? "",
                                    ageClass: data?.Group ?? null,
                                    category: data?.EventCategory ?? null,
                                  },
                                );
                                return (
                                  <>
                                    {eff.sb && <div>SB {eff.sb}</div>}
                                    {!eff.sb && eff.pb && <div>PB {eff.pb}</div>}
                                  </>
                                );
                              })()}
                            </>
                          )}
                        </div>
                        {!isTrack && (() => {
                          const key = athleteKey(a.Surname, a.Firstname, a.Organization?.Id ?? null);
                          const vids = videosByAthlete.get(key) ?? [];
                          return (
                            <div className="shrink-0">
                              <ResultVideoButton
                                athleteKey={key}
                                competitionId={competitionId}
                                eventName={eventName}
                                subCategory=""
                                eventCategory={eventCategory}
                                videos={vids}
                                contextLabel={`${eventName} · ${a.Name}`}
                                size="sm"
                              />
                            </div>
                          );
                        })()}
                      </motion.li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>


          {overall.length > 0 && (
            <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="border-b bg-secondary px-4 py-2">
                <h2 className="text-sm font-semibold">
                  {round?.Status === "Official" ? "Lopputulokset" : "Tilanne tällä hetkellä"}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({overall.length} kilpailijaa)
                  </span>
                </h2>
              </div>
              <ol className="divide-y">
                {overall.map((a) => (
                  <motion.li
                    key={a.AllocId}
                    layout
                    data-alloc-id={a.AllocId}
                    className="flex items-center gap-3 px-4 py-3"
                    transition={{ type: "spring", stiffness: 350, damping: 32 }}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-bold tabular-nums text-primary-foreground">
                      {a.ResultRank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">
                        {a.Name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.Organization?.Name ?? a.Organization?.NameShort ?? ""}
                        {" · "}Erä {a._heatIndex}
                      </p>
                      {(() => {
                        const legs = formatRelayLegs(a);
                        return legs ? (
                          <p className="truncate text-xs text-muted-foreground">{legs}</p>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs tabular-nums">
                      <span className="text-base font-bold text-foreground">
                        {a.Result}
                      </span>
                      {(() => {
                        const eff = effectiveRecord(parseInt(eventId, 10), a, {
                          competitionId,
                          athleteKey: athleteKey(
                            a.Surname,
                            a.Firstname,
                            a.Organization?.Id ?? null,
                          ),
                          eventName: data?.Name ?? "",
                          ageClass: data?.Group ?? null,
                          category: data?.EventCategory ?? null,
                        });
                        return (
                          <RecordBadge
                            category={data?.EventCategory ?? ""}
                            result={a.Result!}
                            pb={eff.pb}
                            sb={eff.sb}
                            size="sm"
                          />
                        );
                      })()}
                    </div>
                  </motion.li>
                ))}
              </ol>
            </section>
          )}
        </LayoutGroup>
      </main>
      
    </div>
  );
}

