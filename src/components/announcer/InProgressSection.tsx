import { Activity } from "lucide-react";
import { EventCard, EmptyCard, SectionTitle } from "./shared";
import type { AnnouncerData } from "@/hooks/useAnnouncerData";

export function InProgressSection({
  data,
  layout = "grid",
}: {
  data: AnnouncerData;
  layout?: "grid" | "wide";
}) {
  const { inProgressVisible, showRunning, setShowRunning, details, expanded, toggleExpand } =
    data;
  const isWide = layout === "wide";

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
        <div className={isWide ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
          {inProgressVisible.map((r) => (
            <EventCard
              key={r.Id}
              round={r}
              detail={details[r.EventId]}
              live
              open={isWide ? true : expanded.has(r.EventId)}
              onToggle={isWide ? undefined : () => toggleExpand(r.EventId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
