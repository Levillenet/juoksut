// Niputus: yhdistää saman ajan + saman sukupuolen + saman erävaiheen
// Round-rivit yhdeksi ryhmäksi (esim. SM-kävelyt: naiset N30…N80
// alkavat klo 08 samasta lähdöstä, vaikka osa kävelee 5000 m ja osa 3000 m).
import type { Round } from "./tuloslista";

export interface RunGroup {
  key: string;
  beginISO: string;
  /** Ryhmän esitysnimi: yhdistetty puhdas matkanimi (esim. "5000 m / 3000 m kävely"). */
  baseName: string;
  gender: string;
  /** "Naiset"/"Miehet"/tyhjä – käytetään otsikossa. */
  genderLabel: string;
  /** Sarjamerkinnät jäsenten järjestyksessä (esim. ["N30","N35","N45"]). */
  ageClasses: string[];
  /** Uniikit matkanimet ryhmässä (esim. ["5000 m kävely","3000 m kävely"]). */
  distances: string[];
  rounds: Round[];
}

const AGE_PREFIX_RE = /^[NMWTP]\d{1,3}\s+/i;
const AGE_TOKEN_RE = /\b[NMWTP]\d{1,3}\b/i;

/** Poistaa ikäluokkaprefixin (esim. "N30 ") EventName-stringin alusta ja
 *  normalisoi välilyönnit. "N30 5000m kävely" → "5000m kävely". */
export function stripAgeFromEventName(name: string, _age?: string): string {
  return name
    .replace(AGE_PREFIX_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Sarjamerkki kuten "N45" — käytetään ikäluokkalapuksi niputetussa
 *  näkymässä. Lukee ensin `Age`-kentästä (kirjain `Gender`istä), muutoin
 *  poimii ensimmäisestä `EventName`-tokenista. */
export function seriesLabel(r: Pick<Round, "Age" | "Gender" | "EventName" | "Name">): string {
  const age = (r.Age || "").trim();
  if (age) {
    // Tuloslista palauttaa Age:n yleensä paljaana numerona ("30"). Liimataan
    // sukupuolen kirjain eteen ("N30"/"M30").
    if (/^\d+$/.test(age)) {
      const letter = r.Gender === "Female" ? "N" : r.Gender === "Male" ? "M" : "";
      return `${letter}${age}`;
    }
    return age;
  }
  const m = (r.EventName || "").match(AGE_TOKEN_RE);
  if (m) return m[0].toUpperCase();
  return (r.Name || "").trim();
}

function genderLabel(g: string): string {
  if (g === "Female") return "Naiset";
  if (g === "Male") return "Miehet";
  return "";
}

/** Niputusavain: sama lähtöhetki + sukupuoli + erävaihe (Name). Matkasta
 *  ei välitetä, jotta esim. naisten klo 8:00 lähtö nipuuttaa 5000 m ja
 *  3000 m kävelyt samaan korttiin. */
export function groupKey(r: Round): string {
  return `${r.BeginDateTimeWithTZ}|${r.Gender}|${r.Name}`;
}

export function groupRunningRounds(rounds: Round[]): RunGroup[] {
  const map = new Map<string, RunGroup>();
  for (const r of rounds) {
    const k = groupKey(r);
    const sLabel = seriesLabel(r);
    const dist = stripAgeFromEventName(r.EventName, r.Age) || r.EventName;
    const existing = map.get(k);
    if (existing) {
      existing.rounds.push(r);
      if (sLabel && !existing.ageClasses.includes(sLabel)) {
        existing.ageClasses.push(sLabel);
      }
      if (dist && !existing.distances.includes(dist)) {
        existing.distances.push(dist);
      }
    } else {
      map.set(k, {
        key: k,
        beginISO: r.BeginDateTimeWithTZ,
        baseName: dist,
        gender: r.Gender,
        genderLabel: genderLabel(r.Gender),
        ageClasses: sLabel ? [sLabel] : [],
        distances: dist ? [dist] : [],
        rounds: [r],
      });
    }
  }
  // Päivitä baseName jälkikäteen, jos matkoja on useita.
  for (const g of map.values()) {
    if (g.distances.length > 1) {
      g.baseName = g.distances.join(" / ");
    }
  }
  return Array.from(map.values());
}

/** Encode/decode round-niputuslista URL-search-parametriin. Muoto:
 *  "<eventId>-<roundId>,<eventId>-<roundId>,..." */
export function encodeGroupParam(pairs: { eventId: number; roundId: number }[]): string {
  return pairs.map((p) => `${p.eventId}-${p.roundId}`).join(",");
}

export function decodeGroupParam(
  raw: string | undefined | null,
): { eventId: number; roundId: number }[] {
  if (!raw) return [];
  const out: { eventId: number; roundId: number }[] = [];
  for (const part of raw.split(",")) {
    const m = part.trim().match(/^(\d+)-(\d+)$/);
    if (!m) continue;
    const eventId = parseInt(m[1], 10);
    const roundId = parseInt(m[2], 10);
    if (Number.isFinite(eventId) && Number.isFinite(roundId)) {
      out.push({ eventId, roundId });
    }
  }
  return out;
}
