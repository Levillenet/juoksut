import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeFi } from "@/lib/harvest-status";

interface HarvestLightData {
  blocked: boolean;
  blockReason: string | null;
  lastRunAt: string | null;
  lastCapturedAt: string | null;
  anyCompetitionToday: boolean;
}

async function fetchHarvestLight(): Promise<HarvestLightData> {
  const [{ data: state }, { data: latest }, { data: active }] = await Promise.all([
    supabase
      .from("harvest_state")
      .select("blocked, block_reason, last_run_at")
      .eq("id", "singleton")
      .maybeSingle(),
    supabase
      .from("athlete_results")
      .select("captured_at")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("is_any_competition_active_today"),
  ]);
  return {
    blocked: state?.blocked === true,
    blockReason: state?.block_reason ?? null,
    lastRunAt: state?.last_run_at ?? null,
    lastCapturedAt: latest?.captured_at ?? null,
    anyCompetitionToday: active === true,
  };
}

// API-terveys: viimeisin ajo alle 30 min sitten.
const RUN_STALE_MS = 30 * 60 * 1000;
// Aktiivisen kisan tulosviive: yli 45 min ilman uutta tulosta = keltainen.
const RESULT_STALE_MS = 45 * 60 * 1000;

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

  const lastRun = data.lastRunAt ? new Date(data.lastRunAt) : null;
  const lastCap = data.lastCapturedAt ? new Date(data.lastCapturedAt) : null;
  const runStale = !lastRun || now.getTime() - lastRun.getTime() > RUN_STALE_MS;
  const apiOk = !data.blocked && !runStale;

  // Tila:
  //  - red: API pois pelistä tai ajo pysähtynyt
  //  - yellow: API ok mutta aktiivinen kisa ei tuota tuloksia
  //  - green: API ok, ei aktiivista kisaa TAI tuoreita tuloksia
  let status: "green" | "yellow" | "red" = "green";
  let label = "Tulokset päivittyvät normaalisti";

  if (!apiOk) {
    status = "red";
    label = data.blocked
      ? "Tulosten haku on tilapäisesti suljettu"
      : "Tulospalvelu ei ole vastannut hetkeen";
  } else if (data.anyCompetitionToday) {
    const resultStale = !lastCap || now.getTime() - lastCap.getTime() > RESULT_STALE_MS;
    if (resultStale) {
      status = "yellow";
      label = "Kisa käynnissä, tuloksia odotellaan";
    } else {
      status = "green";
      label = "Tulokset päivittyvät normaalisti";
    }
  } else {
    status = "green";
    label = "Ei kilpailuja tänään, palvelu toiminnassa";
  }

  const detailParts: string[] = [];
  if (lastRun) detailParts.push(`Viimeisin ajo ${formatRelativeFi(lastRun, now)}.`);
  if (lastCap) detailParts.push(`Viimeisin tulos ${formatRelativeFi(lastCap, now)}.`);
  if (data.blockReason) detailParts.push(`Syy: ${data.blockReason}.`);
  const detail = detailParts.join(" ");

  const colorClass =
    status === "green"
      ? "border-green-600/40 bg-green-600/5 text-green-800 dark:text-green-300"
      : status === "yellow"
        ? "border-yellow-600/40 bg-yellow-600/10 text-yellow-800 dark:text-yellow-300"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  const dotClass =
    status === "green" ? "bg-green-500" : status === "yellow" ? "bg-yellow-500" : "bg-red-500";

  return (
    <div
      className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${colorClass}`}
      title={detail}
      role="status"
      aria-live="polite"
    >
      <span className={`relative inline-flex h-3 w-3 shrink-0 rounded-full ${dotClass}`}>
        {status === "green" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-60" />
        )}
      </span>
      <span className="font-medium">{label}</span>
      {lastRun && (
        <span className="ml-auto text-[11px] font-normal opacity-80">
          Ajo {formatRelativeFi(lastRun, now)}
        </span>
      )}
    </div>
  );
}
