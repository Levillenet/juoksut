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
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle
          icon={<Activity className="h-4 w-4" />}
          title="Käynnissä"
          count={inProgressVisible.length}
        />
        <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-xs font-medium">
          <button
            onClick={() => setShowRunning(false)}
            className={`rounded-full px-3 py-1 transition-colors ${
              !showRunning
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Kenttälajit
          </button>
          <button
            onClick={() => setShowRunning(true)}
            className={`rounded-full px-3 py-1 transition-colors ${
              showRunning
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Kaikki lajit
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
            const isOpen = defaultOpen ? !expanded.has(r.EventId) ? true : true : expanded.has(r.EventId);
            // Simpler: when defaultOpen, treat open=true unless user explicitly collapsed.
            // For now: defaultOpen forces open and disables individual toggle.
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
