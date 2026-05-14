import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { formatSeconds, type EventGroup } from "@/lib/athlete-history";
import { translateSub } from "@/lib/tuloslista";

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
        <p className="text-[11px] text-muted-foreground">
          {group.rows.length} tulosta
        </p>
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
