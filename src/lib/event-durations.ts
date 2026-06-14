// Kerää lajikohtaiset kestot, osanottajamäärät ja erien lukumäärät
// Excel-vientiä ja tulevaa aikataulutyökalua varten.

import {
  fetchRounds,
  fetchEvent,
  isRunningEvent,
  translateSub,
  type Round,
} from "@/lib/tuloslista";
import { supabase } from "@/integrations/supabase/client";

export interface EventDurationRow {
  eventId: number;
  eventName: string;
  groupName: string;
  category: "Track" | "Field" | string;
  categoryLabel: string;
  subCategoryLabel: string;
  startISO: string | null;
  startHelsinki: string | null;
  heatCount: number | null; // vain juoksut
  scheduledParticipants: number; // CountConfirmed (tai Enrolled) summa
  resultParticipants: number; // distinct athlete_keys
  lastResultISO: string | null;
  lastResultHelsinki: string | null;
  durationMinutes: number | null;
  status: string;
}

const HELS = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmtHelsinki(iso: string | null): string | null {
  if (!iso) return null;
  return HELS.format(new Date(iso));
}

async function pMapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

interface ResultAgg {
  participants: Set<string>;
  lastISO: string | null;
}

async function fetchResultAggregates(
  competitionId: number,
): Promise<Map<number, ResultAgg>> {
  const PAGE = 1000;
  const agg = new Map<number, ResultAgg>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select("event_id, athlete_key, captured_at")
      .eq("competition_id", competitionId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const r of rows) {
      const eid = r.event_id as number | null;
      if (eid == null) continue;
      let e = agg.get(eid);
      if (!e) {
        e = { participants: new Set(), lastISO: null };
        agg.set(eid, e);
      }
      if (r.athlete_key) e.participants.add(r.athlete_key as string);
      const ts = r.captured_at as string | null;
      if (ts && (!e.lastISO || ts > e.lastISO)) e.lastISO = ts;
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return agg;
}

export async function buildEventDurationRows(
  competitionId: number,
  onProgress?: (done: number, total: number) => void,
): Promise<EventDurationRow[]> {
  const [schedule, resultsAgg] = await Promise.all([
    fetchRounds(competitionId),
    fetchResultAggregates(competitionId),
  ]);

  // Ryhmittele tuloslistan Round-rivit lajikohtaisesti.
  const byEvent = new Map<number, Round[]>();
  for (const list of Object.values(schedule)) {
    for (const r of list) {
      const arr = byEvent.get(r.EventId) ?? [];
      arr.push(r);
      byEvent.set(r.EventId, arr);
    }
  }

  const eventIds = Array.from(byEvent.keys());
  let done = 0;

  const rows = await pMapLimit(eventIds, 6, async (eventId) => {
    const rounds = byEvent.get(eventId)!;
    const first = rounds.slice().sort((a, b) =>
      a.BeginDateTimeWithTZ.localeCompare(b.BeginDateTimeWithTZ),
    )[0];

    // Aikataulun osallistujasumma: confirmed > enrolled.
    const scheduledParticipants = rounds.reduce(
      (sum, r) => sum + (r.CountConfirmed || r.CountEnrolled || 0),
      0,
    );

    let heatCount: number | null = null;
    if (isRunningEvent(first)) {
      try {
        const ev = await fetchEvent(competitionId, eventId);
        heatCount = ev.Rounds.reduce((n, r) => n + (r.Heats?.length ?? 0), 0);
      } catch {
        // Jos haku epäonnistuu, jätä tyhjäksi.
      }
    }

    const ragg = resultsAgg.get(eventId);
    const lastISO = ragg?.lastISO ?? null;
    let durationMin: number | null = null;
    if (first.BeginDateTimeWithTZ && lastISO) {
      const d =
        (new Date(lastISO).getTime() - new Date(first.BeginDateTimeWithTZ).getTime()) /
        60000;
      if (d >= 0) durationMin = Math.round(d);
    }

    done += 1;
    onProgress?.(done, eventIds.length);

    return {
      eventId,
      eventName: first.EventName,
      groupName: first.Name,
      category: first.Category,
      categoryLabel: first.Category === "Track" ? "Juoksu" : "Kenttä",
      subCategoryLabel: translateSub(first.SubCategory),
      startISO: first.BeginDateTimeWithTZ,
      startHelsinki: fmtHelsinki(first.BeginDateTimeWithTZ),
      heatCount,
      scheduledParticipants,
      resultParticipants: ragg?.participants.size ?? 0,
      lastResultISO: lastISO,
      lastResultHelsinki: fmtHelsinki(lastISO),
      durationMinutes: durationMin,
      status: first.Status,
    } satisfies EventDurationRow;
  });

  return rows.sort((a, b) =>
    (a.startISO ?? "").localeCompare(b.startISO ?? ""),
  );
}
