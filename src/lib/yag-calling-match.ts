// Matchaa YAG-callinglistan rivit tuloslista-kierroksiin.
//
// PDF käyttää sarjamerkintöjä M14/N14 ikäluokille 14, kun taas tuloslista
// käyttää P14/T14. Ikä 15 on molemmissa M15/N15. Sukupuoli päätellään
// alkukirjaimesta (M/P = poika, N/T = tyttö).

import type { IndexedEntry } from "./tuloslista-queries";
import { helsinkiDateKey } from "./tuloslista";
import type { YagCallingRow } from "@/data/yag-calling";
import { YAG_CALLING_ROWS } from "@/data/yag-calling";

export interface YagCallingHeatInfo {
  heat: number | null;
  calling: string;
  alkaa: string;
  kentalle: string;
  paikka: string;
}

export interface YagCallingMatch {
  row: YagCallingRow;
  entries: IndexedEntry[];
  /** Erä numero kun entryt on sidottu yhteen erään, muuten null. */
  heatNumber: number | null;
  /** Vain julkaisemattomille: koko lajin kaikkien erien calling-tiedot. */
  allHeats?: YagCallingHeatInfo[];
  /** Eränumerot joille ei löytynyt omaa calling-riviä; nämä entryt
   *  on liitetty tämän rivin alle huomautuksella. */
  overflowHeats?: number[];
}

/** Muotoilee erä-numerolistan luettavaksi: peräkkäiset → "5–11",
 *  ei-peräkkäiset → "5, 7, 9". */
export function formatHeatList(heats: number[]): string {
  if (heats.length === 0) return "";
  const s = [...heats].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = s[0];
  let prev = s[0];
  for (let i = 1; i <= s.length; i++) {
    const cur = s[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    if (cur != null) {
      start = cur;
      prev = cur;
    }
  }
  return ranges.join(", ");
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

function sarjaKey(s: SarjaKey): string {
  return `${s.boy ? "M" : "N"}${s.age}`;
}

/**
 * Pelkistää lajinimen vertailuavaimeksi: poistaa sarjaprefixin, erämerkinnän,
 * skandit ja normalisoi etäisyydet.
 */
function disciplineKey(raw: string): string {
  const x = raw
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

/** "heat" = alkuerät, "semi" = välierät, "final" = loppukilpailu,
 *  "" = ei vaihemerkintää (esim. pelkkä kenttälaji tai "60m"). */
type Phase = "" | "heat" | "semi" | "final";

function phaseTag(raw: string): Phase {
  const x = raw.toLowerCase().replace(/[äå]/g, "a").replace(/ö/g, "o");
  if (/loppukilpailu|finaali|\bfinal\b/.test(x)) return "final";
  if (/valier/.test(x)) return "semi";
  if (/alkuer/.test(x)) return "heat";
  return "";
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

/** Parsii calling-aikaleiman (esim. "8:18–8:28" tai "8:18-8:28") alkuajan minuuteiksi. */
export function callingStartMinutes(calling: string): number {
  const m = calling.match(/(\d{1,2}):(\d{2})/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number(m[1]) * 60 + Number(m[2]);
}


interface PdfGroup {
  date: string;
  sarja: SarjaKey;
  disc: string;
  rows: YagCallingRow[]; // aikajärjestyksessä
}

/**
 * Palauttaa calling-rivit (aikajärjestyksessä) joihin annetut entryt
 * matchaavat. Jokainen rivi sisältää listan urheilijoita.
 */
export function matchYagCalling(
  entries: IndexedEntry[],
): YagCallingMatch[] {
  // Ryhmittele PDF-rivit laji-avaimella (date|sarja|disc)
  const pdfGroups = new Map<string, PdfGroup>();
  for (const row of YAG_CALLING_ROWS) {
    const sarja = parseSarja(row.sarja);
    if (!sarja) continue;
    const disc = disciplineKey(row.laji);
    const key = `${row.date}|${sarjaKey(sarja)}|${disc}`;
    let g = pdfGroups.get(key);
    if (!g) {
      g = { date: row.date, sarja, disc, rows: [] };
      pdfGroups.set(key, g);
    }
    g.rows.push(row);
  }
  for (const g of pdfGroups.values()) {
    g.rows.sort((a, b) => callingStartMinutes(a.calling) - callingStartMinutes(b.calling));
  }


  // Esilaske entry-avaimet
  const indexed = entries.map((e) => {
    const sarja = sarjaFromRound(e.round.Gender, e.round.Age);
    const date = helsinkiDateKey(e.heatBegin);
    const disc = disciplineKey(`${e.round.EventName} ${e.round.Name ?? ""}`);
    return { entry: e, sarja, date, disc };
  });

  const out: YagCallingMatch[] = [];

  for (const g of pdfGroups.values()) {
    const rowDate = callingDateKey(g.date);
    // Entryt jotka kuuluvat tähän lajiryhmään
    const groupEntries = indexed.filter(
      (ix) =>
        ix.sarja &&
        sarjaEq(ix.sarja, g.sarja) &&
        ix.date === rowDate &&
        ix.disc === g.disc,
    );

    if (groupEntries.length === 0) continue;

    const hasHeatSplit = g.rows.length > 1 && g.rows.some((r) => parseHeat(r.laji) != null);

    if (!hasHeatSplit) {
      // Yksi rivi tai ei erä-jakoa: kaikki entryt samalle riville
      for (const row of g.rows) {
        out.push({
          row,
          entries: groupEntries.map((x) => x.entry),
          heatNumber: parseHeat(row.laji),
        });
      }
      continue;
    }

    // Erä-jaettu laji: erottele julkaistut ja julkaisemattomat
    const published = groupEntries.filter((x) => x.entry.heatIndex > 0);
    const unpublished = groupEntries.filter((x) => x.entry.heatIndex === 0);

    // Lajin viimeinen calling-erä; tätä isompien erien entryt ohjataan tänne
    // overflow-huomautuksella.
    const callingHeats = g.rows
      .map((r) => parseHeat(r.laji))
      .filter((h): h is number => h != null);
    const maxCallingHeat = callingHeats.length
      ? Math.max(...callingHeats)
      : null;
    const lastRow =
      maxCallingHeat != null
        ? g.rows.find((r) => parseHeat(r.laji) === maxCallingHeat)
        : null;

    const overflowByHeat = new Map<number, IndexedEntry[]>();
    if (maxCallingHeat != null && lastRow) {
      for (const x of published) {
        if (x.entry.heatIndex > maxCallingHeat) {
          const arr = overflowByHeat.get(x.entry.heatIndex) ?? [];
          arr.push(x.entry);
          overflowByHeat.set(x.entry.heatIndex, arr);
        }
      }
    }

    // Julkaistut: jaa erän mukaan
    for (const row of g.rows) {
      const heat = parseHeat(row.laji);
      const matched = published
        .filter(
          (x) =>
            heat == null ||
            (x.entry.heatIndex === heat &&
              (maxCallingHeat == null || x.entry.heatIndex <= maxCallingHeat)),
        )
        .map((x) => x.entry);

      // Liitä overflow-entryt viimeisen calling-rivin alle
      const isLast = row === lastRow;
      const overflowEntries = isLast
        ? [...overflowByHeat.entries()]
            .sort((a, b) => a[0] - b[0])
            .flatMap(([, es]) => es)
        : [];
      const overflowHeats = isLast
        ? [...overflowByHeat.keys()].sort((a, b) => a - b)
        : [];

      const allEntries = [...matched, ...overflowEntries];
      if (allEntries.length > 0) {
        out.push({
          row,
          entries: allEntries,
          heatNumber: heat,
          ...(overflowHeats.length ? { overflowHeats } : {}),
        });
      }
    }

    // Julkaisemattomat: yksi rivi, edustava = ensimmäinen erä, allHeats = kaikki
    if (unpublished.length > 0) {
      const allHeats: YagCallingHeatInfo[] = g.rows.map((r) => ({
        heat: parseHeat(r.laji),
        calling: r.calling,
        alkaa: r.alkaa,
        kentalle: r.kentalle,
        paikka: r.paikka,
      }));
      out.push({
        row: g.rows[0],
        entries: unpublished.map((x) => x.entry),
        heatNumber: null,
        allHeats,
      });
    }
  }

  return out;
}
