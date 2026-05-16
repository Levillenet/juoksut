import { supabase } from "@/integrations/supabase/client";

export interface HarvestStatus {
  lastRunAt: string | null;
}

export async function fetchHarvestStatus(): Promise<HarvestStatus> {
  const { data } = await supabase
    .from("harvest_state")
    .select("last_run_at")
    .eq("id", "singleton")
    .maybeSingle();
  return { lastRunAt: data?.last_run_at ?? null };
}

export function formatRelativeFi(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 45) return "juuri nyt";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min sitten`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 12) return `${diffH} t sitten`;

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
  if (sameDay) return `klo ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return `eilen klo ${time}`;

  return `${date.getDate()}.${date.getMonth() + 1}. klo ${time}`;
}

export function formatAbsoluteFi(date: Date): string {
  const d = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
  const t = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
  return `${d} klo ${t}`;
}
