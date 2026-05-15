// Per-result "kauden kärki" -merkinnät: oliko tulos kauden ykkönen omana
// kilpailupäivänään, ja onko se edelleen kauden voimassa oleva ykkönen
// (sama normalisoitu lajinimi + ikäluokka, koko Suomen tulokset).

import { supabase } from "@/integrations/supabase/client";
import { isIndoorResult, normalizeEventName, type AthleteResultRow } from "@/lib/athlete-history";
import { seasonRange, type SeasonKind } from "@/lib/season-stats";

export interface SeasonTopFlag {
  /** Tulos oli kauden ykkönen sen kilpailupäivänään (mahd. myöhemmin ohitettu). */
  wasLeader: boolean;
  /** Tulos on edelleen kauden voimassa oleva ykkönen. */
  isCurrent: boolean;
  /** Voimassa oleva kauden kärki (sama event+age_class). */
  current: {
    resultText: string;
    resultNumeric: number;
    firstname: string;
    surname: string;
    athleteKey: string;
    competitionDate: string | null;
  } | null;
  /** Kauden tyyppi vertailussa. */
  season: SeasonKind;
}

interface LeaderRow {
  athlete_key: string;
  surname: string;
  firstname: string;
  event_name: string;
  result_text: string;
  result_numeric: number | null;
  competition_date: string | null;
}

const PAGE_SIZE = 1000;

function isTrackBetter(category: string, a: number, b: number): boolean {
  if (category === "Track") return a < b;
  return a > b;
}

/** Hae kaikki kauden rivit annetulle (ikäluokka + season range). */
async function fetchSeasonRowsForAgeClass(
  ageClass: string,
  range: { from: Date; to: Date },
): Promise<LeaderRow[]> {
  const out: LeaderRow[] = [];
  let offset = 0;
  const HARD_CAP = 50_000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("athlete_results")
      .select(
        "athlete_key, surname, firstname, event_name, result_text, result_numeric, competition_date",
      )
      .eq("age_class", ageClass)
      .gte("competition_date", range.from.toISOString())
      .lt("competition_date", range.to.toISOString())
      .not("result_numeric", "is", null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as LeaderRow[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (out.length >= HARD_CAP) break;
  }
  return out;
}

/**
 * Laskee kullekin urheilijan tulokselle kauden ykkös-merkinnät.
 * Vain kuluvan ulko- tai hallikauden tulokset saavat merkintöjä.
 */
export async function loadAthleteSeasonTopFlags(
  rows: AthleteResultRow[],
): Promise<Map<string, SeasonTopFlag>> {
  const result = new Map<string, SeasonTopFlag>();
  if (rows.length === 0) return result;

  const now = new Date();
  const outdoor = seasonRange("outdoor", now);
  const indoor = seasonRange("indoor", now);

  // Luokittele urheilijan rivit kuluvan ulko/halli-kauden alle.
  interface ScopedRow {
    row: AthleteResultRow;
    season: SeasonKind;
    range: { from: Date; to: Date };
  }
  const scoped: ScopedRow[] = [];
  for (const r of rows) {
    if (!r.competition_date || r.result_numeric == null) continue;
    const d = new Date(r.competition_date);
    if (Number.isNaN(d.getTime())) continue;
    if (d >= outdoor.from && d < outdoor.to) {
      scoped.push({ row: r, season: "outdoor", range: outdoor });
    } else if (d >= indoor.from && d < indoor.to) {
      // Halli-kausi vain jos heuristiikka tukee (ei pakollinen, mutta välttää
      // kesän tulosten luokittelua hallikaudeksi jos ne osuvat overlappiin).
      const indoorHint = isIndoorResult(r);
      if (indoorHint !== false) {
        scoped.push({ row: r, season: "indoor", range: indoor });
      }
    }
  }
  if (scoped.length === 0) return result;

  // Uniikit (season + age_class) -parit jotka pitää hakea.
  type Key = string; // `${season}|${ageClass}`
  const needed = new Map<Key, { season: SeasonKind; ageClass: string; range: { from: Date; to: Date } }>();
  for (const s of scoped) {
    const ageClass = s.row.age_class ?? "";
    if (!ageClass) continue;
    const k = `${s.season}|${ageClass}`;
    if (!needed.has(k)) needed.set(k, { season: s.season, ageClass, range: s.range });
  }

  // Hae rinnakkain.
  const fetched = new Map<Key, LeaderRow[]>();
  await Promise.all(
    Array.from(needed.entries()).map(async ([k, v]) => {
      const data = await fetchSeasonRowsForAgeClass(v.ageClass, v.range);
      fetched.set(k, data);
    }),
  );

  for (const s of scoped) {
    const ageClass = s.row.age_class ?? "";
    if (!ageClass) continue;
    const k = `${s.season}|${ageClass}`;
    const seasonRows = fetched.get(k);
    if (!seasonRows) continue;

    const normTarget = normalizeEventName(s.row.event_name).toLowerCase();
    const category = s.row.event_category;

    // Suodata samalle (normalisoitu) lajille.
    const same = seasonRows.filter(
      (r) => normalizeEventName(r.event_name).toLowerCase() === normTarget && r.result_numeric != null,
    );
    if (same.length === 0) continue;

    // Voimassa oleva kärki kaudella.
    let currentBest: LeaderRow | null = null;
    for (const r of same) {
      if (!currentBest || isTrackBetter(category, r.result_numeric!, currentBest.result_numeric!)) {
        currentBest = r;
      }
    }

    // Oliko tämä tulos kauden paras siihen päivään mennessä?
    const targetDate = s.row.competition_date!;
    const targetVal = s.row.result_numeric!;
    let bestUpToDate: number | null = null;
    for (const r of same) {
      if (!r.competition_date) continue;
      if (r.competition_date <= targetDate) {
        if (bestUpToDate == null || isTrackBetter(category, r.result_numeric!, bestUpToDate)) {
          bestUpToDate = r.result_numeric!;
        }
      }
    }

    const wasLeader =
      bestUpToDate != null &&
      // Athlete's result equals the best so far (ties: silti merkitään).
      !isTrackBetter(category, bestUpToDate, targetVal);

    const isCurrent =
      currentBest != null &&
      !isTrackBetter(category, currentBest.result_numeric!, targetVal);

    if (!wasLeader && !isCurrent) continue;

    result.set(s.row.id, {
      wasLeader,
      isCurrent,
      season: s.season,
      current: currentBest
        ? {
            resultText: currentBest.result_text,
            resultNumeric: currentBest.result_numeric!,
            firstname: currentBest.firstname,
            surname: currentBest.surname,
            athleteKey: currentBest.athlete_key,
            competitionDate: currentBest.competition_date,
          }
        : null,
    });
  }

  return result;
}
