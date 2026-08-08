import {
  compareByBeginTime,
  helsinkiDateKey,
  isRunningEvent,
  type Round,
  type RoundsByDate,
} from "@/lib/tuloslista";

const HELSINKI_HM = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Helsinki",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Minutes from midnight in Helsinki time, or null when the timestamp is unusable. */
export function helsinkiMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const [h, m] = HELSINKI_HM.format(d).split(":");
  const mins = Number(h) * 60 + Number(m);
  return Number.isFinite(mins) ? mins : null;
}

export interface CompetitionDay {
  /** YYYY-MM-DD in Helsinki time. */
  day: string;
  rounds: Round[];
  /** Whole hours covering the day's schedule. */
  startHour: number;
  endHour: number;
}

/** Field events only, grouped by Helsinki day and sorted chronologically. */
export function fieldDays(byDate: RoundsByDate | undefined | null): CompetitionDay[] {
  const rounds = Object.values(byDate ?? {}).flat().filter((r) => !isRunningEvent(r));
  const map = new Map<string, Round[]>();
  for (const r of rounds) {
    const key = helsinkiDateKey(r.BeginDateTimeWithTZ);
    if (!key) continue;
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .map(([day, list]) => {
      list.sort(compareByBeginTime);
      const mins = list
        .map((r) => helsinkiMinutes(r.BeginDateTimeWithTZ))
        .filter((m): m is number => m != null);
      const startHour = mins.length ? Math.floor(Math.min(...mins) / 60) : 8;
      const endHour = mins.length ? Math.min(23, Math.ceil(Math.max(...mins) / 60) + 2) : 21;
      return { day, rounds: list, startHour, endHour: Math.max(endHour, startHour + 1) };
    })
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function hourOptions(startHour: number, endHour: number): number[] {
  const out: number[] = [];
  for (let h = startHour; h <= endHour; h += 1) out.push(h);
  return out;
}

export function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** "12:00" / "12:00:00" -> minutes. */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const mins = Number(h) * 60 + Number(m ?? 0);
  return Number.isFinite(mins) ? mins : null;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** True when the round starts inside the official's declared window for that day. */
export function roundInWindow(
  round: Round,
  window: { start_time: string | null; end_time: string | null } | undefined,
): boolean {
  if (!window) return true;
  const mins = helsinkiMinutes(round.BeginDateTimeWithTZ);
  if (mins == null) return true;
  const from = timeToMinutes(window.start_time);
  const to = timeToMinutes(window.end_time);
  if (from != null && mins < from) return false;
  if (to != null && mins > to) return false;
  return true;
}

export function roundLabel(r: Round): string {
  return `${r.Age ? `${r.Age} ` : ""}${r.EventName}`.trim();
}
