import { createFileRoute } from "@tanstack/react-router";
import { useAnnouncerData } from "@/hooks/useAnnouncerData";
import { AnnouncerHeader } from "@/components/announcer/AnnouncerHeader";
import { RecordsBanner } from "@/components/announcer/RecordsBanner";
import { InProgressSection } from "@/components/announcer/InProgressSection";
import { CompletedSection } from "@/components/announcer/CompletedSection";
import { UpcomingSection } from "@/components/announcer/UpcomingSection";
import { LiveTicker } from "@/components/announcer/LiveTicker";
import { useFieldLeaderChanges } from "@/hooks/useFieldLeaderChanges";

export const Route = createFileRoute("/announcer/combined")({
  component: AnnouncerCombined,
});

function AnnouncerCombined() {
  const data = useAnnouncerData();
  useFieldLeaderChanges(data.details);
    <div className="min-h-screen bg-background text-foreground">
      <AnnouncerHeader data={data} mode="combined" />
      <RecordsBanner data={data} variant="compact" />
      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <InProgressSection data={data} layout="grid" />
            <CompletedSection data={data} columns={2} />
          </div>
          <aside>
            <UpcomingSection data={data} limit={20} />
          </aside>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · automaattinen päivitys 15&nbsp;s välein
        </p>
      </main>
    </div>
  );
}
