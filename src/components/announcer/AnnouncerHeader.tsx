import { Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/lahden-ahkera-logo.png";
import { pad } from "./shared";
import type { AnnouncerData } from "@/hooks/useAnnouncerData";
import { WakeLockToggle } from "@/components/WakeLockToggle";

export type AnnouncerMode = "combined" | "live" | "planning";

const MODE_META: Record<AnnouncerMode, { label: string; tone: string }> = {
  combined: {
    label: "YHDISTETTY",
    tone: "bg-primary/15 text-primary border-primary/40",
  },
  live: {
    label: "LIVE",
    tone: "bg-red-500/15 text-red-700 border-red-500/40 dark:text-red-300",
  },
  planning: {
    label: "SUUNNITTELU",
    tone: "bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-300",
  },
};

export function AnnouncerHeader({
  data,
  mode,
}: {
  data: AnnouncerData;
  mode: AnnouncerMode;
}) {
  const {
    name,
    competitionId,
    todayKey,
    updatedAt,
    now,
    inProgressVisible,
    completedVisible,
    reload,
    manualLoading,
  } = data;
  const meta = MODE_META[mode];
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-3">
        <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <img
          src={logo}
          alt="Lahden Ahkera"
          className="h-14 w-14 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold leading-tight">
              {name || `Kisa #${competitionId}`}
            </h1>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${meta.tone}`}
            >
              {meta.label}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {todayKey}
            {updatedAt &&
              now &&
              ` · päivitetty ${pad(updatedAt.getHours())}:${pad(updatedAt.getMinutes())}:${pad(updatedAt.getSeconds())}`}
          </p>
        </div>
        <div className="text-right" suppressHydrationWarning>
          <div className="text-3xl font-black tabular-nums leading-none">
            {now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : "--:--"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {inProgressVisible.length} käynnissä · {completedVisible.length} valmis
          </div>
        </div>
        <WakeLockToggle className="hidden sm:inline-flex" />
        <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
          <Link to="/announcer" search={{ pick: 1 }}>
            <LayoutGrid className="h-4 w-4" />
            Vaihda moodia
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label="Vaihda moodia"
          className="sm:hidden"
        >
          <Link to="/announcer" search={{ pick: 1 }}>
            <LayoutGrid className="h-5 w-5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={reload} aria-label="Päivitä">
          <RefreshCw className={`h-5 w-5 ${manualLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </header>
  );
}
