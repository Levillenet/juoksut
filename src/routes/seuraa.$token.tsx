import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Trophy } from "lucide-react";

import logo from "@/assets/lahden-ahkera-logo.png";
import { Button } from "@/components/ui/button";
import {
  formatTime,
  helsinkiDateKey,
  isRunningEvent,
  STATUS_LABEL,
} from "@/lib/tuloslista";
import {
  competitionIndexQueryOptions,
  competitionIndexKey,
  type IndexedEntry,
} from "@/lib/tuloslista-queries";
import { loadSharedWatch, type SharedWatchAthlete } from "@/lib/watch-share";
import { RecordBadge } from "@/lib/records";
import { effectiveRecord } from "@/lib/record-baseline";
import { useSharedHistoryBaseline } from "@/lib/history-baseline";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/seuraa/$token")({
  head: () => {
    const title = "Seuraa kilpailupäivän etenemistä";
    const description =
      "Jaettu kilpailijaseuranta — näe reaaliajassa miten päivä etenee.";
    const image =
      "https://rqhlwjggotpbwfvvxlox.supabase.co/storage/v1/object/public/public-assets/lahden-ahkera-logo.png";
    return {
      meta: [
        { title },
        { name: "robots", content: "noindex" },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: SharedWatchPage,
});

const STATUS_STYLE: Record<"Unallocated" | "Allocated" | "Progress" | "Official", string> = {
  Unallocated: "bg-muted text-muted-foreground",
  Allocated: "bg-accent text-accent-foreground",
  Progress: "bg-primary text-primary-foreground",
  Official: "bg-foreground text-background",
};

function SharedWatchPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();

  const shareQuery = useQuery({
    queryKey: ["shared-watch", token],
    queryFn: () => loadSharedWatch(token),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  const competitionId = shareQuery.data?.competitionId ?? null;
  const athletes: SharedWatchAthlete[] = shareQuery.data?.athletes ?? [];
  const ownerLabel = shareQuery.data?.ownerLabel ?? "";

  const indexQuery = useQuery({
    ...competitionIndexQueryOptions(competitionId ?? 0),
    enabled: competitionId != null && !shareQuery.data?.revoked && !shareQuery.data?.notFound,
  });

  const index: IndexedEntry[] | null = indexQuery.data?.entries ?? null;
  const competitionName = indexQuery.data?.name ?? "";
  const updatedAt = indexQuery.dataUpdatedAt
    ? new Date(indexQuery.dataUpdatedAt)
    : null;

  const watchedSections = useMemo(() => {
    if (!index) return [];
    return athletes.map((w) => {
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
  }, [index, athletes]);

  useSharedHistoryBaseline(token, competitionId ?? null);

  const reload = () => {
    if (competitionId != null) {
      queryClient.invalidateQueries({ queryKey: competitionIndexKey(competitionId) });
    }
    queryClient.invalidateQueries({ queryKey: ["shared-watch", token] });
  };

  if (shareQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <p className="text-sm">Ladataan jakolinkkiä…</p>
      </div>
    );
  }

  if (shareQuery.data?.notFound) {
    return (
      <CenterMessage
        title="Linkkiä ei löydy"
        body="Tämä jakolinkki ei ole voimassa. Pyydä jakajalta uusi linkki."
      />
    );
  }

  if (shareQuery.data?.revoked) {
    return (
      <CenterMessage
        title="Jakolinkki poistettu"
        body={`${ownerLabel || "Jakaja"} on poistanut tämän jakolinkin.`}
      />
    );
  }

  const loading = indexQuery.isFetching;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Etusivulle">
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
              {competitionName || `Kisa #${competitionId ?? ""}`}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {ownerLabel ? `${ownerLabel}n seuranta` : "Jaettu seuranta"}
              {updatedAt && ` · päivitetty ${formatClock(updatedAt)}`}
            </p>
          </div>
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
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {indexQuery.error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Tietojen lataus epäonnistui.
          </div>
        )}

        {athletes.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
            <Trophy className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Jakajalla ei ole vielä yhtään urheilijaa seurannassa.
            </p>
          </div>
        ) : !index ? (
          <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
            Ladataan kilpailutietoja…
          </p>
        ) : (
          <ul className="space-y-4">
            {watchedSections.map(({ athlete, entries }) => (
              <li key={athlete.key} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 min-w-0">
                  <p className="truncate text-base font-bold leading-tight">
                    {athlete.surname} {athlete.firstname}
                  </p>
                  {athlete.organization && (
                    <p className="truncate text-xs text-muted-foreground">
                      {athlete.organization}
                    </p>
                  )}
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
                                {e.round.Name}
                                {e.fromEnrollment
                                  ? `${e.round.Name ? " · " : ""}Eräjako tekemättä`
                                  : (
                                    <>
                                      {isRun && `${e.round.Name ? " · " : ""}Erä ${e.heatIndex}`}
                                      {e.alloc.Position
                                        ? isRun
                                          ? ` · Rata ${e.alloc.Position}`
                                          : ` · Järj. ${e.alloc.Position}`
                                        : ""}
                                    </>
                                  )}
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
                                  {competitionId != null && (
                                    <div className="mt-1 flex justify-end">
                                      {(() => {
                                        const eff = effectiveRecord(e.round.EventId, e.alloc, {
                                          competitionId,
                                          athleteKey: athlete.key,
                                          eventName: e.round.EventName,
                                          ageClass: e.round.GroupName,
                                          category: e.round.Category,
                                        });
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
                                  )}
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

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Jaettu kilpailijaseuranta · päivittyy automaattisesti minuutin välein
        </p>
      </main>
    </div>
  );
}

function CenterMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <Button asChild variant="outline">
          <Link to="/">Etusivulle</Link>
        </Button>
      </div>
    </div>
  );
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
