import { Activity } from "lucide-react";
import { EventCard, EmptyCard, SectionTitle } from "./shared";
import type { AnnouncerData } from "@/hooks/useAnnouncerData";

export function InProgressSection({
  data,
  layout = "grid",
  columns,
  limit = "all",
  defaultOpen = false,
}: {
  data: AnnouncerData;
  layout?: "grid" | "wide";
  /** Override column count. Defaults: wide=1, grid=2. */
  columns?: 1 | 2 | 3;
  /** Max ranked rows per event card; "all" = show all when open. */
  limit?: 5 | 10 | "all";
  /** When true, all event cards are expanded by default. */
  defaultOpen?: boolean;
}) {
  const { inProgressVisible, showRunning, setShowRunning, details, expanded, toggleExpand } =
    data;
  const cols = columns ?? (layout === "wide" ? 1 : 2);

  const gridClass =
    cols === 1
      ? "grid gap-4"
      : cols === 2
        ? "grid gap-4 md:grid-cols-2"
        : "grid gap-4 md:grid-cols-2 xl:grid-cols-3";

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <SectionTitle
          icon={<Activity className="h-4 w-4" />}
          title="Käynnissä"
          count={inProgressVisible.length}
        />
        <div className="ml-auto flex shrink-0 gap-0.5 rounded-full border border-border bg-card p-0.5 text-[11px] font-medium">
          <button
            onClick={() => setShowRunning(false)}
            title="Näytä vain kenttälajit"
            className={`rounded-full px-2 py-0.5 transition-colors ${
              !showRunning
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Kenttä
          </button>
          <button
            onClick={() => setShowRunning(true)}
            title="Näytä kaikki lajit"
            className={`rounded-full px-2 py-0.5 transition-colors ${
              showRunning
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Kaikki
          </button>
        </div>
      </div>
      {inProgressVisible.length === 0 ? (
        <EmptyCard
          text={
            showRunning ? "Ei käynnissä olevia lajeja." : "Ei käynnissä olevia kenttälajeja."
          }
        />
      ) : (
        <div className={gridClass}>
          {inProgressVisible.map((r) => {
            const open = defaultOpen ? true : expanded.has(r.EventId);
            return (
              <EventCard
                key={r.Id}
                round={r}
                detail={details[r.EventId]}
                live
                open={open}
                rankLimit={limit}
                onToggle={defaultOpen ? undefined : () => toggleExpand(r.EventId)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
