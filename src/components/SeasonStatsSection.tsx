import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";

import {
  fetchSeasonStats,
  seasonRange,
  type SeasonKind,
  type SeasonStatsRow,
} from "@/lib/season-stats";

const SEASON_OPTIONS: Array<{ value: SeasonKind; label: string }> = [
  { value: "year", label: "Kuluva vuosi" },
  { value: "summer", label: "Kesäkausi" },
  { value: "winter", label: "Talvikausi" },
];

function fmtHours(h: number): string {
  if (h <= 0) return "–";
  return `${h.toFixed(1).replace(".", ",")} h`;
}

function fmtKm(km: number | null): string {
  if (km == null) return "–";
  if (km <= 0) return "0 km";
  return `${Math.round(km)} km`;
}

function fmtMeters(m: number): string {
  if (m <= 0) return "–";
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
  return `${m} m`;
}

export function SeasonStatsSection() {
  const [season, setSeason] = useState<SeasonKind>("year");
  const [ageClass, setAgeClass] = useState<string>("");
  const [open, setOpen] = useState(false);

  const range = useMemo(() => seasonRange(season), [season]);

  const query = useQuery({
    queryKey: ["season-stats", season, ageClass || "all"],
    queryFn: () => fetchSeasonStats(season, ageClass || null),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const rows = query.data?.rows ?? [];
  const ageClasses = query.data?.ageClasses ?? [];

  const totals = useMemo<Omit<SeasonStatsRow, "athleteKey" | "surname" | "firstname" | "organization" | "organizationId" | "ageClass">>(() => {
    const t = { events: 0, competitions: 0, hours: 0, meters: 0, pbs: 0, wins: 0, km: 0 };
    let kmKnown = false;
    for (const r of rows) {
      t.events += r.events;
      t.competitions += r.competitions;
      t.hours += r.hours;
      t.meters += r.meters;
      t.pbs += r.pbs;
      t.wins += r.wins;
      if (r.km != null) {
        kmKnown = true;
        t.km += r.km;
      }
    }
    return { ...t, km: kmKnown ? t.km : (null as unknown as number) };
  }, [rows]);

  return (
    <section className="mb-4 rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="flex-1 text-sm font-bold">Kauden tilastot</h2>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as SeasonKind)}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Valitse kausi"
            >
              {SEASON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={ageClass}
              onChange={(e) => setAgeClass(e.target.value)}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Valitse ikäluokka"
              disabled={ageClasses.length === 0}
            >
              <option value="">Kaikki ikäluokat</option>
              {ageClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <p className="mb-2 text-[11px] text-muted-foreground">
            {range.label} · {range.from.toLocaleDateString("fi-FI")} –{" "}
            {new Date(range.to.getTime() - 1).toLocaleDateString("fi-FI")}
          </p>

          {query.isLoading ? (
            <p className="text-xs text-muted-foreground">Lasketaan tilastoja…</p>
          ) : query.isError ? (
            <p className="text-xs text-destructive">
              Virhe tilastojen latauksessa: {(query.error as Error).message}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ei tuloksia valitulle kaudelle. Lisää urheilijoita kilpailijaseurantaan.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-1 py-1">Urheilija</th>
                      <th className="px-1 py-1 text-right">Lajit</th>
                      <th className="px-1 py-1 text-right">Kisat</th>
                      <th className="px-1 py-1 text-right">PB</th>
                      <th className="px-1 py-1 text-right">1.</th>
                      <th className="px-1 py-1 text-right">Tunnit</th>
                      <th className="px-1 py-1 text-right">Juostu</th>
                      <th className="px-1 py-1 text-right">Matka</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.athleteKey}>
                        <td className="px-1 py-1.5">
                          <div className="font-semibold">
                            {r.surname} {r.firstname}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {r.ageClass}
                          </div>
                        </td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{r.events}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{r.competitions}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{r.pbs || "–"}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{r.wins || "–"}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{fmtHours(r.hours)}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{fmtMeters(r.meters)}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{fmtKm(r.km)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="px-1 py-1.5">Yhteensä ({rows.length})</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{totals.events}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{totals.competitions}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{totals.pbs || "–"}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{totals.wins || "–"}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{fmtHours(totals.hours)}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{fmtMeters(totals.meters)}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{fmtKm(totals.km)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {(query.data?.missingOrgLocations.length ?? 0) > 0 && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {query.data!.missingOrgLocations.length} seuralla ei vielä kotipaikkaa →
                  km-laskenta puuttuu. Lisää kotipaikat kohdassa "Seurojen sijainnit".
                </p>
              )}
              {(query.data?.missingCompetitionLocations.length ?? 0) > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {query.data!.missingCompetitionLocations.length} kilpailupaikalle puuttuu
                  koordinaatit.
                </p>
              )}
              <p className="mt-2 text-[10px] text-muted-foreground">
                Tunnit: arvio 1,5 h pohja per kisapäivä + 0,5 h jokaista lisälajia kohden.
                Juostut metrit: yhteenlaskettu rata- ja aitajuoksuista.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
