import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Award, ChevronDown, ChevronUp } from "lucide-react";
import { fetchRecentDistrictRecordBreaks } from "@/lib/district-records";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("fi-FI", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function DistrictRecordsSection() {
  const [open, setOpen] = useState(true);
  const query = useQuery({
    queryKey: ["district-record-breaks", "recent"],
    queryFn: () => fetchRecentDistrictRecordBreaks(8),
    staleTime: 5 * 60_000,
  });

  const breaks = query.data ?? [];
  if (!query.isLoading && breaks.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl border-2 border-emerald-500/30 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h2 className="flex-1 text-sm font-bold">Lahden piirin piiriennätykset</h2>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          {query.isLoading ? (
            <p className="text-xs text-muted-foreground">Ladataan…</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Uusimmat rikotut piiriennätykset (viimeiseltä 5 vuodelta):
              </p>
              <ul className="divide-y divide-border rounded-lg border bg-background/50">
                {breaks.map((b) => (
                  <li key={b.id} className="flex items-baseline gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        <Link
                          to="/athlete/$key"
                          params={{ key: b.athlete_key }}
                          className="hover:underline"
                        >
                          {b.new_holder}
                        </Link>
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {b.event_pb_key} · {b.age_class} · {b.new_club}
                      </p>
                      {b.previous_holder && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          ed. {b.previous_holder}
                          {b.previous_year ? ` (${b.previous_year})` : ""}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDate(b.competition_date)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-center">
                <Link
                  to="/piirienn"
                  className="inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                >
                  Katso kaikki piiriennätykset →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
