import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, RefreshCw, Sparkles } from "lucide-react";

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
import { FunStatCard } from "@/components/FunStatCard";
import { FUN_METRICS, fetchFunStats } from "@/lib/fun-stats";
import { seasonRange, type SeasonKind } from "@/lib/season-stats";

export const Route = createFileRoute("/hauskat-tilastot")({
  head: () => ({
    meta: [
      { title: "Hauskat tilastot – Lahden Ahkera" },
      {
        name: "description",
        content:
          "Leikkimieliset kausitilastot lapsille: monipuolisuus, ahkeruus ja hauskat mittarit – jokaiselle löytyy oma vahvuus.",
      },
    ],
  }),
  component: () => (
    <RequireRole allow={["user", "official"]}>
      <FunStatsPage />
    </RequireRole>
  ),
});

const SEASON_OPTIONS: Array<{ value: SeasonKind; label: string }> = [
  { value: "year", label: "Kuluva vuosi" },
  { value: "summer", label: "Kesäkausi" },
  { value: "winter", label: "Talvikausi" },
];

function FunStatsPage() {
  const [season, setSeason] = useState<SeasonKind>("year");
  const [ageClass, setAgeClass] = useState<string>("");

  const range = useMemo(() => seasonRange(season), [season]);

  const query = useQuery({
    queryKey: ["fun-stats", season, ageClass || "all"],
    queryFn: () => fetchFunStats(season, ageClass || null),
    staleTime: 2 * 60_000,
  });

  const ageClasses = query.data?.ageClasses ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <Button asChild variant="ghost" size="icon" aria-label="Takaisin etusivulle">
            <Link to="/">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight">
                Hauskat tilastot
              </h1>
              <div className="truncate text-[11px] text-muted-foreground">
                {range.label} · seuratut urheilijat
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Päivitä"
          >
            <RefreshCw
              className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-3 pb-2">
          <Tabs
            value={season}
            onValueChange={(v) => setSeason(v as SeasonKind)}
          >
            <TabsList className="h-8">
              {SEASON_OPTIONS.map((o) => (
                <TabsTrigger key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select
            value={ageClass || "all"}
            onValueChange={(v) => setAgeClass(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
              <SelectValue placeholder="Ikäluokka" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kaikki ikäluokat</SelectItem>
              {ageClasses.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 py-4">
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Tämä sivu juhlii monipuolisuutta ja ahkeruutta – ei paremmuutta.
          Jokaisella mittarilla on oma kärki, joten useammat lapset pärjäävät.
        </div>

        {query.isLoading && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Lasketaan tilastoja…
          </div>
        )}
        {query.isError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Tilastoja ei voitu ladata.
          </div>
        )}

        {query.data && (
          <div className="grid gap-3 sm:grid-cols-2">
            {FUN_METRICS.map((def) => (
              <FunStatCard
                key={def.key}
                def={def}
                entries={query.data.byMetric[def.key] ?? []}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
