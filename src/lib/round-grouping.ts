// Niputus: yhdistää saman ajan + saman matkan/lajin + saman sukupuolen
// eri ikäluokkien Round-rivit yhdeksi ryhmäksi (esim. SM-kävelyt: naiset
// W30/W35/.../W70 alkavat klo 11 samassa lähdössä).
import type { Round } from "./tuloslista";

export interface RunGroup {
  key: string;
  beginISO: string;
  baseName: string; // EventName ilman ikäluokkaa
  gender: string;
  /** Sarjamerkinnät jäsenten järjestyksessä (esim. ["W30","W35","W45"]). */
  ageClasses: string[];
  rounds: Round[];
}

/** Poistaa EventName-stringistä Age-kentän sisällön (jos on) ja siistii välit. */
export function stripAgeFromEventName(name: string, age: string): string {
  let out = name;
  if (age && age.trim()) {
    const a = age.trim();
    // Poista esiintymät sanarajalla, case-insensitive.
    const re = new RegExp(`\\b${a.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, " ");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

export function groupKey(r: Round): string {
  const base = stripAgeFromEventName(r.EventName, r.Age);
  return `${r.BeginDateTimeWithTZ}|${r.Gender}|${base}|${r.Name}`;
}

export function groupRunningRounds(rounds: Round[]): RunGroup[] {
  const map = new Map<string, RunGroup>();
  for (const r of rounds) {
    const k = groupKey(r);
    const existing = map.get(k);
    const ageLabel = (r.Age || "").trim();
    if (existing) {
      existing.rounds.push(r);
      if (ageLabel && !existing.ageClasses.includes(ageLabel)) {
        existing.ageClasses.push(ageLabel);
      }
    } else {
      map.set(k, {
        key: k,
        beginISO: r.BeginDateTimeWithTZ,
        baseName: stripAgeFromEventName(r.EventName, r.Age) || r.EventName,
        gender: r.Gender,
        ageClasses: ageLabel ? [ageLabel] : [],
        rounds: [r],
      });
    }
  }
  // Säilytä alkuperäinen järjestys ensimmäisen jäsenen mukaan.
  return Array.from(map.values());
}

/** Sarjamerkki kuten "W45" — käytetään urheilijan ikäluokkalapuksi
 *  niputetussa näkymässä. Putoaa takaisin round.Name -arvoon jos Age tyhjä. */
export function seriesLabel(r: Pick<Round, "Age" | "Name">): string {
  const a = (r.Age || "").trim();
  if (a) return a;
  return (r.Name || "").trim();
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
