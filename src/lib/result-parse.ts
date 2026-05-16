// Yhteinen tulosten parsija.
//
// Suomalainen sopimus (jota tuloslista.com käyttää):
//
//   - "M.SS,xx"        4.42,40  = 4 min 42,40 s   (piste = yksikköerotin, pilkku = desimaali)
//   - "H.MM.SS,xx"     1.02.30,5 = 1 h 2 min 30,5 s
//   - "M,SS"           4,18     = 4 min 18 s      (vain juoksulajeissa, ei desimaaleja)
//   - "M:SS.xx"        4:42.40  = 4 min 42,40 s   (kansainvälinen muoto)
//   - "S,xx" / "S.xx"  12,34    = 12,34 s         (lyhyet juoksut)
//   - "M,xx" / "M.xx"  4,18     = 4,18 m          (kenttälajit)
//
// "M,SS" on epäselvä (voi olla aika tai metriluku) — ratkaistaan
// alakategoria + matka -perusteella.

const TIME_SUBCATEGORIES = new Set([
  "Run",
  "Sprint",
  "MiddleDistance",
  "LongDistance",
  "Hurdles",
  "Steeple",
  "Relay",
  "Walk",
  "RoadRun",
  "CrossCountry",
]);

const INVALID_RE = /^(DNF|DNS|DQ|NM|FAIL)$/i;

export function isTimeEvent(category: string, subCategory?: string): boolean {
  if (category === "Track") return true;
  if (subCategory && TIME_SUBCATEGORIES.has(subCategory)) return true;
  return false;
}

/** Yritä päätellä matka (m) lajinimestä, esim. "T9 1km" → 1000, "T13 2km" → 2000,
 * "T14 Maantiejuoksu" → null, "1000m" → 1000. */
export function eventDistanceMeters(eventName?: string): number | null {
  if (!eventName) return null;
  const m = eventName.toLowerCase();
  // "1km", "2 km", "10 km"
  const km = m.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  if (km) {
    const v = parseFloat(km[1].replace(",", "."));
    return Number.isFinite(v) ? Math.round(v * 1000) : null;
  }
  // "1000m", "60m aj", "800 m"
  const mm = m.match(/(\d{2,5})\s*m\b/);
  if (mm) {
    const v = parseInt(mm[1], 10);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

export interface ParseOptions {
  category?: string;
  subCategory?: string;
  eventName?: string;
}

/**
 * Parsi tulosteksti sekunteiksi (juoksu) tai metriksi (kenttä).
 * Palauttaa null jos ei pysty (DNF/DNS/tyhjä/parsimaton).
 */
export function parseResult(
  text: string | null | undefined,
  opts: ParseOptions = {},
): number | null {
  if (!text) return null;
  const t = text.trim();
  if (!t || INVALID_RE.test(t)) return null;

  const category = opts.category ?? "";
  const subCategory = opts.subCategory ?? "";
  const isTime = isTimeEvent(category, subCategory);

  // Strippaa kirjaimet (esim. "Q", "q", "h", "PB" suffixit jos niitä on)
  const cleaned = t.replace(/[a-zA-ZäöÄÖ]/g, "").trim();
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  const hasColon = cleaned.includes(":");

  // Kansainvälinen "M:SS.xx" tai "H:MM:SS.xx"
  if (hasColon) {
    const parts = cleaned.split(":").map((p) => parseFloat(p.replace(",", ".")));
    if (parts.some((n) => Number.isNaN(n))) return null;
    return parts.reduce((acc, x) => acc * 60 + x, 0);
  }

  // Suomalainen "M.SS,xx" / "H.MM.SS,xx" — piste = erotin, pilkku = desimaali
  if (hasComma && hasDot) {
    const [intPart, frac] = cleaned.split(",");
    const units = intPart.split(".").map((p) => parseFloat(p));
    if (units.some((n) => Number.isNaN(n))) return null;
    const fracNum = parseFloat(`0.${frac}`);
    if (Number.isNaN(fracNum)) return null;
    let secs = 0;
    for (const u of units) secs = secs * 60 + u;
    return secs + fracNum;
  }

  // Pelkkä pilkku — joko "M,SS" (aika ilman sadasosia) tai "X,YY" (desimaali)
  if (hasComma && !hasDot) {
    const [a, b] = cleaned.split(",");
    const aN = parseInt(a, 10);
    const bN = parseInt(b, 10);
    const looksLikeMinSec =
      isTime &&
      Number.isFinite(aN) &&
      Number.isFinite(bN) &&
      bN >= 0 &&
      bN <= 59 &&
      b.length === 2;
    if (looksLikeMinSec) {
      // Jos matka tiedetään ja se on ≥ 600 m, tulkitse aina min,sek.
      // Lyhyemmillä matkoilla (60–400 m) "12,34" on lähes aina sekunteja.
      const dist = eventDistanceMeters(opts.eventName);
      const isLongRun = dist != null ? dist >= 600 : aN >= 2; // fallback: ≥2 min → min,sek
      if (isLongRun) return aN * 60 + bN;
    }
    // Muuten desimaalitulkinta
    const v = parseFloat(cleaned.replace(",", "."));
    return Number.isNaN(v) ? null : v;
  }

  // Pelkkä piste tai pelkkä luku
  if (hasDot) {
    // Voi olla "M.SS" suomalainen aika ilman sadasosia (harvinaista), tai
    // desimaaliluku. Jos aika-laji ja näyttää muodossa M.SS (SS 00–59) ja
    // matka ≥ 600 m, tulkitaan min.sek.
    const parts = cleaned.split(".");
    if (parts.length === 2 && isTime) {
      const aN = parseInt(parts[0], 10);
      const bN = parseInt(parts[1], 10);
      const looksLikeMinSec =
        Number.isFinite(aN) &&
        Number.isFinite(bN) &&
        bN >= 0 &&
        bN <= 59 &&
        parts[1].length === 2;
      if (looksLikeMinSec) {
        const dist = eventDistanceMeters(opts.eventName);
        if (dist != null && dist >= 600) return aN * 60 + bN;
      }
    }
    const v = parseFloat(cleaned);
    return Number.isNaN(v) ? null : v;
  }

  const v = parseFloat(cleaned);
  return Number.isNaN(v) ? null : v;
}
