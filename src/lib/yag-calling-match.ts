// Matchaa YAG-callinglistan rivit tuloslista-kierroksiin.
//
// PDF käyttää sarjamerkintöjä M14/N14 ikäluokille 14, kun taas tuloslista
// käyttää P14/T14. Ikä 15 on molemmissa M15/N15. Sukupuoli päätellään
// alkukirjaimesta (M/P = poika, N/T = tyttö).

import type { IndexedEntry } from "./tuloslista-queries";
import { helsinkiDateKey } from "./tuloslista";
import type { YagCallingRow } from "@/data/yag-calling";
import { YAG_CALLING_ROWS } from "@/data/yag-calling";

export interface YagCallingMatch {
  row: YagCallingRow;
  entries: IndexedEntry[];
  /** Erä numero PDF:stä jos kyseessä rata-erä */
  heatNumber: number | null;
}

interface SarjaKey {
  boy: boolean;
  age: number;
}

function parseSarja(sarja: string): SarjaKey | null {
  const m = sarja.match(/^([MNPT])(\d+)$/i);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  return { boy: letter === "M" || letter === "P", age: parseInt(m[2], 10) };
}

function sarjaFromRound(gender: string, age: string): SarjaKey | null {
  const a = parseInt(age, 10);
  if (!Number.isFinite(a)) return null;
  return { boy: gender === "Male", age: a };
}

function sarjaEq(a: SarjaKey, b: SarjaKey): boolean {
  return a.boy === b.boy && a.age === b.age;
}

/**
 * Pelkistää lajinimen vertailuavaimeksi: poistaa sarjaprefixin, erämerkinnän,
 * skandit ja normalisoi etäisyydet.
 */
function disciplineKey(raw: string): string {
  let x = raw
    .toLowerCase()
    .replace(/\(er[äa]\s*\d+\)/g, "")
    .replace(/^[mnpt]\d+\s+/i, "")
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/\s+/g, " ")
    .trim();

  // Aitaviesti (4x60m, 4x80m...)
  if (/aitaviesti/.test(x) || (/4x/.test(x) && /aidat/.test(x))) {
    const m = x.match(/4x(\d+)/);
    return m ? `aitaviesti${m[1]}` : "aitaviesti";
  }
  // Viesti (4x100m, 4x600m, 4x50m, 4x800m)
  if (/\bviesti\b/.test(x) || /^4x/.test(x)) {
    const m = x.match(/4x(\d+)/);
    return m ? `viesti${m[1]}` : "viesti";
  }
  // Aidat
  if (/\baidat\b/.test(x)) {
    const m = x.match(/(\d+)\s*m/);
    return m ? `aidat${m[1]}` : "aidat";
  }
  // Kävely
  if (/kavely/.test(x)) {
    const m = x.match(/(\d+)\s*m/);
    return m ? `kavely${m[1]}` : "kavely";
  }
  // Pelkkä juoksumatka: 60m, 100m, 150m, 200m, 300m, 800m, 40m, 1000m...
  const runM = x.match(/^(\d+)\s*m\b/);
  if (runM) return `juoksu${runM[1]}`;

  // Kenttälajit (suomenkielinen sana)
  for (const k of [
    "pituus",
    "kolmiloikka",
    "korkeus",
    "seivas",
    "kuula",
    "kiekko",
    "moukari",
    "keihas",
  ]) {
    if (x.includes(k)) return k;
  }
  return x.replace(/\s+/g, "");
}

function parseHeat(laji: string): number | null {
  const m = laji.match(/\(er[äa]\s*(\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Helsingin paikallinen päivämääräavain calling-rivin "YYYY-MM-DD":stä. */
function callingDateKey(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}.${m}.${y}`;
}

/**
 * Palauttaa calling-rivit (aikajärjestyksessä) joihin annetut entryt
 * matchaavat. Jokainen rivi sisältää listan urheilijoita.
 */
export function matchYagCalling(
  entries: IndexedEntry[],
): YagCallingMatch[] {
  // Esilaske entry-avaimet
  const indexed = entries.map((e) => {
    const sarja = sarjaFromRound(e.round.Gender, e.round.Age);
    const date = helsinkiDateKey(e.heatBegin);
    const disc = disciplineKey(`${e.round.EventName} ${e.round.Name ?? ""}`);
    return { entry: e, sarja, date, disc };
  });

  const out: YagCallingMatch[] = [];
  for (const row of YAG_CALLING_ROWS) {
    const rowSarja = parseSarja(row.sarja);
    if (!rowSarja) continue;
    const rowDate = callingDateKey(row.date);
    const rowDisc = disciplineKey(row.laji);
    const heat = parseHeat(row.laji);

    const matched: IndexedEntry[] = [];
    for (const ix of indexed) {
      if (!ix.sarja) continue;
      if (!sarjaEq(ix.sarja, rowSarja)) continue;
      if (ix.date !== rowDate) continue;
      if (ix.disc !== rowDisc) continue;
      // Jos rivissä erä-numero ja entryllä on heatIndex>0, niiden tulee täsmätä
      if (heat != null && ix.entry.heatIndex > 0 && ix.entry.heatIndex !== heat) {
        continue;
      }
      matched.push(ix.entry);
    }
    if (matched.length > 0) {
      out.push({ row, entries: matched, heatNumber: heat });
    }
  }
  return out;
}
