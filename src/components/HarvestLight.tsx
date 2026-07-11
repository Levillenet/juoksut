import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeFi } from "@/lib/harvest-status";

interface HarvestLightData {
  blocked: boolean;
  blockReason: string | null;
  lastCapturedAt: string | null;
}

async function fetchHarvestLight(): Promise<HarvestLightData> {
  const [{ data: state }, { data: latest }] = await Promise.all([
    supabase
      .from("harvest_state")
      .select("blocked, block_reason")
      .eq("id", "singleton")
      .maybeSingle(),
    supabase
      .from("athlete_results")
      .select("captured_at")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    blocked: state?.blocked === true,
    blockReason: state?.block_reason ?? null,
    lastCapturedAt: latest?.captured_at ?? null,
  };
}

// Punainen jos harvesteri on suljettu tai viimeisin tulos on yli 3 h vanha.
const STALE_MS = 3 * 60 * 60 * 1000;

export function HarvestLight() {
  const { data } = useQuery({
    queryKey: ["harvest-light"],
    queryFn: fetchHarvestLight,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!data) return null;

  const lastCap = data.lastCapturedAt ? new Date(data.lastCapturedAt) : null;
  const stale = !lastCap || now.getTime() - lastCap.getTime() > STALE_MS;
  const ok = !data.blocked && !stale;

  const label = ok
    ? "Tulokset päivittyvät normaalisti"
    : data.blocked
      ? "Tulosten haku on tilapäisesti suljettu"
      : "Tuloksia ei ole päivittynyt hetkeen";

  const detail = lastCap
    ? `Viimeisin tulos tallennettu ${formatRelativeFi(lastCap, now)}.`
    : "Viimeisintä tallennusaikaa ei tiedossa.";
  const reason = data.blockReason ? ` Syy: ${data.blockReason}.` : "";

  return (
    <div
      className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        ok
          ? "border-green-600/40 bg-green-600/5 text-green-800 dark:text-green-300"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
      title={`${detail}${reason}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`relative inline-flex h-3 w-3 shrink-0 rounded-full ${
          ok ? "bg-green-500" : "bg-red-500"
        }`}
      >
        {ok && (
          <span className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-60" />
        )}
      </span>
      <span className="font-medium">{label}</span>
      {lastCap && (
        <span className="ml-auto text-[11px] font-normal opacity-80">
          Päivitetty {formatRelativeFi(lastCap, now)}
        </span>
      )}
    </div>
  );
}
