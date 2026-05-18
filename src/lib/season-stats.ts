import { supabase } from "@/integrations/supabase/client";
import { isRoadOrCrossCountry } from "./event-filters";

export type SeasonKind = "year" | "summer" | "winter" | "outdoor" | "indoor";

export interface SeasonRange {
  from: Date;
  to: Date;
  label: string;
}

export function seasonRange(kind: SeasonKind, ref: Date = new Date()): SeasonRange {
  const y = ref.getFullYear();
  if (kind === "year") {
    return {
      from: new Date(y, 0, 1),
      to: new Date(y + 1, 0, 1),
      label: `${y}`,
    };
  }
  if (kind === "summer" || kind === "outdoor") {
    // Ulkokausi 1.5.–30.9.
    return {
      from: new Date(y, 4, 1),
      to: new Date(y, 9, 1),
      label: kind === "outdoor" ? `Ulkokausi ${y}` : `Kesä ${y}`,
    };
  }
  // Talvi/halli: 1.10.(prevYear) – 30.4.(thisYear). Jos kuukausi >= 10, käytä alkavaa kautta.
  const month = ref.getMonth();
  const startYear = month >= 9 ? y : y - 1;
  const endYear = startYear + 1;
  return {
    from: new Date(startYear, 9, 1),
    to: new Date(endYear, 4, 1),
    label:
      kind === "indoor"
        ? `Hallikausi ${String(startYear).slice(-2)}–${String(endYear).slice(-2)}`
        : `Talvi ${startYear}–${endYear}`,
  };
}

/** Parse "60m", "1500 m", "100mA", "100m aj." → meters. Returns null if no distance. */
export function parseTrackDistanceMeters(eventName: string): number | null {
  if (!eventName) return null;
  const cleaned = eventName.toLowerCase();
  // matches "60m", "1500 m", "3000m est"
  const m = cleaned.match(/(\d{2,5})\s*m\b/);
  if (!m) return null;
  const meters = parseInt(m[1], 10);
  if (!Number.isFinite(meters) || meters < 30 || meters > 100000) return null;
  return meters;
}

/**
 * Parsii suomalaisen ratakellon tuloksen sekunneiksi.
 * Esim. "12,34" → 12.34, "2.58,25" → 178.25, "1.23.45,6" → 5025.6.
 * Palauttaa null jos teksti ei ole numeerinen aika (DNS/DNF/DQ/…).
 */
export function parseTrackSeconds(resultText: string | null | undefined): number | null {
  if (!resultText) return null;
  const t = resultText.trim();
  // h.mm.ss,cs
  let m = t.match(/^(\d+)\.(\d{1,2})\.(\d{1,2}),(\d{1,3})$/);
  if (m) {
    const h = +m[1], mi = +m[2], s = +m[3], cs = +m[4];
    return h * 3600 + mi * 60 + s + cs / Math.pow(10, m[4].length);
  }
  // m.ss,cs  (esim. 2.58,25)
  m = t.match(/^(\d+)\.(\d{1,2}),(\d{1,3})$/);
  if (m) {
    const mi = +m[1], s = +m[2], cs = +m[3];
    return mi * 60 + s + cs / Math.pow(10, m[3].length);
  }
  // ss,cs  (esim. 12,34)
  m = t.match(/^(\d+),(\d{1,3})$/);
  if (m) {
    return +m[1] + +m[2] / Math.pow(10, m[2].length);
  }
  // pelkkä kokonaisluku sekunteina
  m = t.match(/^(\d+)$/);
  if (m) return +m[1];
  return null;
}

/** Haversine distance in km. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 1.5h pohja per kisapäivä + 0.5h × (lajit−1). Vähintään 1.5 h. */
export function estimateHoursAtVenue(eventsCount: number): number {
  if (eventsCount <= 0) return 0;
  return 1.5 + Math.max(0, eventsCount - 1) * 0.5;
}

export interface SeasonStatsRow {
  athleteKey: string;
  surname: string;
  firstname: string;
  organization: string;
  organizationId: number | null;
  ageClass: string;
  events: number;
  competitions: number;
  hours: number;
  meters: number;
  pbs: number;
  wins: number;
  seconds: number;
  thirds: number;
  km: number | null;
}

export interface SeasonStatsResult {
  rows: SeasonStatsRow[];
  ageClasses: string[];
  missingOrgLocations: number[];
  missingCompetitionLocations: number[];
}

interface ResultRow {
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string;
  organization_id: number | null;
  competition_id: number;
  competition_date: string | null;
  location: string;
  event_name: string;
  event_category: string;
  sub_category: string;
  result_rank: number | null;
  was_pb: boolean;
  age_class: string;
}

interface WatchedRow {
  athlete_key: string;
}

/**
 * Lataa kausitilastot kirjautuneen käyttäjän seuratuille urheilijoille.
 * Tarvitaan vain kirjautunut käyttäjä (RLS huolehtii rajauksesta).
 */
export async function fetchSeasonStats(
  season: SeasonKind,
  ageClassFilter: string | null,
): Promise<SeasonStatsResult> {
  const range = seasonRange(season);

  const { data: watched, error: watchedErr } = await supabase
    .from("watched_athletes")
    .select("athlete_key");
  if (watchedErr) throw watchedErr;
  const keys = Array.from(
    new Set(((watched ?? []) as WatchedRow[]).map((w) => w.athlete_key)),
  );
  if (keys.length === 0) {
    return { rows: [], ageClasses: [], missingOrgLocations: [], missingCompetitionLocations: [] };
  }

  // Haetaan tulokset paloittain (in-listan rajoitus 1000 + URL-pituus).
  const all: ResultRow[] = [];
  const chunkSize = 100;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    let query = supabase
      .from("athlete_results")
      .select(
        "athlete_key, surname, firstname, organization, organization_id, competition_id, competition_date, location, event_name, event_category, sub_category, result_rank, was_pb, age_class",
      )
      .in("athlete_key", chunk)
      .gte("competition_date", range.from.toISOString())
      .lt("competition_date", range.to.toISOString())
      .limit(1000);
    const { data, error } = await query;
    if (error) throw error;
    const rows = ((data ?? []) as ResultRow[]).filter((r) => !isRoadOrCrossCountry(r));
    all.push(...rows);
  }

  // Ikäluokat (kaikki kauden esiintymät seuratuille urheilijoille)
  const ageClasses = Array.from(
    new Set(all.map((r) => r.age_class).filter((s) => s && s.length > 0)),
  ).sort((a, b) => a.localeCompare(b, "fi"));

  const filtered = ageClassFilter
    ? all.filter((r) => r.age_class === ageClassFilter)
    : all;

  // Hae kotipaikat ja kilpailupaikat
  const orgIds = Array.from(
    new Set(
      filtered
        .map((r) => r.organization_id)
        .filter((x): x is number => x != null),
    ),
  );
  const compIds = Array.from(new Set(filtered.map((r) => r.competition_id)));

  const orgLocations = new Map<number, { lat: number; lng: number }>();
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from("organization_locations")
      .select("organization_id, lat, lng")
      .in("organization_id", orgIds);
    for (const o of (orgs ?? []) as Array<{
      organization_id: number;
      lat: number | null;
      lng: number | null;
    }>) {
      if (o.lat != null && o.lng != null) {
        orgLocations.set(o.organization_id, { lat: o.lat, lng: o.lng });
      }
    }
  }

  const compLocations = new Map<number, { lat: number; lng: number }>();
  if (compIds.length > 0) {
    const { data: comps } = await supabase
      .from("competition_locations")
      .select("competition_id, lat, lng")
      .in("competition_id", compIds);
    for (const c of (comps ?? []) as Array<{
      competition_id: number;
      lat: number | null;
      lng: number | null;
    }>) {
      if (c.lat != null && c.lng != null) {
        compLocations.set(c.competition_id, { lat: c.lat, lng: c.lng });
      }
    }
  }

  // Aggregoi per urheilija
  type Acc = SeasonStatsRow & {
    eventsByDay: Map<string, Set<string>>;
    compSet: Set<number>;
    eventNorm: Set<string>;
  };
  const norm = (s: string) =>
    s
      .replace(/^(?:[MNTmnt][0-9]*|[Pp][0-9]+)\s+/, "")
      .trim()
      .toLowerCase();

  const byAthlete = new Map<string, Acc>();
  const missingOrg = new Set<number>();
  const missingComp = new Set<number>();

  for (const r of filtered) {
    let acc = byAthlete.get(r.athlete_key);
    if (!acc) {
      acc = {
        athleteKey: r.athlete_key,
        surname: r.surname,
        firstname: r.firstname,
        organization: r.organization,
        organizationId: r.organization_id,
        ageClass: r.age_class,
        events: 0,
        competitions: 0,
        hours: 0,
        meters: 0,
        pbs: 0,
        wins: 0,
        seconds: 0,
        thirds: 0,
        km: 0,
        eventsByDay: new Map(),
        compSet: new Set(),
        eventNorm: new Set(),
      };
      byAthlete.set(r.athlete_key, acc);
    }
    acc.eventNorm.add(norm(r.event_name));
    acc.compSet.add(r.competition_id);
    if (r.was_pb) acc.pbs += 1;
    if (r.result_rank === 1) acc.wins += 1;
    else if (r.result_rank === 2) acc.seconds += 1;
    else if (r.result_rank === 3) acc.thirds += 1;
    if (r.event_category === "Track") {
      const m = parseTrackDistanceMeters(r.event_name);
      if (m != null) acc.meters += m;
    }
    const dayKey = (r.competition_date ?? "").slice(0, 10) + "|" + r.competition_id;
    if (!acc.eventsByDay.has(dayKey)) acc.eventsByDay.set(dayKey, new Set());
    acc.eventsByDay.get(dayKey)!.add(norm(r.event_name));
  }

  // Tunnit per kisapäivä + km per kisa
  for (const acc of byAthlete.values()) {
    let hours = 0;
    for (const evs of acc.eventsByDay.values()) {
      hours += estimateHoursAtVenue(evs.size);
    }
    acc.hours = hours;
    acc.events = acc.eventNorm.size;
    acc.competitions = acc.compSet.size;

    const orgLoc = acc.organizationId != null ? orgLocations.get(acc.organizationId) : null;
    if (!orgLoc && acc.organizationId != null) missingOrg.add(acc.organizationId);
    let km: number | null = orgLoc ? 0 : null;
    if (orgLoc) {
      for (const cid of acc.compSet) {
        const cLoc = compLocations.get(cid);
        if (!cLoc) {
          missingComp.add(cid);
          continue;
        }
        km! += 2 * haversineKm(orgLoc, cLoc);
      }
    }
    acc.km = km;
  }

  const rows: SeasonStatsRow[] = Array.from(byAthlete.values())
    .map((a) => ({
      athleteKey: a.athleteKey,
      surname: a.surname,
      firstname: a.firstname,
      organization: a.organization,
      organizationId: a.organizationId,
      ageClass: a.ageClass,
      events: a.events,
      competitions: a.competitions,
      hours: a.hours,
      meters: a.meters,
      pbs: a.pbs,
      wins: a.wins,
      seconds: a.seconds,
      thirds: a.thirds,
      km: a.km,
    }))
    .sort((a, b) =>
      `${a.surname} ${a.firstname}`.localeCompare(`${b.surname} ${b.firstname}`, "fi"),
    );

  return {
    rows,
    ageClasses,
    missingOrgLocations: Array.from(missingOrg),
    missingCompetitionLocations: Array.from(missingComp),
  };
}
