import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";

import { formatSeconds, type EventGroup } from "@/lib/athlete-history";
import { translateSub } from "@/lib/tuloslista";

const HELSINKI_DATE = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const HELSINKI_SHORT = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  day: "numeric",
  month: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return HELSINKI_DATE.format(new Date(iso));
  } catch {
    return "—";
  }
}

function formatDateShort(ts: number): string {
  try {
    return HELSINKI_SHORT.format(new Date(ts));
  } catch {
    return "";
  }
}

export function EventGroupView({ group }: { group: EventGroup }) {
  const points = useMemo(
    () =>
      group.rows
        .filter((r) => r.result_numeric != null && r.competition_date)
        .map((r) => ({
          id: r.id,
          ts: new Date(r.competition_date!).getTime(),
          value: r.result_numeric!,
          text: r.result_text,
          competition: r.competition_name,
        }))
        .sort((a, b) => a.ts - b.ts),
    [group.rows],
  );

  const formatY = (v: number) =>
    group.category === "Track" ? formatSeconds(v) : v.toFixed(2);

  const enriched = useMemo(() => {
    let best: number | null = null;
    return points.map((p) => {
      const isPb =
        best == null || (group.lowerBetter ? p.value < best : p.value > best);
      if (isPb) best = p.value;
      return { ...p, pb: best!, isPb };
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
        <p className="text-[11px] text-muted-foreground">
          {group.rows.length} tulosta
        </p>
      </div>

      {enriched.length >= 2 ? (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={enriched}
              margin={{ top: 22, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatDateShort}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <YAxis
                domain={["auto", "auto"]}
                reversed={group.lowerBetter}
                tickFormatter={formatY}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
                labelFormatter={(t) =>
                  formatDate(new Date(Number(t)).toISOString())
                }
                formatter={(_v: number, _n: string, p: { payload: { text: string; competition: string } }) => [
                  p.payload.text,
                  p.payload.competition,
                ]}
              />
              {/* PB-kehitys korostuksena (askelviiva) */}
              <Line
                type="stepAfter"
                dataKey="pb"
                stroke="hsl(var(--primary) / 0.4)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              {/* Tulosviiva: PB-pisteet isompina ja primary-värisinä */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--foreground))"
                strokeWidth={1.5}
                isAnimationActive={false}
                dot={(props: {
                  cx?: number;
                  cy?: number;
                  index?: number;
                  payload?: { isPb?: boolean };
                }) => {
                  const { cx, cy, payload, index } = props;
                  const pb = !!payload?.isPb;
                  return (
                    <circle
                      key={`d-${index}`}
                      cx={cx}
                      cy={cy}
                      r={pb ? 5 : 3}
                      fill={pb ? "hsl(var(--primary))" : "hsl(var(--background))"}
                      stroke={pb ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                      strokeWidth={pb ? 2 : 1.5}
                    />
                  );
                }}
              >
                <LabelList
                  dataKey="text"
                  position="top"
                  offset={8}
                  style={{
                    fontSize: 10,
                    fill: "hsl(var(--foreground))",
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : enriched.length === 1 ? (
        <p className="text-[11px] text-muted-foreground">
          Vain yksi tulos — graafiin tarvitaan vähintään kaksi.
        </p>
      ) : null}

      <ul className="mt-3 divide-y divide-border text-xs">
        {group.rows
          .slice()
          .sort((a, b) =>
            (b.competition_date ?? "").localeCompare(a.competition_date ?? ""),
          )
          .map((r) => (
            <li
              key={r.id}
              className="flex items-baseline justify-between gap-2 py-1"
            >
              <span className="min-w-0 truncate text-muted-foreground">
                {r.competition_name} · {formatDate(r.competition_date)}
              </span>
              <span className="shrink-0 tabular-nums font-medium">
                {r.result_text}
                {r.result_rank != null && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({r.result_rank}.)
                  </span>
                )}
              </span>
            </li>
          ))}
      </ul>
    </li>
  );
}
