import { Clock } from "lucide-react";
import { EmptyCard, SectionTitle, UpcomingItem } from "./shared";
import type { AnnouncerData } from "@/hooks/useAnnouncerData";

export function UpcomingSection({
  data,
  limit = 20,
}: {
  data: AnnouncerData;
  limit?: number | "all";
}) {
  const {
    upcomingFiltered,
    pastUpcomingCount,
    showPastUpcoming,
    setShowPastUpcoming,
    details,
    expanded,
    toggleExpand,
  } = data;

  const upcoming =
    limit === "all" ? upcomingFiltered : upcomingFiltered.slice(0, limit);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle
          icon={<Clock className="h-4 w-4" />}
          title="Seuraavaksi"
          count={upcoming.length}
        />
        <button
          onClick={() => setShowPastUpcoming(!showPastUpcoming)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            showPastUpcoming
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-secondary"
          }`}
        >
          {showPastUpcoming
            ? "Piilota menneet"
            : `Näytä menneet${pastUpcomingCount > 0 ? ` (${pastUpcomingCount})` : ""}`}
        </button>
      </div>
      {upcoming.length === 0 ? (
        <EmptyCard
          text={
            pastUpcomingCount > 0
              ? "Ei enää tulevia lajeja. Paina ”Näytä menneet”."
              : "Ei tulevia lajeja tänään."
          }
        />
      ) : (
        <ul className="space-y-2">
          {upcoming.map((r) => (
            <UpcomingItem
              key={r.Id}
              round={r}
              detail={details[r.EventId]}
              open={expanded.has(r.EventId)}
              onToggle={() => toggleExpand(r.EventId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
