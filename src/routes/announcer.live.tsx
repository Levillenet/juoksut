import { createFileRoute } from "@tanstack/react-router";
import { useAnnouncerData } from "@/hooks/useAnnouncerData";
import { AnnouncerHeader } from "@/components/announcer/AnnouncerHeader";
import { RecordsBanner } from "@/components/announcer/RecordsBanner";
import { InProgressSection } from "@/components/announcer/InProgressSection";
import { LiveTicker } from "@/components/announcer/LiveTicker";
import { useFieldLeaderChanges } from "@/hooks/useFieldLeaderChanges";

export const Route = createFileRoute("/announcer/live")({
  component: AnnouncerLive,
});

function AnnouncerLive() {
  const data = useAnnouncerData();
  useFieldLeaderChanges(data.details);
  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <AnnouncerHeader data={data} mode="live" />
      <RecordsBanner data={data} variant="compact" />
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <InProgressSection data={data} layout="wide" />
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · automaattinen päivitys 15&nbsp;s välein
        </p>
      </main>
      <LiveTicker />
    </div>
  );
}
