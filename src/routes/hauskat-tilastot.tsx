import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronsUpDown, RefreshCw, Sparkles } from "lucide-react";

import { RequireRole } from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FunStatCard } from "@/components/FunStatCard";
import {
  FUN_METRICS,
  fetchAgeClassesForOrg,
  fetchFunStats,
  fetchOrganizations,
} from "@/lib/fun-stats";
import { seasonRange, type SeasonKind } from "@/lib/season-stats";
import { cn } from "@/lib/utils";
import { HarvestStatusBadge } from "@/components/HarvestStatusBadge";

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

const ORG_STORAGE_KEY = "funstats:org";
const SEASON_STORAGE_KEY = "funstats:season";
const AGES_STORAGE_KEY = "funstats:ages";

function FunStatsPage() {
  const [season, setSeason] = useState<SeasonKind>(() => {
    if (typeof window === "undefined") return "year";
    const v = window.localStorage.getItem(SEASON_STORAGE_KEY);
    return v === "summer" || v === "winter" || v === "year" ? v : "year";
  });
  const [org, setOrg] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ORG_STORAGE_KEY) ?? "";
  });
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);
  const [selectedAges, setSelectedAges] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(AGES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const [ageTouched, setAgeTouched] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!window.localStorage.getItem(AGES_STORAGE_KEY);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (org) window.localStorage.setItem(ORG_STORAGE_KEY, org);
  }, [org]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SEASON_STORAGE_KEY, season);
  }, [season]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (ageTouched) {
      window.localStorage.setItem(AGES_STORAGE_KEY, JSON.stringify(selectedAges));
    }
  }, [selectedAges, ageTouched]);

  const range = useMemo(() => seasonRange(season), [season]);

  const orgsQuery = useQuery({
    queryKey: ["fun-stats-orgs", season],
    queryFn: () => fetchOrganizations(season),
    staleTime: 5 * 60_000,
  });

  const ageQuery = useQuery({
    queryKey: ["fun-stats-ages", season, org],
    queryFn: () => fetchAgeClassesForOrg(season, org),
    enabled: !!org,
    staleTime: 5 * 60_000,
  });

  // Kun ikäluokkalista latautuu: jos käyttäjä ei ole valinnut, valitse kaikki.
  // Jos käyttäjä on valinnut, suodata pois ikäluokat joita ei ole tarjolla;
  // jos mitään ei jää, palauta valinnaksi kaikki saatavilla olevat.
  useEffect(() => {
    const ages = ageQuery.data;
    if (!ages || ages.length === 0) return;
    if (!ageTouched) {
      setSelectedAges(ages);
      return;
    }
    setSelectedAges((prev) => {
      const filtered = prev.filter((a) => ages.includes(a));
      if (filtered.length === 0) return ages;
      if (filtered.length === prev.length) return prev;
      return filtered;
    });
  }, [ageQuery.data, ageTouched]);

  const statsQuery = useQuery({
    queryKey: ["fun-stats", season, org, [...selectedAges].sort().join(",")],
    queryFn: () =>
      fetchFunStats(
        season,
        org || null,
        selectedAges.length > 0 ? selectedAges : null,
      ),
    enabled: !!org,
    staleTime: 2 * 60_000,
  });

  const allAges = ageQuery.data ?? [];
  const ageLabel =
    selectedAges.length === 0
      ? "Ei ikäluokkia"
      : allAges.length > 0 && selectedAges.length === allAges.length
        ? "Kaikki ikäluokat"
        : selectedAges.length <= 3
          ? selectedAges.join(", ")
          : `${selectedAges.length} ikäluokkaa`;

  const toggleAge = (a: string) => {
    setAgeTouched(true);
    setSelectedAges((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  };

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
                {range.label}
                {org ? ` · ${org}` : ""}
                {" · "}
                <HarvestStatusBadge className="text-[11px] text-muted-foreground" />
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => statsQuery.refetch()}
            disabled={statsQuery.isFetching || !org}
            aria-label="Päivitä"
          >
            <RefreshCw
              className={`h-4 w-4 ${statsQuery.isFetching ? "animate-spin" : ""}`}
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

          {/* Seuravalinta */}
          <Popover open={orgPopoverOpen} onOpenChange={setOrgPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                role="combobox"
                className="h-8 justify-between text-xs"
              >
                <span className="truncate max-w-[180px]">
                  {org || "Valitse seura…"}
                </span>
                <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Etsi seuraa…" className="h-9" />
                <CommandList>
                  <CommandEmpty>
                    {orgsQuery.isLoading ? "Ladataan…" : "Ei tuloksia."}
                  </CommandEmpty>
                  <CommandGroup>
                    {(orgsQuery.data ?? []).map((o) => (
                      <CommandItem
                        key={o}
                        value={o}
                        onSelect={() => {
                          setOrg(o);
                          setOrgPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            org === o ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {o}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Ikäluokat (monivalinta) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-between text-xs"
                disabled={!org || allAges.length === 0}
              >
                <span className="truncate max-w-[160px]">{ageLabel}</span>
                <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-2" align="start">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setAgeTouched(true);
                    setSelectedAges(allAges);
                  }}
                >
                  Valitse kaikki
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => {
                    setAgeTouched(true);
                    setSelectedAges([]);
                  }}
                >
                  Tyhjennä
                </button>
              </div>
              <div className="max-h-[300px] space-y-1 overflow-y-auto">
                {allAges.map((a) => {
                  const checked = selectedAges.includes(a);
                  return (
                    <label
                      key={a}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleAge(a)}
                      />
                      <span>{a}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 py-4">
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Tämä sivu juhlii monipuolisuutta ja ahkeruutta – ei paremmuutta.
          Jokaisella mittarilla on oma kärki, joten useammat lapset pärjäävät.
        </div>

        {!org && (
          <div className="rounded-md border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            Valitse seura yltä nähdäksesi tilastot.
          </div>
        )}

        {org && statsQuery.isLoading && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Lasketaan tilastoja…
          </div>
        )}
        {statsQuery.isError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Tilastoja ei voitu ladata.
          </div>
        )}

        {org && statsQuery.data && (
          <div className="grid gap-3 sm:grid-cols-2">
            {FUN_METRICS.map((def) => (
              <FunStatCard
                key={def.key}
                def={def}
                entries={statsQuery.data.byMetric[def.key] ?? []}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
