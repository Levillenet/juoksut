import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Wind } from "lucide-react";

import { formatTime, STATUS_LABEL, type Heat } from "@/lib/tuloslista";
import { RecordBadge } from "@/lib/records";
import { effectiveRecord } from "@/lib/record-baseline";
import {
  eventDetailsQueryOptions,
  eventDetailsKey,
} from "@/lib/tuloslista-queries";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/round/$eventId/$roundId")({
  head: () => ({
    meta: [{ title: "Erän lähtöjärjestys" }],
  }),
  component: RoundView,
});

function RoundView() {
  const { eventId, roundId } = Route.useParams();
  const router = useRouter();
  const [competitionId] = useCompetitionId();
  const queryClient = useQueryClient();

  const eid = parseInt(eventId, 10);
  const detailQuery = useQuery(eventDetailsQueryOptions(competitionId, eid));
  const data = detailQuery.data ?? null;
  const loading = detailQuery.isFetching;
  const error = detailQuery.error
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : "Tuntematon virhe"
    : null;

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: eventDetailsKey(competitionId, eid) });
  };

  const round = useMemo(
    () => data?.Rounds.find((r) => r.Id === parseInt(roundId, 10)) ?? data?.Rounds[0],
    [data, roundId],
  );

  const heats: Heat[] = useMemo(() => {
    const hs = round?.Heats ?? [];
    return [...hs].sort((a, b) => a.Index - b.Index);
  }, [round]);

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
              {data?.Name ?? "Laji"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {round
                ? `${round.Name} · ${formatTime(round.BeginDateTimeWithTZ)} · ${STATUS_LABEL[round.Status]}`
                : "Ladataan…"}
            </p>
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

        {data && heats.length === 0 && (
          <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Eräjakoja ei ole vielä tehty.
            <div className="mt-3">
              <Link to="/" className="text-primary underline">
                Takaisin listaan
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {heats.map((heat) => {
            const allocs = [...heat.Allocations].sort((a, b) => a.Position - b.Position);
            return (
              <section
                key={heat.Id}
                className="overflow-hidden rounded-xl border bg-card shadow-sm"
              >
                <div className="flex items-center justify-between border-b bg-secondary px-4 py-2">
                  <h2 className="text-sm font-semibold">
                    Erä {heat.Index}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({allocs.length} kilpailijaa)
                    </span>
                  </h2>
                  {heat.Wind != null && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wind className="h-3 w-3" />
                      {heat.Wind} m/s
                    </span>
                  )}
                </div>
                <ol className="divide-y">
                  {allocs.map((a) => (
                    <li
                      key={a.AllocId}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-bold tabular-nums text-primary-foreground">
                        {a.Position}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium leading-tight">
                          {a.Name}
                          {a.NotInCompetition && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                              ei lisenssiä?
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.Organization?.Name ?? a.Organization?.NameShort ?? ""}
                        </p>
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
                              const eff = effectiveRecord(parseInt(eventId, 10), a);
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
                            {a.SB && <div>SB {a.SB}</div>}
                            {!a.SB && a.PB && <div>PB {a.PB}</div>}
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
