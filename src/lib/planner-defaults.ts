// YU-kentän vakiosuorituspaikat ja niiden nimeämislogiikka.
import type { VenueKind } from "./planner-types";
import { minutesPerHeat } from "./planner-rules";

export interface DefaultVenueSpec {
  key: string;
  label: string;
  kind: VenueKind;
  /** Suositeltu lukumäärä isolla kentällä */
  suggested: number;
  /** Nimimallin generaattori */
  nameFor: (index: number, total: number) => string;
}

const letters = "ABCDEFG";

export const DEFAULT_VENUES: DefaultVenueSpec[] = [
  {
    key: "sprint",
    label: "Pikajuoksusuora",
    kind: "track_straight",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Pikajuoksusuora ${letters[i]}` : "Pikajuoksusuora"),
  },
  {
    key: "oval",
    label: "Ovaali (rata)",
    kind: "track_oval",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Rata ${i + 1}` : "Rata"),
  },
  {
    key: "long_jump",
    label: "Pituushyppypaikka",
    kind: "jump_pit",
    suggested: 2,
    nameFor: (i, total) => (total > 1 ? `Pituuskuoppa ${letters[i]}` : "Pituuskuoppa"),
  },
  // HUOM: Kolmiloikalle EI luoda omaa suorituspaikkaa — se käyttää
  // pituuskuoppaa (jump_pit). Lisää tarvittaessa toinen Pituuskuoppa
  // (long_jump suggested ≥ 2) jos rinnakkaiskäyttö on tarpeen.

  {
    key: "high_jump",
    label: "Korkeushyppypaikka",
    kind: "high_jump",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Korkeushyppy ${letters[i]}` : "Korkeushyppy"),
  },
  {
    key: "pole_vault",
    label: "Seiväshyppypaikka",
    kind: "pole_vault",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Seiväshyppy ${letters[i]}` : "Seiväshyppy"),
  },
  {
    key: "shot",
    label: "Kuulakehä",
    kind: "shot_ring",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Kuulakehä ${i + 1}` : "Kuulakehä"),
  },
  {
    key: "discus",
    label: "Kiekkokehä (häkki)",
    kind: "throw_cage",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Kiekkokehä ${i + 1}` : "Kiekkokehä"),
  },
  {
    key: "javelin",
    label: "Keihäsvauhdinotto",
    kind: "throw_runway",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Keihäsvauhdinotto ${i + 1}` : "Keihäsvauhdinotto"),
  },
  {
    key: "hammer",
    label: "Moukarikehä (häkki)",
    kind: "throw_cage",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Moukarikehä ${i + 1}` : "Moukarikehä"),
  },
];

export function buildDefaultVenueRows(
  selection: Record<string, number>,
): Array<{ name: string; kind: VenueKind; sort_order: number }> {
  const rows: Array<{ name: string; kind: VenueKind; sort_order: number }> = [];
  let order = 0;
  for (const spec of DEFAULT_VENUES) {
    const count = selection[spec.key] ?? 0;
    for (let i = 0; i < count; i++) {
      rows.push({ name: spec.nameFor(i, count), kind: spec.kind, sort_order: order++ });
    }
  }
  return rows;
}

/** Onko laji sellainen, joka tyypillisesti tehdään tällä venue-tyypillä. */
export function isVenueForEvent(kind: VenueKind, eventName: string): boolean {
  const n = (eventName ?? "").toLowerCase();

  // Viestit aina ovaalille (käyvät kaarteen kautta). Tarkistetaan ENNEN
  // matkaparsintaa, koska "4x60m viesti" parsiutuisi 60 metriksi.
  if (/viesti|relay/.test(n)) return kind === "track_oval";

  // Kävelyt aina ovaalille.
  if (/kävely|kavely|walk/.test(n)) return kind === "track_oval";

  // Aitajuoksut: 60 m & 80 m aidat VAIN pikajuoksusuoralle. 100 m+ vain ovaalille.
  if (/aita|aidat|hurdle/.test(n)) {
    const d = parseDistanceM(n);
    if (d != null && d <= 80) return kind === "track_straight";
    return kind === "track_oval";
  }

  // Kenttälajit
  if (/pituus|long ?jump/.test(n)) return kind === "jump_pit";
  if (/kolmiloikka|triple/.test(n)) return kind === "jump_pit";
  if (/korkeus|high ?jump/.test(n)) return kind === "high_jump";
  if (/seiväs|seivas|pole ?vault/.test(n)) return kind === "pole_vault";
  if (/kuula|shot/.test(n)) return kind === "shot_ring" || kind === "throw_ring";
  if (/kiekko|discus/.test(n)) return kind === "throw_cage" || kind === "throw_ring";
  if (/moukari|hammer/.test(n)) return kind === "throw_cage" || kind === "throw_ring";
  if (/keihäs|keihas|javelin/.test(n)) return kind === "throw_runway";

  // Tavalliset juoksut: ≤ 100 m VAIN pikajuoksusuoralle, 150 m+ vain ovaalille.
  const dist = parseDistanceM(n);
  if (dist != null) {
    if (dist <= 100) return kind === "track_straight";
    return kind === "track_oval";
  }

  return kind === "other";
}

/**
 * Mitä spesifisempi suorituspaikka, sitä pienempi arvo (parempi).
 * Käytetään solverissa kun lajilla on useita kelvollisia suorituspaikkoja
 * — esim. kuula voi käyttää sekä shot_ring että throw_cage, mutta cage on
 * varattava ensisijaisesti moukarille/kiekolle (joilla ei muuta vaihtoehtoa).
 * Pienempi rank = käytetään ensin.
 */
export function venuePreferenceRank(kind: VenueKind, eventName: string): number {
  const n = (eventName ?? "").toLowerCase();
  if (/kuula|shot/.test(n)) {
    if (kind === "shot_ring") return 1;
    if (kind === "throw_ring") return 2;
    return 9; // throw_cage ei sallittu kuulalle
  }

  if (/moukari|hammer/.test(n) || /kiekko|discus/.test(n)) {
    if (kind === "throw_cage") return 1;
    if (kind === "throw_ring") return 2;
    return 9;
  }
  // Muut lajit: yksiselitteinen suorituspaikkatyyppi → kaikki samanarvoisia.
  return 1;
}


// Yksikkötestit isVenueForEvent-funktiolle (sanity checks):
// Lyhyet juoksut VAIN suoralla:
// console.assert(isVenueForEvent("track_straight", "M 40m"));
// console.assert(!isVenueForEvent("track_oval", "M 40m"));
// console.assert(isVenueForEvent("track_straight", "M 60m"));
// console.assert(!isVenueForEvent("track_oval", "M 60m"));
// console.assert(isVenueForEvent("track_straight", "M 80m"));
// console.assert(!isVenueForEvent("track_oval", "M 80m"));
// console.assert(isVenueForEvent("track_straight", "M 100m"));
// console.assert(!isVenueForEvent("track_oval", "M 100m"));
// 60 m / 80 m aidat VAIN suoralla:
// console.assert(isVenueForEvent("track_straight", "T11 60m aidat"));
// console.assert(!isVenueForEvent("track_oval", "T11 60m aidat"));
// console.assert(isVenueForEvent("track_straight", "T14 80m aidat"));
// console.assert(!isVenueForEvent("track_oval", "T14 80m aidat"));
// 150 m+ ja 100 m+ aidat VAIN ovaalilla:
// console.assert(isVenueForEvent("track_oval", "M 150m"));
// console.assert(!isVenueForEvent("track_straight", "M 150m"));
// console.assert(isVenueForEvent("track_oval", "M 200m"));
// console.assert(!isVenueForEvent("track_straight", "M 200m"));
// console.assert(isVenueForEvent("track_oval", "M 800m"));
// console.assert(!isVenueForEvent("track_straight", "M 800m"));
// console.assert(isVenueForEvent("track_oval", "M15 100m aidat"));
// console.assert(!isVenueForEvent("track_straight", "M15 100m aidat"));
// console.assert(isVenueForEvent("track_oval", "T14 300m aidat"));
// console.assert(!isVenueForEvent("track_straight", "T14 300m aidat"));
// Viestit ja kävelyt aina ovaalille:
// console.assert(isVenueForEvent("track_oval", "M 4x100m viesti"));
// console.assert(!isVenueForEvent("track_straight", "M 4x100m viesti"));
// console.assert(isVenueForEvent("track_oval", "T11 4x60m aitaviesti"));
// console.assert(!isVenueForEvent("track_straight", "T11 4x60m aitaviesti"));
// console.assert(isVenueForEvent("track_oval", "P11 1000m kävely"));
// console.assert(!isVenueForEvent("track_straight", "P11 1000m kävely"));

/**
 * Ohjearvo "aika per erä" (min) eri juoksumatkoille — YAG 2022.
 * Delegoituu `planner-rules.ts`:lle (yksi totuus).
 */
export function defaultMinutesPerHeat(eventName: string): number {
  return minutesPerHeat(eventName);
}

/**
 * Toimitsijoiden oletusmäärä lajille.
 * Säännöt YAG-aikataulutusohjeen pohjalta.
 */
export function getDefaultOfficialsCount(eventName: string, category: string | null | undefined): number {
  const n = (eventName ?? "").toLowerCase();
  const cat = (category ?? "").toLowerCase();
  const isTrackByName = /\d{2,5}\s*m\b|\d+\s*km|aita|aidat|hurdle|kävely|kavely|walk/.test(n);
  const isTrack = cat === "track" || isTrackByName;

  if (isTrack) {
    // Sääntö: kaikissa juoksulajeissa toimitsijatarve on 3
    // = 2 lähettäjää + 1 lähdön järjestelijä.
    // Lähettäjät ovat samat henkilöt kaikissa juoksuissa, eivätkä toimi
    // muissa toimitsijatehtävissä (ks. computeOfficialsTimeline).
    return 3;
  }

  // Kenttälajit
  if (/pituus|long ?jump|kolmiloikka|triple/.test(n)) return 4;   // tasohyppy
  if (/korkeus|high ?jump|seiväs|seivas|pole ?vault/.test(n)) return 4; // pystyhyppy
  if (/moukari|hammer|keihäs|keihas|javelin/.test(n)) return 6;   // pitkä heitto
  if (/kuula|shot|kiekko|discus/.test(n)) return 5;               // muut heitot

  return 3;
}

/** Parsi matka metreinä lajinimestä; null jos ei tunnistettu juoksumatka. */
export function parseDistanceM(eventName: string): number | null {
  const n = (eventName ?? "").toLowerCase();
  const km = n.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  if (km) return Math.round(parseFloat(km[1].replace(",", ".")) * 1000);
  const m = n.match(/(\d{2,5})\s*m\b/);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function isHurdleEvent(eventName: string): boolean {
  return /aita|aidat|hurdle/i.test(eventName ?? "");
}

/** Onko juoksulaji (mukaan lukien aidat). */
export function isRunningEvent(eventName: string): boolean {
  const n = (eventName ?? "").toLowerCase();
  return parseDistanceM(eventName) != null || /aita|aidat|hurdle|kävely|kavely|walk/.test(n);
}

/**
 * Matkanvaihtoaika (min) samalla suorituspaikalla peräkkäin järjestettäville juoksulajeille.
 * Jos eri suorituspaikat (sameVenue=false) → 0.
 * Jos sama matka ja molemmat samaa tyyppiä (sileä/aita) → 0.
 * Säännöt vastaavat tyypillisen pikajuoksusuoran lähtötelineiden siirtoa.
 */
export function getDistanceChangeoverMin(
  prevEvent: string | null | undefined,
  nextEvent: string,
  sameVenue: boolean,
): number {
  if (!sameVenue) return 0;
  if (!prevEvent) return 0;

  const prevD = parseDistanceM(prevEvent);
  const nextD = parseDistanceM(nextEvent);
  if (prevD == null || nextD == null) return 0;

  const prevH = isHurdleEvent(prevEvent);
  const nextH = isHurdleEvent(nextEvent);

  // Aitavaihto suuntaan tai toiseen
  if (prevH !== nextH) return 15;

  // Sama matka & sama tyyppi → ei siirtoa
  if (prevD === nextD) return 0;

  const lo = Math.min(prevD, nextD);
  const hi = Math.max(prevD, nextD);

  // Suora ↔ kaarrematka (≤100m → ≥200m)
  if (lo <= 100 && hi >= 200) return 10;

  // 200m ↔ 400m+ (samalta lähtöpaikalta)
  if (lo >= 200) return 5;

  // Lyhyet pikajuoksut keskenään
  if (lo <= 100 && hi <= 100) {
    if (lo === 40 && hi === 60) return 5;
    if (lo === 60 && hi === 100) return 10;
    if (lo === 40 && hi === 100) return 12;
    // muut yhdistelmät (esim. 50/80)
    return Math.max(5, Math.round((hi - lo) / 10));
  }

  return 5;
}

/** Ryhmittelyavain juoksulajeille: sama matka & tyyppi → sama avain. */
export function runningGroupKey(eventName: string): string | null {
  const d = parseDistanceM(eventName);
  if (d == null) return null;
  const h = isHurdleEvent(eventName) ? "H" : "F";
  return `${h}-${d}`;
}

export interface EventColor {
  bg: string;
  border: string;
  text: string;
  group: "sprint" | "run" | "horizontal" | "vertical" | "shortThrow" | "longThrow" | "combined" | "other";
}

/** Systemaattinen väri lajityypin mukaan. */
export function getEventColorClass(eventName: string, category: string | null | undefined): EventColor {
  const n = (eventName ?? "").toLowerCase();
  const cat = (category ?? "").toLowerCase();

  // Yhdistetyt lajit
  if (/moniottelu|pentathlon|heptathlon|decathlon|nelo|viisi|seitsem|kymmenottelu/.test(n)) {
    return { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-900", group: "combined" };
  }

  // Juoksut
  const dist = parseDistanceM(eventName);
  const isWalk = /kävely|kavely|walk/.test(n);
  const isRun = dist != null || isWalk || /aita|aidat|hurdle/.test(n) || cat === "track";
  if (isRun) {
    const isSprint = dist != null && dist <= 110 && !isWalk;
    if (isSprint) {
      return { bg: "bg-sky-100", border: "border-sky-300", text: "text-sky-900", group: "sprint" };
    }
    return { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-900", group: "run" };
  }

  // Hypyt
  if (/pituus|long ?jump|kolmiloikka|triple/.test(n)) {
    return { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-900", group: "horizontal" };
  }
  if (/korkeus|high ?jump|seiväs|seivas|pole ?vault/.test(n)) {
    return { bg: "bg-green-200", border: "border-green-400", text: "text-green-900", group: "vertical" };
  }

  // Heitot
  if (/kuula|shot/.test(n)) {
    return { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-900", group: "shortThrow" };
  }
  if (/kiekko|discus|moukari|hammer|keihäs|keihas|javelin/.test(n)) {
    return { bg: "bg-orange-200", border: "border-orange-400", text: "text-orange-900", group: "longThrow" };
  }

  return { bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-900", group: "other" };
}

// ===========================================================================
// Lähtöpaikat 400m radalla (lähettäjän siirtymien optimointia varten).
// ===========================================================================

export type StartLocation =
  | "sprint_track"   // Pikajuoksusuora (40–110m, 110m aidat)
  | "home_straight"  // Etusuora (1500m+, viestit, kävelyt)
  | "back_straight"  // Takasuora (150m, 1000m, 2000m)
  | "home_curve"     // Etukaarre (300–800m, 400m aidat)
  | "back_curve"     // Takakaarre (200m)
  | "field";         // Kenttälaji (ei lähettäjän siirtymää)

export const START_LOCATION_LABEL: Record<StartLocation, string> = {
  sprint_track: "Pikajuoksusuora",
  home_straight: "Etusuora",
  back_straight: "Takasuora",
  home_curve: "Etukaarre",
  back_curve: "Takakaarre",
  field: "Kenttälaji",
};

export function getStartLocation(eventName: string): StartLocation | null {
  const n = (eventName ?? "").toLowerCase();
  const dist = parseDistanceM(eventName);
  const isHurdle = /aita|aidat|hurdle/.test(n);
  const isRelay = /viesti|relay|^\s*\d+\s*x/i.test(eventName ?? "");
  const isWalk = /kävely|kavely|walk/.test(n);

  if (dist == null && !isRelay && !isWalk) return "field";
  if (isWalk) return "home_straight";

  if (isRelay && isHurdle) return "home_straight";
  if (isRelay && dist != null) {
    if (dist === 100) return "home_straight";
    if (dist >= 200) return "home_curve";
    return "home_straight";
  }

  if (isHurdle && dist != null) {
    if (dist <= 110) return "sprint_track";
    return "home_curve";
  }

  if (dist == null) return null;
  if (dist <= 100) return "sprint_track";
  if (dist === 150) return "back_straight";
  if (dist === 200) return "back_curve";
  if (dist >= 300 && dist <= 800) return "home_curve";
  if (dist === 1000) return "back_straight";
  if (dist === 2000) return "back_straight";
  return "home_straight";
}

export function getStartLocationChangeoverMin(
  prev: StartLocation | null,
  next: StartLocation | null,
): number {
  if (!prev || !next) return 0;
  if (prev === next) return 0;
  if (prev === "field" || next === "field") return 0;
  if (prev === "sprint_track" || next === "sprint_track") return 0;
  const pairs: Record<string, number> = {
    "home_straight-home_curve": 3,
    "home_straight-back_straight": 4,
    "home_straight-back_curve": 4,
    "home_curve-back_straight": 3,
    "home_curve-back_curve": 6,
    "back_straight-back_curve": 2,
  };
  const k1 = `${prev}-${next}`;
  const k2 = `${next}-${prev}`;
  return pairs[k1] ?? pairs[k2] ?? 3;
}

