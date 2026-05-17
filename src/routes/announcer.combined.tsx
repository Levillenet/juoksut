import { createFileRoute } from "@tanstack/react-router";
import { useAnnouncerData } from "@/hooks/useAnnouncerData";
import { AnnouncerHeader } from "@/components/announcer/AnnouncerHeader";
import { RecordsBanner } from "@/components/announcer/RecordsBanner";
import { InProgressSection } from "@/components/announcer/InProgressSection";
import { CompletedSection } from "@/components/announcer/CompletedSection";
import { UpcomingSection } from "@/components/announcer/UpcomingSection";
import { LiveTicker } from "@/components/announcer/LiveTicker";
import { AnnouncerLayoutControls } from "@/components/announcer/AnnouncerLayoutControls";
import { useFieldLeaderChanges } from "@/hooks/useFieldLeaderChanges";
import { useAnnouncerLayout } from "@/lib/announcer-layout-store";

export const Route = createFileRoute("/announcer/combined")({
  component: AnnouncerCombined,
});

function AnnouncerCombined() {
  const data = useAnnouncerData();
  useFieldLeaderChanges(data.details);
  const [layout] = useAnnouncerLayout();

  const visibleCols = layout.columns.filter((c) => c.visible);
  const gridTemplate = visibleCols.map((c) => `${c.width}fr`).join(" ");

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <AnnouncerHeader data={data} mode="combined" />
      <RecordsBanner data={data} variant="compact" />
      <main
        className="mx-auto px-4 py-6 sm:px-6"
        style={{ maxWidth: `${layout.maxWidth}px` }}
      >
        <div className="mb-4 flex justify-end">
          <AnnouncerLayoutControls />
        </div>
        {visibleCols.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Ei näytettäviä sarakkeita. Avaa "Asettelu" ja valitse vähintään yksi.
          </p>
        ) : (
          <>
            {/* Mobile: stacked */}
            <div className="flex flex-col gap-6 lg:hidden">
              {visibleCols.map((c) => (
                <ColumnRenderer key={c.id} id={c.id} data={data} />
              ))}
            </div>
            {/* Desktop: user-configured ratios */}
            <div
              className="hidden gap-6 lg:grid"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {visibleCols.map((c) => (
                <ColumnRenderer key={c.id} id={c.id} data={data} />
              ))}
            </div>
          </>
        )}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com · automaattinen päivitys 15&nbsp;s välein
        </p>
      </main>
      <LiveTicker source="announcer" />
    </div>
  );
}

function ColumnRenderer({
  id,
  data,
}: {
  id: "in_progress" | "completed" | "upcoming";
  data: ReturnType<typeof useAnnouncerData>;
}) {
  if (id === "in_progress") return <InProgressSection data={data} layout="grid" />;
  if (id === "completed") return <CompletedSection data={data} columns={1} />;
  return <UpcomingSection data={data} limit={20} />;
}
