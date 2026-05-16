import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, RefreshCw, Trophy } from "lucide-react";

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
import { loadAllEventLeaders, type LeaderRow } from "@/lib/season-leaders";
import { seasonRange, type SeasonKind } from "@/lib/season-stats";
import { cn } from "@/lib/utils";
import { HarvestStatusBadge } from "@/components/HarvestStatusBadge";

export const Route = createFileRoute("/season-leaders")({
  head: () => ({
    meta: [
      { title: "Kauden kärki – Lahden Ahkera" },
      {
        name: "description",
        content:
          "Kauden top 3 -tulokset lajeittain valitulle ikäluokalle. Voit valita seuran nähdäksesi myös sen kärjen.",
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
  const [organization, setOrganization] = useState<string | null>(null);

  const range = useMemo(() => seasonRange(season), [season]);

  const query = useQuery({
    queryKey: ["season-leaders-all", season, ageClass, organization],
    queryFn: () =>
      loadAllEventLeaders({
        season,
        ageClass,
        organization,
        topN: 3,
        clubTopN: 3,
      }),
    staleTime: 60_000,
  });

  const data = query.data;

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
            <h1 className="text-base font-semibold leading-tight">Kauden kärki</h1>
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
        <div className="text-right">
          <HarvestStatusBadge />
        </div>
        <Tabs value={season} onValueChange={(v) => setSeason(v as SeasonKind)}>
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
              onValueChange={(v) => setAgeClass(v === "__all" ? null : v)}
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
              Seura (valinnainen)
            </label>
            <Select
              value={organization ?? "__all"}
              onValueChange={(v) => setOrganization(v === "__all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ei seuravalintaa" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__all">Ei seuravalintaa</SelectItem>
                {(data?.clubs ?? []).map((c) => (
                  <SelectItem key={`${c.id ?? "x"}|${c.name}`} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Listataan jokaisen lajin top 3.
          {organization && " Lisäksi valitun seuran 3 parasta tulosta lajia kohden."}
        </p>

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

        {data && data.groups.length === 0 && !query.isLoading && (
          <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Ei kauden tuloksia valituilla suodattimilla.
          </div>
        )}

        <div className="space-y-3">
          {(data?.groups ?? []).map((g) => (
            <section key={g.key} className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                {g.label}
              </div>
              <ul className="divide-y">
                {g.top.map((r, i) => (
                  <LeaderItem
                    key={r.athleteKey}
                    row={r}
                    rank={i + 1}
                    clubMatch={!!organization && r.organization === organization}
                  />
                ))}
                {organization && g.clubTop.length > 0 && (
                  <li className="bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {organization}
                  </li>
                )}
                {organization &&
                  g.clubTop.map((r) => (
                    <LeaderItem
                      key={`c-${r.athleteKey}`}
                      row={r}
                      rank={r.rank ?? null}
                      clubMatch
                    />
                  ))}
                {organization && g.clubTop.length === 0 && (
                  <li className="px-3 py-2 text-[11px] text-muted-foreground">
                    Ei muita seuran tuloksia tässä lajissa.
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeaderItem({
  row,
  rank,
  clubMatch,
}: {
  row: LeaderRow;
  rank: number | null;
  clubMatch?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-2",
        clubMatch && "bg-amber-500/10",
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
        </Link>
        <div className="truncate text-[11px] text-muted-foreground">
          {row.organization}
          {row.ageClass ? ` · ${row.ageClass}` : ""}
          {row.competitionName ? ` · ${row.competitionName}` : ""}
          {row.competitionDate ? ` · ${formatDate(row.competitionDate)}` : ""}
        </div>
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fi-FI", { day: "numeric", month: "numeric", year: "2-digit" });
}
