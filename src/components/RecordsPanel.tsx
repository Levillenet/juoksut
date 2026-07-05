import { useMemo } from "react";
import { Trophy } from "lucide-react";

import { type EventGroup, isIndoorResult } from "@/lib/athlete-history";
import { translateSub } from "@/lib/tuloslista";

const HELSINKI_DATE = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const HELSINKI_DATE_SHORT = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  day: "numeric",
  month: "numeric",
  year: "2-digit",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return HELSINKI_DATE.format(new Date(iso));
  } catch {
    return "—";
  }
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  try {
    return HELSINKI_DATE_SHORT.format(new Date(iso));
  } catch {
    return "—";
  }
}

export function EventGroupView({ group, footer }: { group: EventGroup; footer?: React.ReactNode }) {
  // Tulokset uusin ensin, PB-tieto rivikohtaisesti laskettuna oikein
  // (ei luoteta was_pb-kenttään, koska se voi olla ikäluokkakohtainen).
  const rows = useMemo(() => {
    const sortedAsc = [...group.rows].sort((a, b) =>
      (a.competition_date ?? "").localeCompare(b.competition_date ?? ""),
    );
    let best: number | null = null;
    let bestIn: number | null = null;
    let bestOut: number | null = null;
    const cmp = (n: number, b: number | null) =>
      b == null || (group.lowerBetter ? n < b : n > b);
    const withPb = sortedAsc.map((r) => {
      let isPb = false;
      let isPbIn = false;
      let isPbOut = false;
      const indoor = isIndoorResult(r);
      if (r.result_numeric != null) {
        if (cmp(r.result_numeric, best)) {
          best = r.result_numeric;
          isPb = true;
        }
        if (indoor === true && cmp(r.result_numeric, bestIn)) {
          bestIn = r.result_numeric;
          isPbIn = true;
        } else if (indoor === false && cmp(r.result_numeric, bestOut)) {
          bestOut = r.result_numeric;
          isPbOut = true;
        }
      }
      return { row: r, isPb, isPbIn, isPbOut, indoor };
    });
    return withPb.reverse();
  }, [group.rows, group.lowerBetter]);

  const pbInText = group.pbIndoor?.result_text;
  const pbOutText = group.pbOutdoor?.result_text;
  const pbValueText = group.pb?.result_text ?? "—";

  return (
    <li className="overflow-hidden rounded-lg border bg-card">
      {/* Otsikko + PB-rivi */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{group.eventName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            PB
          </span>
          <span className="text-sm font-bold tabular-nums">{pbValueText}</span>
          {pbInText && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
              Halli <span className="tabular-nums">{pbInText}</span>
            </span>
          )}
          {pbOutText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              Ulko <span className="tabular-nums">{pbOutText}</span>
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            · {rows.length} tulosta
          </span>
        </div>
      </div>

      {/* Taulukko */}
      <div className="sm:overflow-x-auto">
        <table className="w-full table-fixed text-xs sm:table-auto">
          <thead className="bg-background/60 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-[62px] px-2 py-1.5 text-left font-medium sm:w-auto sm:px-3">Pvm</th>
              <th className="px-2 py-1.5 text-left font-medium sm:px-3">Kilpailu</th>
              <th className="w-[96px] px-2 py-1.5 text-right font-medium sm:w-auto sm:px-3">Tulos</th>
              <th className="hidden px-3 py-1.5 text-right font-medium sm:table-cell">Sija</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, isPb, isPbIn, isPbOut, indoor }) => (
              <tr
                key={row.id}
                className={`border-t border-border/60 ${
                  isPb ? "bg-primary/5" : ""
                }`}
              >
                <td className="px-2 py-1.5 align-top tabular-nums text-muted-foreground sm:whitespace-nowrap sm:px-3">
                  <span className="sm:hidden">{formatDateShort(row.competition_date)}</span>
                  <span className="hidden sm:inline">{formatDate(row.competition_date)}</span>
                </td>
                <td className="min-w-0 px-2 py-1.5 align-top sm:px-3">
                  <span className="block break-words sm:truncate">
                    {row.competition_name}
                    {indoor != null && (
                      <span
                        title={indoor ? "Hallikilpailu" : "Ulkokilpailu"}
                        className={`ml-1 inline-block rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          indoor
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {indoor ? "Halli" : "Ulko"}
                      </span>
                    )}
                  </span>
                  {row.location && (
                    <span className="block break-words text-[10px] text-muted-foreground sm:truncate">
                      {row.location}
                    </span>
                  )}
                </td>
                <td className="w-[96px] px-2 py-1.5 text-right align-top tabular-nums sm:w-px sm:whitespace-nowrap sm:px-3">
                  <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:justify-end sm:gap-1">
                    <span
                      className={`whitespace-nowrap font-semibold ${
                        isPb ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {row.result_text}
                    </span>
                    {isPb && (
                      <span
                        title="Henkilökohtainen ennätys (kaikki ikäluokat)"
                        className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary"
                      >
                        <Trophy className="h-2.5 w-2.5" />
                        PB
                      </span>
                    )}
                    {!isPb && isPbIn && (
                      <span
                        title="Hallikauden ennätys"
                        className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300"
                      >
                        Halli-PB
                      </span>
                    )}
                    {!isPb && isPbOut && (
                      <span
                        title="Ulkokauden ennätys"
                        className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
                      >
                        Ulko-PB
                      </span>
                    )}
                    {row.wind != null && (
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {row.wind > 0 ? `+${row.wind.toFixed(1)}` : row.wind.toFixed(1)} m/s
                      </span>
                    )}
                    {row.result_rank != null && (
                      <span className="text-[10px] text-muted-foreground sm:hidden">
                        · {row.result_rank}.
                      </span>
                    )}
                  </div>
                </td>
                <td className="hidden w-px whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground sm:table-cell">
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
      {footer && <div className="border-t bg-background/40 px-3 py-2">{footer}</div>}
    </li>
  );
}
