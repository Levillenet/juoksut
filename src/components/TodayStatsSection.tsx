import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Trophy, Users, Medal, Flame } from "lucide-react";

import { fetchTodayStats } from "@/lib/today-stats";

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = shown;
    startRef.current = null;
    const target = value;
    const from = fromRef.current;
    const duration = 800;
    let raf = 0;
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className="tabular-nums">{shown}</span>;
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  accent?: string;
}

function StatTile({ icon, label, value, loading, accent }: StatTileProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-2 py-3 text-center shadow-sm">
      <div className={`mb-1 ${accent ?? "text-primary"}`}>{icon}</div>
      <div className="text-2xl font-black leading-none tracking-tight">
        {loading ? <span className="text-muted-foreground">–</span> : <CountUp value={value} />}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </div>
    </div>
  );
}

export function TodayStatsSection() {
  const q = useQuery({
    queryKey: ["today-stats"],
    queryFn: fetchTodayStats,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const data = q.data;
  const loading = q.isLoading;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Urheilua tänään</h2>
        {q.isError && (
          <span className="text-[11px] text-destructive">Tilastoja ei voitu ladata</span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2">
        <StatTile
          icon={<Activity className="h-5 w-5" />}
          label="Kisoja"
          value={data?.competitions ?? 0}
          loading={loading}
        />
        <StatTile
          icon={<Flame className="h-5 w-5" />}
          label="Lajeja"
          value={data?.events ?? 0}
          loading={loading}
        />
        <StatTile
          icon={<Users className="h-5 w-5" />}
          label="Urheilijoita"
          value={data?.athletes ?? 0}
          loading={loading}
        />
        <StatTile
          icon={<Medal className="h-5 w-5" />}
          label="Ennätyksiä"
          value={data?.pbs ?? 0}
          loading={loading}
          accent="text-amber-600 dark:text-amber-400"
        />
        <StatTile
          icon={<Trophy className="h-5 w-5" />}
          label="Kauden kärki"
          value={data?.seasonTops ?? 0}
          loading={loading}
          accent="text-amber-600 dark:text-amber-400"
        />
      </div>
    </section>
  );
}
