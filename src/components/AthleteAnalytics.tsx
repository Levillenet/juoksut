import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, StickyNote, Youtube, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pbEventKey } from "@/lib/pb-key";
import { isLowerBetter, type AthleteResultRow } from "@/lib/athlete-history";
import type { AthleteNote } from "@/lib/athlete-notes";
import { competitionScopeKey, eventScopeKey, noteKey } from "@/lib/athlete-notes";
import type { ResultVideo } from "@/lib/result-videos";
import { videoKey, embedUrl } from "@/lib/result-videos";
import { ResultVideoButton } from "@/components/ResultVideoButton";
import { AthleteNoteEditor } from "@/components/AthleteNoteEditor";
import {
  placeholderForCompetition,
  placeholderForEvent,
  placeholderForEventOverall,
} from "@/lib/athlete-notes";

interface Props {
  athleteKey: string;
  rows: AthleteResultRow[];
  notes: Map<string, AthleteNote[]> | undefined;
  videos: Map<string, ResultVideo[]> | undefined;
  myUserId: string;
  labelMap?: Map<string, string>;
}

interface EventOption {
  key: string;
  label: string;
  count: number;
  ageClass: string;
  rows: AthleteResultRow[];
  lowerBetter: boolean;
}

const HELSINKI_DATE = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return HELSINKI_DATE.format(new Date(iso));
  } catch {
    return "—";
  }
}

export function AthleteAnalytics({
  athleteKey,
  rows,
  notes,
  videos,
  myUserId,
  labelMap,
}: Props) {
  const options = useMemo<EventOption[]>(() => {
    const groups = new Map<string, EventOption>();
    for (const r of rows) {
      if (r.result_numeric == null) continue;
      const k = pbEventKey({ event_name: r.event_name, age_class: r.age_class });
      const existing = groups.get(k);
      if (existing) {
        existing.rows.push(r);
        existing.count += 1;
      } else {
        groups.set(k, {
          key: k,
          label: `${r.age_class ? r.age_class + " " : ""}${r.event_name}`,
          ageClass: r.age_class ?? "",
          count: 1,
          rows: [r],
          lowerBetter: isLowerBetter(r.event_category, r.sub_category),
        });
      }
    }
    return Array.from(groups.values())
      .filter((g) => g.rows.length >= 2)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fi"));
  }, [rows]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const active = useMemo(() => {
    if (options.length === 0) return null;
    const found = options.find((o) => o.key === selectedKey);
    return found ?? options[0];
  }, [options, selectedKey]);

  const chartData = useMemo(() => {
    if (!active) return [];
    return active.rows
      .filter((r) => r.competition_date && r.result_numeric != null)
      .map((r) => ({
        t: new Date(r.competition_date!).getTime(),
        v: r.result_numeric!,
        row: r,
      }))
      .sort((a, b) => a.t - b.t);
  }, [active]);

  const pb = useMemo(() => {
    if (!active || chartData.length === 0) return null;
    if (active.lowerBetter) {
      return chartData.reduce((m, p) => (p.v < m.v ? p : m), chartData[0]);
    }
    return chartData.reduce((m, p) => (p.v > m.v ? p : m), chartData[0]);
  }, [active, chartData]);

  const [selectedRow, setSelectedRow] = useState<AthleteResultRow | null>(null);

  if (options.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
        <TrendingUp className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Analytiikkaan tarvitaan vähintään kaksi mitattua tulosta samasta lajista.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-muted-foreground">Laji</label>
        <Select
          value={active?.key ?? ""}
          onValueChange={(v) => {
            setSelectedKey(v);
            setSelectedRow(null);
          }}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Valitse laji" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.label} ({o.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Uusimmat kilpailut näkyvät parin tunnin viiveellä.
      </p>

      {active && chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold">{active.label}</h3>
            {pb && (
              <p className="text-[11px] text-muted-foreground">
                PB{" "}
                <span className="font-semibold tabular-nums text-primary">
                  {pb.row.result_text}
                </span>{" "}
                · {fmtDate(pb.row.competition_date)}
              </p>
            )}
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="analyticsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  opacity={0.2}
                  horizontal
                  vertical={false}
                />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  tickFormatter={(t) => fmtDate(new Date(t).toISOString())}
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ opacity: 0.3 }}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  reversed={active.lowerBetter}
                  fontSize={10}
                  width={44}
                  tickLine={false}
                  axisLine={{ opacity: 0.3 }}
                  tickFormatter={(v) => v.toFixed(2)}
                />
                <Tooltip
                  content={({ active: a, payload }) => {
                    if (!a || !payload || payload.length === 0) return null;
                    const p = payload[0].payload as { row: AthleteResultRow };
                    return (
                      <div className="rounded-md border bg-popover p-2 text-xs shadow">
                        <p className="font-semibold">{p.row.result_text}</p>
                        <p className="text-muted-foreground">{p.row.competition_name}</p>
                        <p className="text-muted-foreground">
                          {fmtDate(p.row.competition_date)}
                          {p.row.result_rank ? ` · ${p.row.result_rank}.` : ""}
                          {p.row.wind != null ? ` · tuuli ${p.row.wind}` : ""}
                        </p>
                        <p className="mt-1 text-[10px] italic text-muted-foreground">
                          Klikkaa pistettä nähdäksesi lisää
                        </p>
                      </div>
                    );
                  }}
                />
                {pb && (
                  <ReferenceLine
                    y={pb.v}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="2 4"
                    opacity={0.4}
                  />
                )}
                <Area
                  type="natural"
                  dataKey="v"
                  stroke="none"
                  fill="url(#analyticsArea)"
                  isAnimationActive={false}
                />
                <Line
                  type="natural"
                  dataKey="v"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  isAnimationActive={false}
                  dot={(props) => {
                    const { cx, cy, payload } = props as {
                      cx: number;
                      cy: number;
                      payload: { row: AthleteResultRow };
                    };
                    const isPb = pb?.row.id === payload.row.id;
                    return (
                      <circle
                        key={payload.row.id}
                        cx={cx}
                        cy={cy}
                        r={isPb ? 6 : 3}
                        fill={
                          isPb ? "hsl(var(--primary))" : "hsl(var(--background))"
                        }
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelectedRow(payload.row)}
                      />
                    );
                  }}
                  activeDot={{
                    r: 7,
                    onClick: (_e, payload) => {
                      const p = (payload as unknown as { payload: { row: AthleteResultRow } })
                        .payload;
                      if (p?.row) setSelectedRow(p.row);
                    },
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-xs">
            {[...chartData].reverse().map((p) => (
              <li key={p.row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedRow(p.row)}
                  className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-secondary/50"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {p.row.competition_name}
                    <span className="ml-1 text-muted-foreground">
                      · {fmtDate(p.row.competition_date)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      pb?.row.id === p.row.id ? "text-primary" : ""
                    }`}
                  >
                    {p.row.result_text}
                    {p.row.result_rank && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({p.row.result_rank}.)
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ResultDetailSheet
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        athleteKey={athleteKey}
        notes={notes}
        videos={videos}
        myUserId={myUserId}
        labelMap={labelMap}
      />
    </div>
  );
}

function ResultDetailSheet({
  row,
  onClose,
  athleteKey,
  notes,
  videos,
  myUserId,
  labelMap,
}: {
  row: AthleteResultRow | null;
  onClose: () => void;
  athleteKey: string;
  notes: Map<string, AthleteNote[]> | undefined;
  videos: Map<string, ResultVideo[]> | undefined;
  myUserId: string;
  labelMap?: Map<string, string>;
}) {
  const collected = useMemo(() => {
    if (!row) return { resultNotes: [], eventNotes: [], compNotes: [], videos: [] };
    const rk = noteKey(row.competition_id, row.event_name, row.sub_category ?? "");
    const ek = eventScopeKey(row.event_name, row.sub_category ?? "");
    const ck = competitionScopeKey(row.competition_id);
    const vk = videoKey(row.competition_id, row.event_name, row.sub_category ?? "");
    return {
      resultNotes: notes?.get(rk) ?? [],
      eventNotes: notes?.get(ek) ?? [],
      compNotes: notes?.get(ck) ?? [],
      videos: videos?.get(vk) ?? [],
    };
  }, [row, notes, videos]);

  return (
    <Sheet open={!!row} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-baseline justify-between gap-2 pr-6">
                <span className="truncate">{row.event_name}</span>
                <span className="shrink-0 tabular-nums text-primary">
                  {row.result_text}
                </span>
              </SheetTitle>
              <SheetDescription className="truncate text-left">
                {row.competition_name} · {fmtDate(row.competition_date)}
                {row.result_rank ? ` · ${row.result_rank}.` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <ResultVideoButton
                  athleteKey={athleteKey}
                  competitionId={row.competition_id}
                  eventName={row.event_name}
                  subCategory={row.sub_category ?? ""}
                  videos={collected.videos}
                  contextLabel={`${row.event_name} · ${row.competition_name}`}
                  size="sm"
                />
                {row.event_id > 0 && (
                  <a
                    href={`/round/${row.event_id}/latest`}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary/50"
                  >
                    Avaa laji
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Sulje"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {collected.videos.length > 0 && (
                <div>
                  <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Youtube className="h-3.5 w-3.5" /> Video
                  </h4>
                  <div className="aspect-video overflow-hidden rounded-md bg-black">
                    <iframe
                      src={embedUrl(collected.videos[0].youtube_video_id)}
                      title="YouTube video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                </div>
              )}

              <NoteBlock
                title="Tulosmuistiinpanot"
                notes={collected.resultNotes}
                myUserId={myUserId}
              />
              <NoteBlock
                title="Lajitason muistiinpanot"
                notes={collected.eventNotes}
                myUserId={myUserId}
              />
              <NoteBlock
                title="Kilpailun muistiinpanot"
                notes={collected.compNotes}
                myUserId={myUserId}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NoteBlock({
  title,
  notes,
  myUserId,
}: {
  title: string;
  notes: AthleteNote[];
  myUserId: string;
}) {
  if (notes.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" /> {title}
      </h4>
      <ul className="space-y-1.5">
        {notes.map((n) => (
          <li key={n.id} className="rounded-md border bg-muted/30 p-2 text-xs">
            {n.user_id !== myUserId && (
              <p className="mb-0.5 text-[10px] text-muted-foreground">Tiimiläinen</p>
            )}
            <p className="whitespace-pre-wrap">{n.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
