import { useMemo } from "react";
import { Trophy } from "lucide-react";

import { type EventGroup } from "@/lib/athlete-history";
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
  // Tulokset uusin ensin, PB-tieto rivikohtaisesti laskettuna oikein
  // (ei luoteta was_pb-kenttään, koska se voi olla ikäluokkakohtainen).
  const rows = useMemo(() => {
    const sortedAsc = [...group.rows].sort((a, b) =>
      (a.competition_date ?? "").localeCompare(b.competition_date ?? ""),
    );
    let best: number | null = null;
    const withPb = sortedAsc.map((r) => {
      let isPb = false;
      if (r.result_numeric != null) {
        if (
          best == null ||
          (group.lowerBetter ? r.result_numeric < best : r.result_numeric > best)
        ) {
          best = r.result_numeric;
          isPb = true;
        }
      }
      return { row: r, isPb };
    });
    return withPb.reverse(); // uusin ensin näyttöön
  }, [group.rows, group.lowerBetter]);

  const pbValueText = group.pb?.result_text ?? "—";

  return (
    <li className="overflow-hidden rounded-lg border bg-card">
      {/* Otsikko + PB-rivi */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{group.eventName}</p>
          {group.subCategory && (
            <p className="truncate text-[11px] text-muted-foreground">
              {translateSub(group.subCategory)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            PB
          </span>
          <span className="text-sm font-bold tabular-nums">{pbValueText}</span>
          <span className="text-[10px] text-muted-foreground">
            · {rows.length} tulosta
          </span>
        </div>
      </div>

      {/* Taulukko */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-background/60 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Pvm</th>
              <th className="px-3 py-1.5 text-left font-medium">Kilpailu</th>
              <th className="px-3 py-1.5 text-right font-medium">Tulos</th>
              <th className="px-3 py-1.5 text-right font-medium">Sija</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, isPb }) => (
              <tr
                key={row.id}
                className={`border-t border-border/60 ${
                  isPb ? "bg-primary/5" : ""
                }`}
              >
                <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-muted-foreground">
                  {formatDate(row.competition_date)}
                </td>
                <td className="px-3 py-1.5">
                  <span className="block truncate">{row.competition_name}</span>
                  {row.location && (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {row.location}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                  <span
                    className={`font-semibold ${
                      isPb ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {row.result_text}
                  </span>
                  {isPb && (
                    <span
                      title="Henkilökohtainen ennätys (kaikki ikäluokat)"
                      className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary"
                    >
                      <Trophy className="h-2.5 w-2.5" />
                      PB
                    </span>
                  )}
                  {row.wind != null && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {row.wind > 0 ? `+${row.wind.toFixed(1)}` : row.wind.toFixed(1)} m/s
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {row.result_rank != null ? `${row.result_rank}.` : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Ei tuloksia
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </li>
  );
}
