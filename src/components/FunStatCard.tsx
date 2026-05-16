import { Link } from "@tanstack/react-router";
import type { FunEntry, FunMetricDef } from "@/lib/fun-stats";

interface Props {
  def: FunMetricDef;
  entries: FunEntry[];
}

export function FunStatCard({ def, entries }: Props) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-start gap-3">
        <div className="text-3xl leading-none">{def.emoji}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight">{def.title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
            {def.description}
          </p>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-md bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
          Ei vielä dataa tällä kaudella
        </div>
      ) : (
        <ol className="space-y-1">
          {entries.map((e, i) => {
            const top = i === 0;
            return (
              <li
                key={e.athleteKey + i}
                className={`flex items-baseline gap-2 rounded-md px-2 py-1.5 ${
                  top
                    ? "bg-amber-50 dark:bg-amber-950/40"
                    : "hover:bg-secondary/60"
                }`}
              >
                <span
                  className={`w-5 shrink-0 text-center text-xs font-bold ${
                    top ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                  }`}
                >
                  {i + 1}.
                </span>
                <Link
                  to="/athlete/$key"
                  params={{ key: e.athleteKey }}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                  title={e.organization}
                >
                  <span className={top ? "font-semibold" : ""}>{e.name}</span>
                </Link>
                <span
                  className={`shrink-0 text-xs tabular-nums ${
                    top ? "font-bold text-amber-700 dark:text-amber-300" : "text-muted-foreground"
                  }`}
                >
                  {def.format(e.value, e.extra)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
