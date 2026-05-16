import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchHarvestStatus,
  formatAbsoluteFi,
  formatRelativeFi,
} from "@/lib/harvest-status";

export function HarvestStatusBadge({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ["harvest-status"],
    queryFn: fetchHarvestStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!data?.lastRunAt) return null;
  const lastRun = new Date(data.lastRunAt);
  const rel = formatRelativeFi(lastRun, now);
  const abs = formatAbsoluteFi(lastRun);

  return (
    <span
      className={className ?? "text-[11px] text-muted-foreground"}
      title={`Tausta-ajo hakee tuloksia live.tuloslista.com -palvelusta. Päivitetty viimeksi ${abs}.`}
    >
      Tietokanta päivitetty {rel}
    </span>
  );
}
