import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Building2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";
import { CompetitionSwitcher } from "@/components/CompetitionSwitcher";
import { PrintTabs } from "@/components/PrintTabs";
import { usePrintOrientation, type Orientation } from "@/hooks/usePrintOrientation";

type ResultRow = {
  id: string;
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string | null;
  organization_id: number | null;
  competition_id: number;
  competition_name: string | null;
  event_name: string;
  age_class: string | null;
  sub_category: string | null;
  event_category: string | null;
  result_text: string | null;
  result_numeric: number | null;
  result_rank: number | null;
  wind: number | null;
  was_pb: boolean | null;
};

export const Route = createFileRoute("/print/club-report")({
  validateSearch: (search: Record<string, unknown>) => ({
    org:
      typeof search.org === "string"
        ? parseInt(search.org, 10)
        : Number(search.org) || 0,
    auto: search.auto === "1" || search.auto === 1 || search.auto === true,
  }),
  head: () => ({
    meta: [
      { title: "Seuran kisaraportti – tulostettava" },
      {
        name: "description",
        content:
          "Seuran kaikkien urheilijoiden tulokset valitusta kilpailusta lajeittain, sija, tulos ja mahdollinen ennätys.",
      },
    ],
  }),
  component: PrintClubReportPage,
});

function PrintClubReportPage() {
  const [competitionId] = useCompetitionId();
  const { org, auto } = Route.useSearch();
  const navigate = useNavigate();
  const { orientation, setOrientation } = usePrintOrientation();

  // Lataa kaikki kilpailun tulokset Supabasesta
  const resultsQuery = useQuery({
    queryKey: ["club-report-results", competitionId],
    queryFn: async (): Promise<ResultRow[]> => {
      if (!competitionId) return [];
      const rows: ResultRow[] = [];
      const PAGE = 1000;
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("athlete_results")
          .select(
            "id,athlete_key,surname,firstname,organization,organization_id,competition_id,competition_name,event_name,age_class,sub_category,event_category,result_text,result_numeric,result_rank,wind,was_pb",
          )
          .eq("competition_id", competitionId)
          .order("event_name", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...(data as ResultRow[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return rows;
    },
    enabled: !!competitionId,
    staleTime: 30_000,
  });

  const entries = resultsQuery.data ?? [];
  const compName = entries[0]?.competition_name ?? "";

  const clubs = useMemo(() => {
    const map = new Map<number, { id: number; name: string; athletes: Set<string> }>();
    for (const e of entries) {
      if (e.organization_id == null) continue;
      const id = e.organization_id;
      const nm = e.organization ?? "";
      if (!map.has(id)) map.set(id, { id, name: nm, athletes: new Set() });
      map.get(id)!.athletes.add(e.athlete_key);
    }
    return Array.from(map.values())
      .map((c) => ({ id: c.id, name: c.name, athletes: c.athletes.size }))
      .sort((a, b) => a.name.localeCompare(b.name, "fi"));
  }, [entries]);

  const orgName = useMemo(() => {
    const e = entries.find((x) => (x.organization_id ?? -1) === org);
    return e?.organization ?? "";
  }, [entries, org]);

  // Ryhmittele lajeittain (event_name + age_class)
  const grouped = useMemo(() => {
    if (!org) return [] as Array<{
      key: string;
      event_name: string;
      age_class: string;
      rows: ResultRow[];
    }>;
    const filtered = entries.filter((e) => (e.organization_id ?? -1) === org);
    const byEvent = new Map<string, { event_name: string; age_class: string; rows: ResultRow[] }>();
    for (const e of filtered) {
      const ac = e.age_class ?? "";
      const key = `${ac}|${e.event_name}`;
      if (!byEvent.has(key)) {
        byEvent.set(key, { event_name: e.event_name, age_class: ac, rows: [] });
      }
      byEvent.get(key)!.rows.push(e);
    }
    return Array.from(byEvent.entries())
      .map(([key, v]) => ({
        key,
        ...v,
        rows: [...v.rows].sort((a, b) => {
          const ar = a.result_rank ?? Number.POSITIVE_INFINITY;
          const br = b.result_rank ?? Number.POSITIVE_INFINITY;
          if (ar !== br) return ar - br;
          return (a.surname || "").localeCompare(b.surname || "", "fi");
        }),
      }))
      .sort((a, b) => {
        const ac = (a.age_class || "ZZZ").localeCompare(b.age_class || "ZZZ", "fi");
        if (ac !== 0) return ac;
        return a.event_name.localeCompare(b.event_name, "fi");
      });
  }, [entries, org]);

  useEffect(() => {
    if (auto && org && !resultsQuery.isLoading && grouped.length > 0) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [auto, org, resultsQuery.isLoading, grouped.length]);

  const setOrg = (id: number) => {
    navigate({
      to: "/print/club-report",
      search: { org: id, auto: false },
      replace: true,
    });
  };

  const totalPbs = useMemo(
    () =>
      grouped.reduce(
        (acc, g) => acc + g.rows.filter((r) => r.was_pb).length,
        0,
      ),
    [grouped],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              Seuran kisaraportti
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {orgName || "Valitse seura"} ·{" "}
              {compName || `Kisa #${competitionId}`}
            </p>
          </div>
          <Button
            onClick={() => window.print()}
            size="sm"
            className="gap-2"
            disabled={!org || grouped.length === 0}
          >
            <Printer className="h-4 w-4" />
            Tulosta / PDF
          </Button>
        </div>

        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 pb-3 sm:flex-row">
          <CompetitionSwitcher className="flex-1" />
          <div className="relative flex-1">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={org || ""}
              onChange={(e) => setOrg(parseInt(e.target.value, 10) || 0)}
              className="h-12 w-full appearance-none rounded-lg border border-input bg-background pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-ring sm:h-10 sm:text-sm"
              aria-label="Valitse seura"
              disabled={clubs.length === 0}
            >
              <option value="">
                {clubs.length === 0
                  ? resultsQuery.isLoading
                    ? "Ladataan seuroja…"
                    : "Ei tuloksia tässä kisassa"
                  : `Valitse seura (${clubs.length})`}
              </option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.athletes})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <PrintTabs />

      <main
        className={`mx-auto max-w-3xl px-4 py-6 print:py-2 print-schedule print-${orientation}`}
      >
        <div className="mb-5 rounded-xl border bg-card p-4 shadow-sm print:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tulostussuunta
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full gap-2 sm:w-auto">
              {(["portrait", "landscape"] as Orientation[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
                    orientation === o
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {o === "landscape" ? "Vaaka" : "Pysty"}
                </button>
              ))}
            </div>
            <Button
              onClick={() => window.print()}
              size="sm"
              className="gap-2 shrink-0"
              disabled={!org || grouped.length === 0}
            >
              <Printer className="h-4 w-4" />
              Tulosta / PDF
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold print:text-lg">
            {compName || `Kisa #${competitionId}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Seuran tulokset lajeittain — {orgName || "Seura"}
          </p>
          {org && grouped.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {grouped.length} lajia ·{" "}
              {grouped.reduce((a, g) => a + g.rows.length, 0)} suoritusta
              {totalPbs > 0 && (
                <>
                  {" · "}
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                    <Trophy className="h-3 w-3" /> {totalPbs} ennätys
                    {totalPbs !== 1 ? "tä" : ""}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {!org && (
          <p className="py-12 text-center text-sm text-muted-foreground print:hidden">
            Valitse kisa ja seura yltä — raportti näkyy lajeittain heti kun tulokset on tallennettu.
          </p>
        )}

        {org && resultsQuery.isLoading && entries.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ladataan tuloksia…
          </p>
        )}

        {org && !resultsQuery.isLoading && grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ei vielä tuloksia tälle seuralle tässä kisassa.
          </p>
        )}

        {grouped.map((g) => (
          <section key={g.key} className="mb-5 break-inside-avoid">
            <h2 className="mb-1 border-b-2 border-primary pb-1 text-base font-bold print:text-sm">
              {g.age_class ? `${g.age_class} ` : ""}
              {g.event_name}
            </h2>
            <table className="w-full text-sm print:text-xs">
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 align-baseline">
                    <td className="w-10 py-1.5 pr-2 text-right font-semibold tabular-nums text-muted-foreground">
                      {r.result_rank != null ? `${r.result_rank}.` : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className="font-medium">
                        {r.surname} {r.firstname}
                      </span>
                    </td>
                    <td className="w-28 py-1.5 pr-2 text-right tabular-nums">
                      {r.result_text || (r.result_numeric != null ? r.result_numeric : "—")}
                      {r.wind != null && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          ({r.wind > 0 ? "+" : ""}
                          {r.wind.toFixed(1)})
                        </span>
                      )}
                    </td>
                    <td className="w-12 py-1.5 text-right">
                      {r.was_pb && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 print:bg-transparent print:text-amber-900">
                          <Trophy className="h-2.5 w-2.5" /> PB
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <p className="mt-8 text-center text-xs text-muted-foreground print:mt-4">
          Lähde: tuloslista · Tulostettu {new Date().toLocaleString("fi-FI")}
        </p>
      </main>
    </div>
  );
}
