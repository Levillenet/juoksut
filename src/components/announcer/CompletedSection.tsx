import { Trophy } from "lucide-react";
import { EmptyCard, SectionTitle, UpcomingItem } from "./shared";
import type { AnnouncerData } from "@/hooks/useAnnouncerData";

export function CompletedSection({
  data,
  columns = 2,
}: {
  data: AnnouncerData;
  columns?: 1 | 2;
}) {
  const {
    completedAllMerged,
    completedVisible,
    dismissedCompletedIds,
    dismissCompleted,
    restoreDismissed,
    details,
  } = data;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle
          icon={<Trophy className="h-4 w-4" />}
          title="Lopputulokset"
          count={completedAllMerged.length}
        />
        {dismissedCompletedIds.size > 0 && (
          <button
            onClick={restoreDismissed}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            Palauta piilotetut ({dismissedCompletedIds.size})
          </button>
        )}
      </div>
      {completedAllMerged.length === 0 ? (
        <EmptyCard text="Ei julkaistuja lopputuloksia vielä." />
      ) : completedVisible.length === 0 ? (
        <EmptyCard text="Kaikki lopputulokset merkitty luetuiksi." />
      ) : (
        <ul
          className={`grid gap-2 ${columns === 2 ? "md:grid-cols-2" : ""}`}
        >
          {completedVisible.map((r) => (
            <UpcomingItem
              key={r.Id}
              round={r}
              detail={details[r.EventId]}
              groupHeats={false}
              defaultOpen
              onDismiss={() => dismissCompleted(r.Id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
