import { supabase } from "@/integrations/supabase/client";
import { seasonRange, type SeasonKind } from "@/lib/season-stats";
import { isRoadOrCrossCountry } from "@/lib/event-filters";

/** Strip leading age-class prefix like "M14 ", "N ", "P11 " for grouping. */
export function normalizeEventName(name: string): string {
  return (name ?? "")
    .replace(/^(?:[MNTmnt][0-9]*|[Pp][0-9]+)\s+/, "")
    .replace(/^[0-9]+-ottelu\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function eventKey(name: string): string {
  return normalizeEventName(name).toLowerCase();
}

export interface LeaderRow {
  athleteKey: string;
  surname: string;
  firstname: string;
  organization: string;
  organizationId: number | null;
  ageClass: string;
  eventName: string;
  eventCategory: string;
  resultText: string;
  resultNumeric: number;
  wind: number | null;
  competitionId: number;
  competitionName: string;
  competitionDate: string | null;
  rank?: number; // sija koko vertailujoukossa
}

export interface LeaderEventOption {
  key: string;            // normalized lowercase
  label: string;          // normalized display
  category: string;       // Track/Field/etc (most common)
}

export interface ClubOption {
  id: number | null;
  name: string;
}

export interface LeadersData {
  range: { from: Date; to: Date; label: string };
  ageClasses: string[];
  events: LeaderEventOption[];
  clubs: ClubOption[];
  leaders: LeaderRow[];           // top-N for selected event
  watchedBests: LeaderRow[];      // best-per-watched-athlete for selected event
  clubBest: LeaderRow | null;     // best result for selected club (null if none)
  clubLeaders: LeaderRow[];       // all athletes from selected club (best per athlete)
}

interface RawRow {
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string;
  organization_id: number | null;
  age_class: string;
  event_name: string;
  event_category: string;
  sub_category: string;
  result_text: string;
  result_numeric: number | null;
  wind: number | null;
  competition_id: number;
  competition_name: string;
  competition_date: string | null;
}

interface WatchedRow {
  athlete_key: string;
}

const PAGE_SIZE = 1000;

/** Fetch ALL rows for a season + age-class filter (paginated). */
async function fetchSeasonRows(
  season: SeasonKind,
  ageClass: string | null,
): Promise<RawRow[]> {
  const range = seasonRange(season);
  const out: RawRow[] = [];
  let offset = 0;
  // Hard cap to avoid runaway: 50k rows max
  const HARD_CAP = 50_000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase
      .from("athlete_results")
      .select(
        "athlete_key, surname, firstname, organization, organization_id, age_class, event_name, event_category, sub_category, result_text, result_numeric, wind, competition_id, competition_name, competition_date",
      )
      .gte("competition_date", range.from.toISOString())
      .lt("competition_date", range.to.toISOString())
      .not("result_numeric", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (ageClass) q = q.eq("age_class", ageClass);

    const { data, error } = await q;
    if (error) throw error;
    const rows = ((data ?? []) as RawRow[]).filter((r) => !isRoadOrCrossCountry(r));
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (out.length >= HARD_CAP) break;
  }
  return out;
}

/** Fetch all distinct age classes in season range (ignoring ageClass filter). */
async function fetchSeasonAgeClasses(season: SeasonKind): Promise<string[]> {
  const range = seasonRange(season);
  const set = new Set<string>();
  let offset = 0;
  const HARD_CAP = 100_000;
  while (true) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select("age_class")
      .gte("competition_date", range.from.toISOString())
      .lt("competition_date", range.to.toISOString())
      .not("result_numeric", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const rows = (data ?? []) as { age_class: string | null }[];
    for (const r of rows) if (r.age_class) set.add(r.age_class);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset >= HARD_CAP) break;
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fi"));
}

/** Fetch all distinct events in season range (ignoring ageClass filter). */
async function fetchSeasonEvents(season: SeasonKind): Promise<LeaderEventOption[]> {
  const range = seasonRange(season);
  const map = new Map<string, { label: string; cats: Map<string, number> }>();
  let offset = 0;
  const HARD_CAP = 100_000;
  while (true) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select("event_name, event_category, sub_category")
      .gte("competition_date", range.from.toISOString())
      .lt("competition_date", range.to.toISOString())
      .not("result_numeric", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const rows = ((data ?? []) as { event_name: string | null; event_category: string | null; sub_category: string | null }[])
      .filter((r) => !isRoadOrCrossCountry(r));
    for (const r of rows) {
      if (!r.event_name) continue;
      const k = eventKey(r.event_name);
      if (!k) continue;
      let entry = map.get(k);
      if (!entry) {
        entry = { label: normalizeEventName(r.event_name), cats: new Map() };
        map.set(k, entry);
      }
      const c = r.event_category ?? "";
      entry.cats.set(c, (entry.cats.get(c) ?? 0) + 1);
    }
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset >= HARD_CAP) break;
  }
  return Array.from(map.entries())
    .map(([k, v]) => {
      let topCat = "";
      let topN = -1;
      for (const [c, n] of v.cats) if (n > topN) { topCat = c; topN = n; }
      return { key: k, label: v.label, category: topCat };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fi"));
}

function isTrackBetter(category: string, a: number, b: number) {
  if (category === "Track") return a < b;
  return a > b;
}

function bestPerAthlete(rows: RawRow[], evKey: string): LeaderRow[] {
  const best = new Map<string, RawRow>();
  for (const r of rows) {
    if (eventKey(r.event_name) !== evKey) continue;
    if (r.result_numeric == null) continue;
    const cur = best.get(r.athlete_key);
    if (!cur || isTrackBetter(r.event_category, r.result_numeric, cur.result_numeric!)) {
      best.set(r.athlete_key, r);
    }
  }
  return Array.from(best.values()).map((r) => ({
    athleteKey: r.athlete_key,
    surname: r.surname,
    firstname: r.firstname,
    organization: r.organization,
    organizationId: r.organization_id,
    ageClass: r.age_class,
    eventName: normalizeEventName(r.event_name),
    eventCategory: r.event_category,
    resultText: r.result_text,
    resultNumeric: r.result_numeric!,
    wind: r.wind,
    competitionId: r.competition_id,
    competitionName: r.competition_name,
    competitionDate: r.competition_date,
  }));
}

/** Fetch all distinct organizations in season range (independent of filters). */
async function fetchSeasonClubs(season: SeasonKind): Promise<ClubOption[]> {
  const range = seasonRange(season);
  const map = new Map<string, ClubOption>();
  let offset = 0;
  const HARD_CAP = 100_000;
  while (true) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select("organization, organization_id")
      .gte("competition_date", range.from.toISOString())
      .lt("competition_date", range.to.toISOString())
      .not("result_numeric", "is", null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { organization: string | null; organization_id: number | null }[];
    for (const r of rows) {
      const name = (r.organization ?? "").trim();
      if (!name) continue;
      const key = `${r.organization_id ?? ""}|${name}`;
      if (!map.has(key)) map.set(key, { id: r.organization_id, name });
    }
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset >= HARD_CAP) break;
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fi"));
}

export interface LoadLeadersInput {
  season: SeasonKind;
  ageClass: string | null;
  eventKey: string | null;
  organization: string | null; // organization name; null = no club filter
  limit?: number;
}

export async function loadSeasonLeaders(
  input: LoadLeadersInput,
): Promise<LeadersData> {
  const { season, ageClass, organization } = input;
  const limit = input.limit ?? 50;
  const range = seasonRange(season);

  const rows = await fetchSeasonRows(season, ageClass);
  const ageClasses = await fetchSeasonAgeClasses(season);
  // Event/club lists are independent of age-class filter so dropdowns stay
  // usable when other filters are already set.
  const events = await fetchSeasonEvents(season);
  const clubs = await fetchSeasonClubs(season);

  // Per-category map from currently filtered rows (used for sort direction)
  const evMap = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const k = eventKey(r.event_name);
    if (!k) continue;
    let entry = evMap.get(k);
    if (!entry) { entry = new Map(); evMap.set(k, entry); }
    entry.set(r.event_category, (entry.get(r.event_category) ?? 0) + 1);
  }

  // Keep user's selection as-is. If no rows match, leaders will simply be empty.
  const evK = input.eventKey ?? events[0]?.key ?? null;

  let leaders: LeaderRow[] = [];
  let watchedBests: LeaderRow[] = [];
  let clubBest: LeaderRow | null = null;
  let clubLeaders: LeaderRow[] = [];

  if (evK) {
    const all = bestPerAthlete(rows, evK);
    // Sort direction: prefer category from current rows, else from full-season events.
    let topCat = "";
    const cat = evMap.get(evK);
    if (cat) {
      let topN = -1;
      for (const [c, n] of cat) if (n > topN) { topCat = c; topN = n; }
    } else {
      topCat = events.find((e) => e.key === evK)?.category ?? "";
    }
    all.sort((a, b) =>
      isTrackBetter(topCat, a.resultNumeric, b.resultNumeric) ? -1 : 1,
    );
    all.forEach((r, i) => { r.rank = i + 1; });
    leaders = all.slice(0, limit);

    const { data: watched } = await supabase
      .from("watched_athletes")
      .select("athlete_key");
    const watchedKeys = new Set(
      ((watched ?? []) as WatchedRow[]).map((w) => w.athlete_key),
    );
    watchedBests = all.filter((r) => watchedKeys.has(r.athleteKey));

    if (organization) {
      clubLeaders = all.filter((r) => r.organization === organization);
      clubBest = clubLeaders[0] ?? null;
    }
  }

  return {
    range: { from: range.from, to: range.to, label: range.label },
    ageClasses,
    events,
    clubs,
    leaders,
    watchedBests,
    clubBest,
    clubLeaders,
  };
}

export function isWatched(set: Set<string>, key: string) {
  return set.has(key);
}

export function formatLeaderResult(row: LeaderRow): string {
  return row.resultText || String(row.resultNumeric);
}

export interface EventLeadersGroup {
  key: string;
  label: string;
  category: string;
  top: LeaderRow[];
  clubTop: LeaderRow[];
}

export interface AllEventLeadersData {
  range: { from: Date; to: Date; label: string };
  ageClasses: string[];
  clubs: ClubOption[];
  groups: EventLeadersGroup[];
}

export async function loadAllEventLeaders(input: {
  season: SeasonKind;
  ageClass: string | null;
  organization: string | null;
  topN?: number;
  clubTopN?: number;
}): Promise<AllEventLeadersData> {
  const topN = input.topN ?? 3;
  const clubTopN = input.clubTopN ?? 3;
  const range = seasonRange(input.season);

  const [rows, ageClasses, clubs] = await Promise.all([
    fetchSeasonRows(input.season, input.ageClass),
    fetchSeasonAgeClasses(input.season),
    fetchSeasonClubs(input.season),
  ]);

  const byEvent = new Map<string, RawRow[]>();
  const labels = new Map<string, string>();
  const cats = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const k = eventKey(r.event_name);
    if (!k) continue;
    if (!labels.has(k)) labels.set(k, normalizeEventName(r.event_name));
    let arr = byEvent.get(k);
    if (!arr) { arr = []; byEvent.set(k, arr); }
    arr.push(r);
    let cm = cats.get(k);
    if (!cm) { cm = new Map(); cats.set(k, cm); }
    cm.set(r.event_category, (cm.get(r.event_category) ?? 0) + 1);
  }

  const groups: EventLeadersGroup[] = [];
  for (const [k, evRows] of byEvent) {
    let topCat = "";
    let topCount = -1;
    const cm = cats.get(k);
    if (cm) for (const [c, n] of cm) if (n > topCount) { topCat = c; topCount = n; }
    const all = bestPerAthlete(evRows, k);
    all.sort((a, b) =>
      isTrackBetter(topCat, a.resultNumeric, b.resultNumeric) ? -1 : 1,
    );
    all.forEach((r, i) => { r.rank = i + 1; });
    const top = all.slice(0, topN);
    const topKeys = new Set(top.map((r) => r.athleteKey));
    const clubTop = input.organization
      ? all
          .filter((r) => r.organization === input.organization && !topKeys.has(r.athleteKey))
          .slice(0, clubTopN)
      : [];
    groups.push({ key: k, label: labels.get(k) ?? k, category: topCat, top, clubTop });
  }

  groups.sort((a, b) => a.label.localeCompare(b.label, "fi"));

  return {
    range: { from: range.from, to: range.to, label: range.label },
    ageClasses,
    clubs,
    groups,
  };
}
