import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";
import { CompetitionSwitcher } from "@/components/CompetitionSwitcher";
import { PrintTabs } from "@/components/PrintTabs";
import { usePrintOrientation, type Orientation } from "@/hooks/usePrintOrientation";
import {
  fetchRounds,
  fetchEvent,
  isVerticalJump,
  type Round,
  type Allocation,
} from "@/lib/tuloslista";

export const Route = createFileRoute("/print/club-team-report")({
  head: () => ({
    meta: [
      { title: "Joukkuekisa (kentät) – tulostettava" },
      {
        name: "description",
        content:
          "Kenttälajien joukkuekisa: kunkin seuran kahden parhaan kilpailijan paras tulos kolmesta ensimmäisestä kierroksesta.",
      },
    ],
  }),
  component: PrintClubTeamReportPage,
});

// --- attempt parsing ---

/** Parse one attempt string ("12,45", "11.20", "x", "-", "O", "XO") to a number.
 *  Returns null for failures/passes/non-numeric. */
function parseAttempt(line: string | null | undefined): number | null {
  if (!line) return null;
  const s = String(line).trim();
  if (!s) return null;
  // Heitot/vaakahypyt: x = hylätty, - = ohitus
  if (/^[x\-–pP]+$/i.test(s)) return null;
  // Pystyhyppy: O = ylitetty, X = hylätty, XO = 2. yritys onnistunut
  // Pystyhyppyjen attempts.Line1 on yleensä korkeus (esim "1,75") tai O/X-merkit
  // Korvaa pilkku pisteeksi ja yritä parsia
  const cleaned = s.replace(/,/g, ".").replace(/[^\d.+-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Best of first 3 attempts (horizontal jump / throw). */
function best3FromAttempts(att: Allocation["Attempts"]): number | null {
  if (!att || att.length === 0) return null;
  const first3 = att.slice(0, 3);
  let best: number | null = null;
  for (const a of first3) {
    const v = parseAttempt(a?.Line1 ?? null);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best;
}

/** Format a number as Finnish (12,45). */
function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(2).replace(".", ",");
}

// --- data types ---

interface AthleteEntry {
  athleteId: number | string;
  name: string;
  org: string;
  orgId: number;
  eventRank: number | null;
  best3: number | null;
}

interface ClubRow {
  rank: number;
  org: string;
  orgId: number;
  total: number;
  athletes: AthleteEntry[];
}

interface EventBlock {
  eventId: number;
  eventName: string;
  ageClass: string;
  status: Round["Status"];
  isVertical: boolean;
  clubs: ClubRow[];
  noTeam: AthleteEntry[];
}

function PrintClubTeamReportPage() {
  const [competitionId] = useCompetitionId();
  const { orientation, setOrientation } = usePrintOrientation();

  // 1. rounds
  const roundsQuery = useQuery({
    queryKey: ["team-report-rounds", competitionId],
    queryFn: async () => {
      if (!competitionId) return null;
      return fetchRounds(competitionId);
    },
    enabled: !!competitionId,
    staleTime: 30_000,
  });

  // Field events: unique by EventId, prefer the latest round (final) per event
  const fieldEvents = useMemo(() => {
    const byDate = roundsQuery.data;
    if (!byDate) return [] as Round[];
    const all: Round[] = [];
    for (const arr of Object.values(byDate)) all.push(...arr);
    const fieldOnly = all.filter((r) => r.Category === "Field");
    // pick the round we want per EventId — prefer Final/last one
    const byEvent = new Map<number, Round>();
    for (const r of fieldOnly) {
      const prev = byEvent.get(r.EventId);
      if (!prev) {
        byEvent.set(r.EventId, r);
      } else {
        // prefer Official > Progress > Allocated > Unallocated; and later round
        const prevPrio = statusPriority(prev.Status);
        const curPrio = statusPriority(r.Status);
        if (curPrio > prevPrio) byEvent.set(r.EventId, r);
        else if (curPrio === prevPrio && r.Id > prev.Id) byEvent.set(r.EventId, r);
      }
    }
    return Array.from(byEvent.values()).sort((a, b) => {
      const ac = (a.Age || "").localeCompare(b.Age || "", "fi");
      if (ac !== 0) return ac;
      return a.EventName.localeCompare(b.EventName, "fi");
    });
  }, [roundsQuery.data]);

  // 2. fetch each event's results in parallel
  const eventQueries = useQuery({
    queryKey: ["team-report-events", competitionId, fieldEvents.map((e) => e.EventId).join(",")],
    queryFn: async (): Promise<EventBlock[]> => {
      if (!competitionId || fieldEvents.length === 0) return [];
      const results = await Promise.allSettled(
        fieldEvents.map((r) => fetchEvent(competitionId, r.EventId)),
      );
      const blocks: EventBlock[] = [];
      for (let i = 0; i < fieldEvents.length; i++) {
        const r = fieldEvents[i];
        const res = results[i];
        if (res.status !== "fulfilled") continue;
        const ev = res.value;
        const vertical = isVerticalJump(ev);
        // Collect all athletes across heats & rounds; use the "latest" round
        // for the actual final allocations.
        const lastRound = ev.Rounds[ev.Rounds.length - 1];
        if (!lastRound) continue;
        const athletes: AthleteEntry[] = [];
        for (const heat of lastRound.Heats ?? []) {
          for (const a of heat.Allocations ?? []) {
            if (a.NotInCompetition) continue;
            const orgId = a.Organization?.Id ?? 0;
            const org = a.Organization?.Name ?? a.TeamName ?? "—";
            let best: number | null = null;
            if (vertical) {
              // For high jump / pole vault use overall cleared height
              best = parseAttempt(a.Result);
            } else {
              best = best3FromAttempts(a.Attempts);
              // Fallback: if no attempts, use overall result so the entry still counts
              if (best == null) best = parseAttempt(a.Result);
            }
            athletes.push({
              athleteId: a.Id,
              name: `${a.Firstname} ${a.Surname}`.trim(),
              org,
              orgId,
              eventRank: a.ResultRank,
              best3: best,
            });
          }
        }
        // group by club
        const clubsMap = new Map<number, AthleteEntry[]>();
        const noTeam: AthleteEntry[] = [];
        for (const ath of athletes) {
          if (ath.best3 == null) continue;
          if (!clubsMap.has(ath.orgId)) clubsMap.set(ath.orgId, []);
          clubsMap.get(ath.orgId)!.push(ath);
        }
        const clubs: ClubRow[] = [];
        for (const [orgId, list] of clubsMap.entries()) {
          list.sort((a, b) => (b.best3 ?? 0) - (a.best3 ?? 0));
          if (list.length < 2) {
            noTeam.push(...list);
            continue;
          }
          const top2 = list.slice(0, 2);
          const total = top2.reduce((s, a) => s + (a.best3 ?? 0), 0);
          clubs.push({
            rank: 0,
            org: top2[0].org,
            orgId,
            total,
            athletes: top2,
          });
        }
        clubs.sort((a, b) => {
          if (b.total !== a.total) return b.total - a.total;
          // tiebreak: lower sum of event ranks wins
          const ar = a.athletes.reduce((s, x) => s + (x.eventRank ?? 999), 0);
          const br = b.athletes.reduce((s, x) => s + (x.eventRank ?? 999), 0);
          return ar - br;
        });
        clubs.forEach((c, idx) => {
          c.rank = idx + 1;
        });
        blocks.push({
          eventId: r.EventId,
          eventName: r.EventName,
          ageClass: r.Age,
          status: lastRound.Status,
          isVertical: vertical,
          clubs,
          noTeam,
        });
      }
      return blocks;
    },
    enabled: !!competitionId && fieldEvents.length > 0,
    staleTime: 30_000,
  });

  const compName = roundsQuery.data ? firstCompName(roundsQuery.data) : "";
  const blocks = eventQueries.data ?? [];
  const loading = roundsQuery.isLoading || eventQueries.isLoading;

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
              Joukkuekisa (kentät)
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {compName || `Kisa #${competitionId ?? ""}`}
            </p>
          </div>
          <Button
            onClick={() => window.print()}
            size="sm"
            className="gap-2"
            disabled={blocks.length === 0}
          >
            <Printer className="h-4 w-4" />
            Tulosta / PDF
          </Button>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <CompetitionSwitcher />
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
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold print:text-lg">
            {compName || `Kisa #${competitionId ?? ""}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Joukkuekisa kenttälajeissa — kunkin seuran kahden parhaan paras
            tulos kolmesta ensimmäisestä kierroksesta. Korkeudessa ja
            seipäässä käytetään lopullista ylitettyä korkeutta.
          </p>
          {blocks.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {blocks.length} lajia
            </p>
          )}
        </div>

        {!competitionId && (
          <p className="py-12 text-center text-sm text-muted-foreground print:hidden">
            Valitse kisa yltä.
          </p>
        )}

        {competitionId && loading && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ladataan kenttälajien tuloksia…
          </p>
        )}

        {competitionId && !loading && blocks.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Tässä kisassa ei ole kenttälajeja tai tuloksia ei ole vielä saatavilla.
          </p>
        )}

        {blocks.map((b) => (
          <section key={b.eventId} className="mb-6 break-inside-avoid">
            <h2 className="mb-1 border-b-2 border-primary pb-1 text-base font-bold print:text-sm">
              {b.ageClass ? `${b.ageClass} ` : ""}
              {b.eventName}
              {b.status !== "Official" && (
                <span className="ml-2 text-[10px] font-normal uppercase text-muted-foreground">
                  ({b.status})
                </span>
              )}
            </h2>
            {b.clubs.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">
                Ei seuroja, joilla on vähintään kaksi kilpailijaa.
              </p>
            ) : (
              <table className="w-full text-sm print:text-xs">
                <tbody>
                  {b.clubs.map((c) => (
                    <>
                      <tr key={`${b.eventId}-${c.orgId}-club`} className="border-t border-border/60 align-baseline">
                        <td className="w-8 py-1.5 pr-2 text-right font-bold tabular-nums">
                          {c.rank}.
                        </td>
                        <td className="py-1.5 pr-2 font-semibold">{c.org}</td>
                        <td className="w-24 py-1.5 pr-2 text-right font-bold tabular-nums">
                          {fmtNum(c.total)}
                        </td>
                      </tr>
                      {c.athletes.map((a) => (
                        <tr
                          key={`${b.eventId}-${c.orgId}-${a.athleteId}`}
                          className="text-muted-foreground"
                        >
                          <td className="py-0.5"></td>
                          <td className="py-0.5 pr-2 pl-3">
                            {a.name}
                            {a.eventRank != null && (
                              <span className="ml-2 text-[10px]">
                                (sij. {a.eventRank})
                              </span>
                            )}
                          </td>
                          <td className="py-0.5 pr-2 text-right tabular-nums">
                            {fmtNum(a.best3)}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}

        <p className="mt-8 text-center text-xs text-muted-foreground print:mt-4">
          Lähde: live.tuloslista.com · Tulostettu{" "}
          {new Date().toLocaleString("fi-FI")}
        </p>
      </main>
    </div>
  );
}

function statusPriority(s: Round["Status"]): number {
  switch (s) {
    case "Official":
      return 4;
    case "Progress":
      return 3;
    case "Allocated":
      return 2;
    case "Unallocated":
      return 1;
    default:
      return 0;
  }
}

function firstCompName(byDate: Record<string, Round[]>): string {
  for (const arr of Object.values(byDate)) {
    for (const r of arr) {
      // Round doesn't carry competition name; leave blank
      void r;
    }
  }
  return "";
}
