import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAnnouncerData, type AnnouncerData } from "@/hooks/useAnnouncerData";
import { AnnouncerHeader } from "@/components/announcer/AnnouncerHeader";
import { RecordsBanner } from "@/components/announcer/RecordsBanner";
import { InProgressSection } from "@/components/announcer/InProgressSection";
import { CompletedSection } from "@/components/announcer/CompletedSection";
import { UpcomingSection } from "@/components/announcer/UpcomingSection";
import { LiveTicker } from "@/components/announcer/LiveTicker";
import { AnnouncerLayoutControls } from "@/components/announcer/AnnouncerLayoutControls";
import { useFieldLeaderChanges } from "@/hooks/useFieldLeaderChanges";
import {
  useAnnouncerViewLayout,
  type AnnouncerColumnConfig,
} from "@/lib/announcer-layout-store";

export const Route = createFileRoute("/announcer/combined")({
  component: AnnouncerCombined,
});

function AnnouncerCombined() {
  const data = useAnnouncerData();
  useFieldLeaderChanges(data.details);
  const [layout] = useAnnouncerViewLayout("combined");

  const visibleCols = layout.columns.filter((c) => {
    if (!c.visible) return false;
    // Älä varaa saraketilaa tyhjälle Käynnissä-osiolle.
    if (c.id === "in_progress" && data.inProgressVisible.length === 0) return false;
    return true;
  });
  const rows: AnnouncerColumnConfig[][] = [];
  for (let i = 0; i < visibleCols.length; i += layout.columnsPerRow) {
    rows.push(visibleCols.slice(i, i + layout.columnsPerRow));
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <AnnouncerHeader data={data} mode="combined" />
      <RecordsBanner data={data} variant="compact" />
      <main
        className="mx-auto px-4 py-6 sm:px-6"
        style={{ maxWidth: `${layout.maxWidth}px` }}
      >
        <div className="mb-4 flex justify-end">
          <AnnouncerLayoutControls view="combined" showLiveControls />
        </div>
        {visibleCols.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Ei näytettäviä osioita. Avaa "Asettelu" ja valitse vähintään yksi.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-6 lg:hidden">
              {visibleCols.map((c) => (
                <ColumnRenderer key={c.id} id={c.id} data={data} layout={layout} />
              ))}
            </div>
            <div className="hidden flex-col gap-6 lg:flex">
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid gap-6"
                  style={{
                    gridTemplateColumns: row.map((c) => `${c.width}fr`).join(" "),
                  }}
                >
                  {row.map((c) => (
                    <ColumnRenderer key={c.id} id={c.id} data={data} layout={layout} />
                  ))}
                </div>
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
  layout,
}: {
  id: "in_progress" | "completed" | "upcoming";
  data: AnnouncerData;
  layout: ReturnType<typeof useAnnouncerViewLayout>[0];
}): ReactNode {
  if (id === "in_progress") {
    return (
      <InProgressSection
        data={data}
        layout="grid"
        columns={layout.liveColumns}
        limit={layout.liveLimit}
        defaultOpen={layout.liveDefaultOpen}
      />
    );
  }
  if (id === "completed") return <CompletedSection data={data} columns={1} />;
  return <UpcomingSection data={data} limit={20} />;
}
