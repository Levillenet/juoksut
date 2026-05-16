import { createFileRoute } from "@tanstack/react-router";
import { useAnnouncerData } from "@/hooks/useAnnouncerData";
import { AnnouncerHeader } from "@/components/announcer/AnnouncerHeader";
import { UpcomingSection } from "@/components/announcer/UpcomingSection";
import { CompletedSection } from "@/components/announcer/CompletedSection";
import { LiveTicker } from "@/components/announcer/LiveTicker";
import { useFieldLeaderChanges } from "@/hooks/useFieldLeaderChanges";

export const Route = createFileRoute("/announcer/planning")({
  component: AnnouncerPlanning,
});

function AnnouncerPlanning() {
  const data = useAnnouncerData();
  useFieldLeaderChanges(data.details);
  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <AnnouncerHeader data={data} mode="planning" />
      <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-6 sm:px-6">
        <UpcomingSection data={data} limit="all" />
        <CompletedSection data={data} columns={1} />
        <p className="text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · automaattinen päivitys 15&nbsp;s välein
        </p>
      </main>
      <LiveTicker />
    </div>
  );
}
