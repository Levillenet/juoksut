import { useState } from "react";
import { Star } from "lucide-react";
import { formatImprovement, RecordStar } from "@/lib/records";
import type { AnnouncerData } from "@/hooks/useAnnouncerData";

const VISIBLE_RECORDS = 3;

export function RecordsBanner({
  data,
  variant = "compact",
}: {
  data: AnnouncerData;
  variant?: "compact" | "full";
}) {
  const { filteredRecords, recordAlerts, includeSB, setIncludeSB, clearRecords } = data;
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(variant === "full");
  const showAll = variant === "full" || expanded;

  const visible = showAll ? filteredRecords : filteredRecords.slice(0, VISIBLE_RECORDS);

  return (
    <div className="sticky top-[68px] z-10 border-b border-yellow-400/40 bg-yellow-50/95 backdrop-blur dark:bg-yellow-950/60">
      <div className="mx-auto max-w-[1600px] px-6 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest">
              Uudet ennätykset
            </h2>
            <span className="rounded-full bg-yellow-400/30 px-2 py-0.5 text-xs font-semibold">
              {filteredRecords.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!collapsed && (
              <div className="mr-1 flex gap-1 rounded-full border border-border bg-card p-1 text-xs font-medium">
                <button
                  onClick={() => setIncludeSB(false)}
                  className={`rounded-full px-3 py-0.5 transition-colors ${
                    !includeSB
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Vain PB
                </button>
                <button
                  onClick={() => setIncludeSB(true)}
                  className={`rounded-full px-3 py-0.5 transition-colors ${
                    includeSB
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  PB + SB
                </button>
              </div>
            )}
            {variant === "compact" &&
              filteredRecords.length > VISIBLE_RECORDS &&
              !collapsed && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="rounded-full border border-yellow-400/60 bg-card px-3 py-1 text-xs font-medium hover:bg-secondary"
                >
                  {expanded
                    ? "Näytä vain 3"
                    : `Näytä kaikki (${filteredRecords.length})`}
                </button>
              )}
            {recordAlerts.length > 0 && !collapsed && (
              <button
                onClick={clearRecords}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
              >
                Tyhjennä
              </button>
            )}
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-secondary"
              aria-label={collapsed ? "Näytä ennätykset" : "Pienennä"}
            >
              {collapsed ? "Avaa" : "Pienennä"}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="mt-2 space-y-2">
            {filteredRecords.length === 0 ? (
              <p className="rounded-lg border border-dashed border-yellow-400/40 bg-card/60 px-4 py-3 text-center text-xs text-muted-foreground">
                Ei vielä uusia {includeSB ? "PB- tai SB-" : "PB-"}ennätyksiä tänään.
              </p>
            ) : (
              visible.map((a) => {
                const imp = formatImprovement(a.category, a.result, a.previous);
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 rounded-lg border border-yellow-400/60 bg-card px-4 py-2 shadow-sm"
                  >
                    <RecordStar kind={a.kind} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold leading-tight">
                        {a.athleteName}
                        {a.organization && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {a.organization}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.eventName} · uusi{" "}
                        {a.kind === "PB" ? "henkilökohtainen" : "kauden"} ennätys
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black tabular-nums leading-none text-primary">
                        {a.result}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {a.previous ? `ed. ${a.previous}` : "ensimmäinen tulos"}
                      </div>
                    </div>
                    {imp && (
                      <div className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-1 text-right">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          Parannus
                        </div>
                        <div className="text-sm font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                          {imp}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
