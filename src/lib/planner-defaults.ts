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
  {
    key: "triple_jump",
    label: "Kolmiloikkapaikka",
    kind: "jump_pit",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Kolmiloikka ${letters[i]}` : "Kolmiloikka"),
  },
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
  if (/aita|aidat|hurdle/.test(n)) return kind === "track_straight" || kind === "track_oval";
  if (/pituus|long ?jump/.test(n)) return kind === "jump_pit";
  if (/kolmiloikka|triple/.test(n)) return kind === "jump_pit";
  if (/korkeus|high ?jump/.test(n)) return kind === "high_jump";
  if (/seiväs|seivas|pole ?vault/.test(n)) return kind === "pole_vault";
  if (/kuula|shot/.test(n)) return kind === "shot_ring" || kind === "throw_ring";
  if (/kiekko|discus/.test(n)) return kind === "throw_cage" || kind === "throw_ring";
  if (/moukari|hammer/.test(n)) return kind === "throw_cage" || kind === "throw_ring";
  if (/keihäs|keihas|javelin/.test(n)) return kind === "throw_runway";
  if (/\d{2,5}\s*m\b|\d+\s*km/.test(n)) return kind === "track_straight" || kind === "track_oval";
  return kind === "other";
}

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
    if (/aita|aidat|hurdle/.test(n)) return 6;          // 2 lähettäjää + 1 + 3 aidan asetteluun
    if (/kävely|kavely|walk/.test(n)) return 4;         // + tarkkailijat
    const distMatch = n.match(/(\d+(?:[.,]\d+)?)\s*(km|m)\b/);
    if (distMatch) {
      const num = parseFloat(distMatch[1].replace(",", "."));
      const meters = distMatch[2] === "km" ? num * 1000 : num;
      if (meters >= 800) return 3;
      return 3;
    }
    return 3;
  }

  // Kenttälajit
  if (/pituus|long ?jump|kolmiloikka|triple/.test(n)) return 4;   // tasohyppy
  if (/korkeus|high ?jump|seiväs|seivas|pole ?vault/.test(n)) return 4; // pystyhyppy
  if (/moukari|hammer|keihäs|keihas|javelin/.test(n)) return 6;   // pitkä heitto
  if (/kuula|shot|kiekko|discus/.test(n)) return 5;               // muut heitot

  return 3;
}
