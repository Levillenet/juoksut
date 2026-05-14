import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Award, Loader2, RefreshCw, X, ExternalLink } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWatchedAthletes, athleteKey } from "@/lib/watch-store";
import {
  fetchStoredHistory,
  fetchClubHistory,
  groupByEvent,
  harvestAthleteHistory,
  formatSeconds,
  type AthleteResultRow,
  type EventGroup,
  type HarvestProgress,
  type HarvestTarget,
} from "@/lib/athlete-history";
import { translateSub } from "@/lib/tuloslista";

interface ClubOption {
  id: number;
  name: string;
}

interface Props {
  /** Clubs available in current competition for the dropdown. */
  clubs: ClubOption[];
}

const HELSINKI_DATE = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return HELSINKI_DATE.format(new Date(iso));
  } catch {
    return "—";
  }
}

export function RecordsPanel({ clubs }: Props) {
  const { list: watched } = useWatchedAthletes();

  const [mode, setMode] = useState<"watched" | "club">("watched");
  const [clubId, setClubId] = useState<number | null>(null);

  const [harvesting, setHarvesting] = useState(false);
  const [progress, setProgress] = useState<HarvestProgress | null>(null);
  const [fromId, setFromId] = useState<number>(17000);
  const [toId, setToId] = useState<number>(19200);
  const abortRef = useRef<AbortController | null>(null);

  // Stored history query
  const watchedKeys = useMemo(() => watched.map((w) => w.key), [watched]);
  const storedQuery = useQuery({
    queryKey:
      mode === "watched"
        ? ["athlete-history", "watched", watchedKeys.sort().join(",")]
        : ["athlete-history", "club", clubId ?? 0],
    queryFn: () =>
      mode === "watched"
        ? fetchStoredHistory(watchedKeys)
        : clubId != null
          ? fetchClubHistory(clubId)
          : Promise.resolve([]),
    enabled: mode === "watched" ? watchedKeys.length > 0 : clubId != null,
    staleTime: 30_000,
  });

  // Group by athlete -> event
  const byAthlete = useMemo(() => {
    const rows: AthleteResultRow[] = storedQuery.data ?? [];
    const map = new Map<
      string,
      { key: string; surname: string; firstname: string; organization: string; rows: AthleteResultRow[] }
    >();
    for (const r of rows) {
      const k = r.athlete_key;
      if (!map.has(k)) {
        map.set(k, {
          key: k,
          surname: r.surname,
          firstname: r.firstname,
          organization: r.organization,
          rows: [],
        });
      }
      map.get(k)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.surname} ${a.firstname}`.localeCompare(`${b.surname} ${b.firstname}`, "fi"),
    );
  }, [storedQuery.data]);

  // Build the targets to harvest
  const harvestTargets: HarvestTarget[] = useMemo(() => {
    if (mode === "watched") {
      return watched.map((w) => ({
        surname: w.surname,
        firstname: w.firstname,
        organizationId: w.organizationId,
      }));
    }
    return []; // club mode: handled below — we need names of members
  }, [mode, watched]);

  const startHarvest = async (targets: HarvestTarget[]) => {
    if (targets.length === 0 || harvesting) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setHarvesting(true);
    setProgress({ scanned: 0, total: 0, found: 0 });
    try {
      await harvestAthleteHistory(targets, {
        fromId: Math.min(fromId, toId),
        toId: Math.max(fromId, toId),
        onProgress: (p) => setProgress(p),
        signal: ctrl.signal,
        concurrency: 6,
      });
      await storedQuery.refetch();
    } finally {
      setHarvesting(false);
      abortRef.current = null;
    }
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  const cancelHarvest = () => abortRef.current?.abort();

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-2">
        <Button
          variant={mode === "watched" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("watched")}
        >
          Seuratut ({watched.length})
        </Button>
        <Button
          variant={mode === "club" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("club")}
        >
          Seuran urheilijat
        </Button>
        {mode === "club" && (
          <select
            className="ml-auto h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={clubId ?? ""}
            onChange={(e) => setClubId(e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            <option value="">Valitse seura…</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Harvest controls */}
      <div className="rounded-lg border bg-card p-3 text-sm">
        <p className="mb-2 text-xs text-muted-foreground">
          Selaa tuloslistan kisoja (ID-väli) ja kerää löytyneet tulokset talteen.
          Kannattaa aloittaa pienellä välillä, esim. {fromId}–{toId} (~{toId - fromId} kisaa).
          Ajaminen tapahtuu selaimessa ja saattaa kestää useita minuutteja.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs">
            ID alkaen
            <Input
              type="number"
              value={fromId}
              onChange={(e) => setFromId(parseInt(e.target.value, 10) || 0)}
              className="h-9 w-28"
              disabled={harvesting}
            />
          </label>
          <label className="flex flex-col text-xs">
            ID asti
            <Input
              type="number"
              value={toId}
              onChange={(e) => setToId(parseInt(e.target.value, 10) || 0)}
              className="h-9 w-28"
              disabled={harvesting}
            />
          </label>
          {harvesting ? (
            <Button size="sm" variant="outline" onClick={cancelHarvest} className="gap-2">
              <X className="h-4 w-4" /> Pysäytä
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                if (mode === "watched") {
                  startHarvest(harvestTargets);
                } else {
                  // Club mode: derive targets from already-stored athletes for this club,
                  // OR from current competition's index entries — easiest: use stored.
                  const targets = byAthlete.map((a) => {
                    const sample = a.rows[0];
                    return {
                      surname: a.surname,
                      firstname: a.firstname,
                      organizationId: sample.organization_id,
                    } satisfies HarvestTarget;
                  });
                  startHarvest(targets);
                }
              }}
              disabled={
                (mode === "watched" && watched.length === 0) ||
                (mode === "club" && (clubId == null || byAthlete.length === 0))
              }
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Etsi historia
            </Button>
          )}
        </div>
        {harvesting && progress && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {progress.scanned}/{progress.total} kisaa skannattu · {progress.found} osumaa
            {progress.current ? ` · ${progress.current}` : ""}
          </p>
        )}
        {mode === "club" && byAthlete.length === 0 && clubId != null && !harvesting && (
          <p className="mt-2 text-xs text-muted-foreground">
            Tälle seuralle ei vielä löydy talletettuja tuloksia. Lisää ensin
            seurattavia urheilijoita ja aja heille historiahaku, niin tähän
            kertyy dataa seuratasolla.
          </p>
        )}
      </div>

      {/* Per-athlete record cards */}
      {storedQuery.isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Ladataan…</p>
      ) : byAthlete.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
          <Award className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Ei vielä tallennettuja tuloksia. Aja "Etsi historia" yltä.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {byAthlete.map((a) => {
            const groups = groupByEvent(a.rows);
            return (
              <li key={a.key} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight">
                      {a.surname} {a.firstname}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.organization}</p>
                  </div>
                  <Link
                    to="/athlete/$key"
                    params={{ key: a.key }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
                  >
                    Dashboard <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <ul className="space-y-4">
                  {groups.map((g) => (
                    <EventGroupView key={`${g.eventName}|${g.subCategory}`} group={g} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function EventGroupView({ group }: { group: EventGroup }) {
  const points = useMemo(
    () =>
      group.rows
        .filter((r) => r.result_numeric != null && r.competition_date)
        .map((r) => ({
          date: r.competition_date!,
          ts: new Date(r.competition_date!).getTime(),
          value: r.result_numeric!,
          text: r.result_text,
          competition: r.competition_name,
        })),
    [group.rows],
  );

  const formatY = (v: number) =>
    group.category === "Track" ? formatSeconds(v) : v.toFixed(2);

  // Compute running PB line (best so far)
  const pbLine = useMemo(() => {
    let best: number | null = null;
    return points.map((p) => {
      if (best == null || (group.lowerBetter ? p.value < best : p.value > best)) {
        best = p.value;
      }
      return { ...p, pb: best };
    });
  }, [points, group.lowerBetter]);

  return (
    <li className="rounded-lg border bg-background/50 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{group.eventName}</p>
          {group.subCategory && (
            <p className="text-[11px] text-muted-foreground">
              {translateSub(group.subCategory)}
            </p>
          )}
        </div>
        {group.pb && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              PB
            </p>
            <p className="text-base font-bold tabular-nums">{group.pb.result_text}</p>
            <p className="text-[10px] text-muted-foreground">
              {group.pb.competition_name} · {formatDate(group.pb.competition_date)}
            </p>
          </div>
        )}
      </div>

      {pbLine.length >= 2 ? (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pbLine} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t) => formatDate(new Date(t).toISOString())}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <YAxis
                domain={["auto", "auto"]}
                reversed={group.lowerBetter}
                tickFormatter={formatY}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
                labelFormatter={(t) => formatDate(new Date(Number(t)).toISOString())}
                formatter={(value: number, name: string) => [
                  group.category === "Track" ? formatSeconds(value) : value.toFixed(2),
                  name === "pb" ? "PB-kehitys" : "Tulos",
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                dot={{ r: 2 }}
              />
              <Line
                type="stepAfter"
                dataKey="pb"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Vain {pbLine.length} tulos — graafiin tarvitaan vähintään 2.
        </p>
      )}

      {/* Recent results list */}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-muted-foreground">
          Kaikki tulokset ({group.rows.length})
        </summary>
        <ul className="mt-1 divide-y divide-border text-xs">
          {group.rows
            .slice()
            .reverse()
            .map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-2 py-1">
                <span className="tabular-nums">{r.result_text}</span>
                <span className="truncate text-muted-foreground">
                  {r.competition_name} · {formatDate(r.competition_date)}
                </span>
              </li>
            ))}
        </ul>
      </details>
    </li>
  );
}

// silence unused warning for athleteKey if we change matching later
void athleteKey;
