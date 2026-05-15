import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, RefreshCw, Star, Trophy } from "lucide-react";

import { RequireRole } from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  loadSeasonLeaders,
  type LeaderRow,
} from "@/lib/season-leaders";
import { seasonRange, type SeasonKind } from "@/lib/season-stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/season-leaders")({
  head: () => ({
    meta: [
      { title: "Kauden kärki – Lahden Ahkera" },
      {
        name: "description",
        content:
          "Kauden kärkitulokset ikäluokittain ja lajeittain. Korostaa omassa seurannassa olevat urheilijat.",
      },
    ],
  }),
  component: () => (
    <RequireRole allow={["user", "official"]}>
      <SeasonLeadersPage />
    </RequireRole>
  ),
});

const SEASON_OPTIONS: Array<{ value: SeasonKind; label: string }> = [
  { value: "outdoor", label: "Ulkokausi" },
  { value: "indoor", label: "Hallikausi" },
];

function SeasonLeadersPage() {
  const [season, setSeason] = useState<SeasonKind>("outdoor");
  const [ageClass, setAgeClass] = useState<string | null>(null);
  const [eventKey, setEventKey] = useState<string | null>(null);
  const [showWatched, setShowWatched] = useState(true);

  const range = useMemo(() => seasonRange(season), [season]);

  const query = useQuery({
    queryKey: ["season-leaders", season, ageClass, eventKey],
    queryFn: () =>
      loadSeasonLeaders({ season, ageClass, eventKey, limit: 10 }),
    staleTime: 60_000,
  });

  const data = query.data;

  const effectiveEventKey =
    eventKey ?? (data?.events[0]?.key ?? null);

  const watchedKeySet = useMemo(
    () => new Set((data?.watchedBests ?? []).map((r) => r.athleteKey)),
    [data?.watchedBests],
  );

  // Watched athletes NOT already in top-N (näytetään listan pohjalla)
  const watchedExtra = useMemo(() => {
    if (!data) return [] as LeaderRow[];
    const topKeys = new Set(data.leaders.map((r) => r.athleteKey));
    return data.watchedBests.filter((r) => !topKeys.has(r.athleteKey));
  }, [data]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary"
            aria-label="Takaisin"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-semibold leading-tight">
              Kauden kärki
            </h1>
            <p className="text-xs text-muted-foreground">{range.label}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Päivitä"
          >
            <RefreshCw
              className={cn("h-4 w-4", query.isFetching && "animate-spin")}
            />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <Tabs
          value={season}
          onValueChange={(v) => {
            setSeason(v as SeasonKind);
            setEventKey(null);
            setAgeClass(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            {SEASON_OPTIONS.map((o) => (
              <TabsTrigger key={o.value} value={o.value}>
                {o.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Ikäluokka
            </label>
            <Select
              value={ageClass ?? "__all"}
              onValueChange={(v) => {
                setAgeClass(v === "__all" ? null : v);
                setEventKey(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kaikki" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Kaikki ikäluokat</SelectItem>
                {(data?.ageClasses ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Laji
            </label>
            <Select
              value={effectiveEventKey ?? ""}
              onValueChange={(v) => setEventKey(v)}
              disabled={!data || data.events.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Valitse laji" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(data?.events ?? []).map((e) => (
                  <SelectItem key={e.key} value={e.key}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showWatched}
            onChange={(e) => setShowWatched(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Näytä omat urheilijat (myös listan ulkopuolelta)
        </label>

        {query.isLoading && (
          <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Ladataan…
          </div>
        )}

        {query.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Virhe: {(query.error as Error).message}
          </div>
        )}

        {data && data.events.length === 0 && !query.isLoading && (
          <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Ei kauden tuloksia kannassa valituilla suodattimilla.
          </div>
        )}

        {data && data.leaders.length > 0 && (
          <section className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Trophy className="h-3.5 w-3.5" />
              Top {data.leaders.length}
            </div>
            <ul className="divide-y">
              {data.leaders.map((r, i) => (
                <LeaderItem
                  key={r.athleteKey}
                  row={r}
                  rank={r.rank ?? i + 1}
                  watched={watchedKeySet.has(r.athleteKey)}
                />
              ))}
              {showWatched && watchedExtra.length > 0 && (
                <li className="bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Omat seurattavat
                </li>
              )}
              {showWatched &&
                watchedExtra.map((r) => (
                  <LeaderItem
                    key={`w-${r.athleteKey}`}
                    row={r}
                    rank={r.rank ?? null}
                    watched
                  />
                ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function LeaderItem({
  row,
  rank,
  watched,
}: {
  row: LeaderRow;
  rank: number | null;
  watched: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-2",
        watched && "bg-primary/5",
      )}
    >
      <div className="w-7 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {rank ?? "–"}
      </div>
      <div className="w-20 shrink-0 text-base font-semibold tabular-nums">
        {row.resultText}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          to="/athlete/$key"
          params={{ key: row.athleteKey }}
          className="block truncate text-sm font-medium hover:underline"
        >
          {row.surname} {row.firstname}
          {watched && (
            <Star className="ml-1 inline h-3.5 w-3.5 fill-primary text-primary" />
          )}
        </Link>
        <div className="truncate text-[11px] text-muted-foreground">
          {row.organization}
          {row.ageClass ? ` · ${row.ageClass}` : ""}
          {row.competitionDate
            ? ` · ${formatDate(row.competitionDate)}`
            : ""}
        </div>
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fi-FI", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  });
}
