// Leikkimieliset kausitilastot lapsille — useita eri mittareita,
// joissa jokainen voi pärjätä jossain. Kaikki data athlete_results-taulusta
// seuratuille urheilijoille.

import { supabase } from "@/integrations/supabase/client";
import {
  parseTrackDistanceMeters,
  parseTrackSeconds,
  seasonRange,
  estimateHoursAtVenue,
  type SeasonKind,
} from "./season-stats";

const ATTEMPTS_PER_FIELD = 4;

export type FunMetricKey =
  | "varietyEvents"
  | "competitionDays"
  | "totalPerformances"
  | "runMeters"
  | "runSeconds"
  | "jumpCount"
  | "throwCount"
  | "venues"
  | "bestDay"
  | "loyalEvent"
  | "hours"
  | "pbCount"
  | "sprinter"
  | "endurance"
  | "weekendWarrior"
  | "weekdayHero"
  | "monthsActive"
  | "uniqueCompetitions"
  | "allRounder"
  | "specialEvents"
  | "longestStreak";

export interface FunMetricDef {
  key: FunMetricKey;
  emoji: string;
  title: string;
  description: string;
  /** Pienempi parempi? (vain "earliest") */
  lowerIsBetter?: boolean;
  format: (value: number, extra?: string) => string;
  unitShort: string;
}

export const FUN_METRICS: FunMetricDef[] = [
  {
    key: "varietyEvents",
    emoji: "🧭",
    title: "Lajien tutkimusmatkailija",
    description: "Eniten eri lajeja kokeiltuna kauden aikana.",
    format: (v) => `${v} lajia`,
    unitShort: "lajia",
  },
  {
    key: "competitionDays",
    emoji: "📅",
    title: "Ahkera kisaaja",
    description: "Eniten kisapäiviä mukana.",
    format: (v) => `${v} päivää`,
    unitShort: "pv",
  },
  {
    key: "totalPerformances",
    emoji: "💪",
    title: "Suoritusten supersankari",
    description: "Eniten suorituksia yhteensä.",
    format: (v) => `${v} suoritusta`,
    unitShort: "suor.",
  },
  {
    key: "runMeters",
    emoji: "🏃",
    title: "Maratonjuoksija",
    description: "Eniten juoksumetrejä kisoissa yhteensä.",
    format: (v) =>
      v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")} km` : `${v} m`,
    unitShort: "m",
  },
  {
    key: "runSeconds",
    emoji: "⏱️",
    title: "Kelloseppä",
    description: "Eniten aikaa juoksuradalla vietetty.",
    format: (v) => formatDuration(v),
    unitShort: "min",
  },
  {
    key: "jumpCount",
    emoji: "🦘",
    title: "Hyppykirppu",
    description: "Eniten hyppysuorituksia.",
    format: (v) => `${v} hyppyä`,
    unitShort: "hyp.",
  },
  {
    key: "throwCount",
    emoji: "💥",
    title: "Heittotykki",
    description: "Eniten heittosuorituksia.",
    format: (v) => `${v} heittoa`,
    unitShort: "heit.",
  },
  {
    key: "venues",
    emoji: "✈️",
    title: "Reissaaja",
    description: "Eniten eri kilpailupaikkoja kauden aikana.",
    format: (v) => `${v} paikkaa`,
    unitShort: "paikk.",
  },
  {
    key: "bestDay",
    emoji: "🔥",
    title: "Pinnistäjä",
    description: "Eniten suorituksia samana päivänä.",
    format: (v) => `${v} suoritusta`,
    unitShort: "suor.",
  },
  {
    key: "loyalEvent",
    emoji: "❤️",
    title: "Uskollinen lajille",
    description: "Saman lajin kertoja kaudella.",
    format: (v, extra) => (extra ? `${v}× ${extra}` : `${v}×`),
    unitShort: "×",
  },
  {
    key: "hours",
    emoji: "🏟️",
    title: "Stadionkävelijä",
    description: "Arvioidut tunnit kentällä kauden aikana.",
    format: (v) => `${v.toFixed(1).replace(".", ",")} h`,
    unitShort: "h",
  },
  {
    key: "pbCount",
    emoji: "🌟",
    title: "Ennätystehdas",
    description: "Eniten omia ennätyksiä rikottu kauden aikana.",
    format: (v) => `${v} ennätystä`,
    unitShort: "ER",
  },
  {
    key: "sprinter",
    emoji: "⚡",
    title: "Salamasprintteri",
    description: "Eniten pikajuoksuja (≤ 200 m) kaudella.",
    format: (v) => `${v} pikalähtöä`,
    unitShort: "kpl",
  },
  {
    key: "endurance",
    emoji: "🐢",
    title: "Sisukas kestäjä",
    description: "Eniten pitkiä juoksuja (≥ 600 m).",
    format: (v) => `${v} pitkää`,
    unitShort: "kpl",
  },
  {
    key: "weekendWarrior",
    emoji: "🎉",
    title: "Viikonloppusankari",
    description: "Eniten suorituksia lauantaisin ja sunnuntaisin.",
    format: (v) => `${v} suoritusta`,
    unitShort: "vkl",
  },
  {
    key: "weekdayHero",
    emoji: "🗓️",
    title: "Arkikisaaja",
    description: "Eniten suorituksia arkipäivinä (ma–pe).",
    format: (v) => `${v} suoritusta`,
    unitShort: "arki",
  },
  {
    key: "monthsActive",
    emoji: "🌗",
    title: "Pitkän linjan kisaaja",
    description: "Eniten eri kuukausia, joina on kisattu.",
    format: (v) => `${v} kuukautta`,
    unitShort: "kk",
  },
  {
    key: "uniqueCompetitions",
    emoji: "🎪",
    title: "Kisakiertäjä",
    description: "Eniten eri kilpailutapahtumia kaudella.",
    format: (v) => `${v} kisaa`,
    unitShort: "kisaa",
  },
  {
    key: "allRounder",
    emoji: "⚖️",
    title: "Tasapainoilija",
    description: "Eniten suorituksia sekä radalla että kentällä yhdistettynä.",
    format: (v) => `${v} paria`,
    unitShort: "paria",
  },
  {
    key: "specialEvents",
    emoji: "🤝",
    title: "Erikoislajien tutkija",
    description: "Eniten viesti- ja katulajisuorituksia.",
    format: (v) => `${v} erikoista`,
    unitShort: "erik.",
  },
  {
    key: "longestStreak",
    emoji: "🔗",
    title: "Putkimestari",
    description: "Pisin peräkkäisten kisapäivien putki.",
    format: (v) => `${v} päivää putkeen`,
    unitShort: "pv",
  },
];

export interface FunEntry {
  athleteKey: string;
  name: string;
  organization: string;
  value: number;
  /** Vapaaehtoinen lisätieto, esim. päivämäärä tai lajin nimi. */
  extra?: string;
}

export type FunStatsResult = {
  byMetric: Record<FunMetricKey, FunEntry[]>;
  ageClasses: string[];
};

interface Row {
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string;
  competition_id: number;
  competition_date: string | null;
  location: string;
  event_name: string;
  event_category: string;
  sub_category: string;
  result_numeric: number | null;
  result_text: string | null;
  age_class: string;
  was_pb: boolean;
}

function formatDuration(totalSec: number): string {
  if (totalSec <= 0) return "–";
  const s = Math.round(totalSec);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m} min ${rs} s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h} h ${rm} min`;
}

function fmtDateFi(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("fi-FI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function normEvent(s: string): string {
  return s
    .replace(/^(?:[MNTmnt][0-9]*|[Pp][0-9]+)\s+/, "")
    .trim()
    .toLowerCase();
}

const INVALID_ORGS = new Set(["", "0", "-", ".", "Ei seuraa"]);

export async function fetchOrganizations(season: SeasonKind): Promise<string[]> {
  const range = seasonRange(season);
  const seen = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  // Selailtava paginointi, jotta saadaan kaikki uniikit seurat
  // (Supabase select+distinct ei tuettu suoraan PostgREST:llä helpolla tavalla)
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select("organization")
      .gte("competition_date", range.from.toISOString())
      .lt("competition_date", range.to.toISOString())
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ organization: string }>;
    for (const r of rows) {
      const o = (r.organization ?? "").trim();
      if (o && !INVALID_ORGS.has(o)) seen.add(o);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, "fi"));
}

export async function fetchAgeClassesForOrg(
  season: SeasonKind,
  organization: string,
): Promise<string[]> {
  const range = seasonRange(season);
  const seen = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select("age_class")
      .eq("organization", organization)
      .gte("competition_date", range.from.toISOString())
      .lt("competition_date", range.to.toISOString())
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ age_class: string }>;
    for (const r of rows) {
      const a = (r.age_class ?? "").trim();
      if (a) seen.add(a);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, "fi"));
}

export async function fetchFunStats(
  season: SeasonKind,
  organization: string | null,
  ageClassFilter: string[] | null,
): Promise<FunStatsResult> {
  const range = seasonRange(season);
  const empty = makeEmpty();
  if (!organization) return empty;

  const all: Row[] = [];
  const PAGE = 1000;
  let from = 0;
  for (let i = 0; i < 50; i++) {
    let q = supabase
      .from("athlete_results")
      .select(
        "athlete_key, surname, firstname, organization, competition_id, competition_date, location, event_name, event_category, sub_category, result_numeric, age_class, was_pb",
      )
      .eq("organization", organization)
      .gte("competition_date", range.from.toISOString())
      .lt("competition_date", range.to.toISOString());
    if (ageClassFilter && ageClassFilter.length > 0) {
      q = q.in("age_class", ageClassFilter);
    }
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  const ageClasses = Array.from(
    new Set(all.map((r) => r.age_class).filter((s) => s && s.length > 0)),
  ).sort((a, b) => a.localeCompare(b, "fi"));

  const filtered = all;

  interface Acc {
    athleteKey: string;
    name: string;
    organization: string;
    events: Set<string>;
    competitionDays: Set<string>;
    performances: number;
    runMeters: number;
    runSeconds: number;
    jumpCount: number;
    throwCount: number;
    venues: Set<string>;
    earliest: string | null;
    perDay: Map<string, number>;
    perEvent: Map<string, number>;
    hoursByDay: Map<string, Set<string>>;
    pbCount: number;
    sprinter: number;
    endurance: number;
    weekend: number;
    weekday: number;
    months: Set<string>;
    competitions: Set<number>;
    trackPerf: number;
    fieldPerf: number;
    special: number;
  }

  const accs = new Map<string, Acc>();
  for (const r of filtered) {
    let a = accs.get(r.athlete_key);
    if (!a) {
      a = {
        athleteKey: r.athlete_key,
        name: `${r.firstname} ${r.surname}`.trim(),
        organization: r.organization ?? "",
        events: new Set(),
        competitionDays: new Set(),
        performances: 0,
        runMeters: 0,
        runSeconds: 0,
        jumpCount: 0,
        throwCount: 0,
        venues: new Set(),
        earliest: null,
        perDay: new Map(),
        perEvent: new Map(),
        hoursByDay: new Map(),
        pbCount: 0,
        sprinter: 0,
        endurance: 0,
        weekend: 0,
        weekday: 0,
        months: new Set(),
        competitions: new Set(),
        trackPerf: 0,
        fieldPerf: 0,
        special: 0,
      };
      accs.set(r.athlete_key, a);
    }
    a.performances += 1;
    const norm = normEvent(r.event_name);
    a.events.add(norm);
    a.perEvent.set(norm, (a.perEvent.get(norm) ?? 0) + 1);
    if (r.location) a.venues.add(r.location.trim().toLowerCase());
    if (r.competition_id) a.competitions.add(r.competition_id);
    if (r.was_pb) a.pbCount += 1;

    const day = (r.competition_date ?? "").slice(0, 10);
    if (day) {
      a.competitionDays.add(day);
      a.perDay.set(day, (a.perDay.get(day) ?? 0) + 1);
      a.months.add(day.slice(0, 7));
      const dayKey = `${day}|${r.competition_id}`;
      if (!a.hoursByDay.has(dayKey)) a.hoursByDay.set(dayKey, new Set());
      a.hoursByDay.get(dayKey)!.add(norm);
      const dow = new Date(day + "T12:00:00").getDay(); // 0=Sun,6=Sat
      if (dow === 0 || dow === 6) a.weekend += 1;
      else a.weekday += 1;
    }
    if (r.competition_date) {
      if (!a.earliest || r.competition_date < a.earliest) a.earliest = r.competition_date;
    }

    if (r.event_category === "Track") {
      a.trackPerf += 1;
      const m = parseTrackDistanceMeters(r.event_name);
      if (m != null) {
        a.runMeters += m;
        if (m <= 200) a.sprinter += 1;
        else if (m >= 600) a.endurance += 1;
      }
      // result_numeric for Track = seconds
      if (r.result_numeric != null && r.result_numeric > 0 && r.result_numeric < 10 * 3600) {
        a.runSeconds += r.result_numeric;
      }
    } else if (r.event_category === "Field") {
      a.fieldPerf += 1;
      if (r.sub_category === "HorizontalJump" || r.sub_category === "VerticalJump") {
        a.jumpCount += 1;
      } else if (r.sub_category === "Throw") {
        a.throwCount += 1;
      }
    } else if (r.event_category === "Relay" || r.event_category === "Street") {
      a.special += 1;
    }
  }

  const out = makeEmpty();
  out.ageClasses = ageClasses;

  const list = Array.from(accs.values());
  const TOP = 5;

  const pushTop = (
    key: FunMetricKey,
    items: FunEntry[],
    lowerIsBetter = false,
  ) => {
    const filtered = items.filter((x) => x.value > 0 || lowerIsBetter);
    filtered.sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value));
    out.byMetric[key] = filtered.slice(0, TOP);
  };

  pushTop(
    "varietyEvents",
    list.map((a) => ({
      athleteKey: a.athleteKey,
      name: a.name,
      organization: a.organization,
      value: a.events.size,
    })),
  );
  pushTop(
    "competitionDays",
    list.map((a) => ({
      athleteKey: a.athleteKey,
      name: a.name,
      organization: a.organization,
      value: a.competitionDays.size,
    })),
  );
  pushTop(
    "totalPerformances",
    list.map((a) => ({
      athleteKey: a.athleteKey,
      name: a.name,
      organization: a.organization,
      value: a.performances,
    })),
  );
  pushTop(
    "runMeters",
    list.map((a) => ({
      athleteKey: a.athleteKey,
      name: a.name,
      organization: a.organization,
      value: a.runMeters,
    })),
  );
  pushTop(
    "runSeconds",
    list.map((a) => ({
      athleteKey: a.athleteKey,
      name: a.name,
      organization: a.organization,
      value: a.runSeconds,
    })),
  );
  pushTop(
    "jumpCount",
    list.map((a) => ({
      athleteKey: a.athleteKey,
      name: a.name,
      organization: a.organization,
      value: a.jumpCount,
    })),
  );
  pushTop(
    "throwCount",
    list.map((a) => ({
      athleteKey: a.athleteKey,
      name: a.name,
      organization: a.organization,
      value: a.throwCount,
    })),
  );
  pushTop(
    "venues",
    list.map((a) => ({
      athleteKey: a.athleteKey,
      name: a.name,
      organization: a.organization,
      value: a.venues.size,
    })),
  );

  // Pinnistäjä — paras päivä (max suoritusten määrä)
  pushTop(
    "bestDay",
    list.map((a) => {
      let best = 0;
      let bestDay = "";
      for (const [d, n] of a.perDay) {
        if (n > best) {
          best = n;
          bestDay = d;
        }
      }
      return {
        athleteKey: a.athleteKey,
        name: a.name,
        organization: a.organization,
        value: best,
        extra: bestDay ? fmtDateFi(bestDay) : undefined,
      };
    }),
  );

  // Uskollinen lajille — sama laji eniten kertoja
  pushTop(
    "loyalEvent",
    list.map((a) => {
      let best = 0;
      let bestEvent = "";
      for (const [ev, n] of a.perEvent) {
        if (n > best) {
          best = n;
          bestEvent = ev;
        }
      }
      return {
        athleteKey: a.athleteKey,
        name: a.name,
        organization: a.organization,
        value: best,
        extra: bestEvent || undefined,
      };
    }),
  );

  // Tunnit — sum estimateHoursAtVenue per kisapäivä
  pushTop(
    "hours",
    list.map((a) => {
      let h = 0;
      for (const evs of a.hoursByDay.values()) {
        h += estimateHoursAtVenue(evs.size);
      }
      return {
        athleteKey: a.athleteKey,
        name: a.name,
        organization: a.organization,
        value: Math.round(h * 10) / 10,
      };
    }),
  );

  const simple = (key: FunMetricKey, pick: (a: typeof list[number]) => number) =>
    pushTop(
      key,
      list.map((a) => ({
        athleteKey: a.athleteKey,
        name: a.name,
        organization: a.organization,
        value: pick(a),
      })),
    );

  simple("pbCount", (a) => a.pbCount);
  simple("sprinter", (a) => a.sprinter);
  simple("endurance", (a) => a.endurance);
  simple("weekendWarrior", (a) => a.weekend);
  simple("weekdayHero", (a) => a.weekday);
  simple("monthsActive", (a) => a.months.size);
  simple("uniqueCompetitions", (a) => a.competitions.size);
  simple("allRounder", (a) => Math.min(a.trackPerf, a.fieldPerf));
  simple("specialEvents", (a) => a.special);

  // Putkimestari — pisin peräkkäisten kisapäivien sarja
  pushTop(
    "longestStreak",
    list.map((a) => {
      const days = Array.from(a.competitionDays).sort();
      let best = days.length > 0 ? 1 : 0;
      let cur = best;
      for (let i = 1; i < days.length; i++) {
        const prev = new Date(days[i - 1] + "T12:00:00").getTime();
        const now = new Date(days[i] + "T12:00:00").getTime();
        const diffDays = Math.round((now - prev) / 86400000);
        if (diffDays === 1) {
          cur += 1;
          if (cur > best) best = cur;
        } else {
          cur = 1;
        }
      }
      return {
        athleteKey: a.athleteKey,
        name: a.name,
        organization: a.organization,
        value: best,
      };
    }),
  );

  return out;
}

function makeEmpty(): FunStatsResult {
  const byMetric = {} as Record<FunMetricKey, FunEntry[]>;
  for (const m of FUN_METRICS) byMetric[m.key] = [];
  return { byMetric, ageClasses: [] };
}
