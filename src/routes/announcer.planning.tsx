import { createFileRoute } from "@tanstack/react-router";
import { useAnnouncerData } from "@/hooks/useAnnouncerData";
import { useWakeLock } from "@/hooks/useWakeLock";
import { AnnouncerHeader } from "@/components/announcer/AnnouncerHeader";
import { UpcomingSection } from "@/components/announcer/UpcomingSection";
import { CompletedSection } from "@/components/announcer/CompletedSection";

export const Route = createFileRoute("/announcer/planning")({
  component: AnnouncerPlanning,
});

function AnnouncerPlanning() {
  useWakeLock();
  const data = useAnnouncerData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnnouncerHeader data={data} mode="planning" />
      <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-6 sm:px-6">
        <UpcomingSection data={data} limit="all" />
        <CompletedSection data={data} columns={1} />
        <p className="text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · automaattinen päivitys 15&nbsp;s välein
        </p>
      </main>
    </div>
  );
}
