// YU-kentän vakiosuorituspaikat ja niiden nimeämislogiikka.
import type { VenueKind } from "./planner-types";

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
    kind: "throw_ring",
    suggested: 1,
    nameFor: (i, total) => (total > 1 ? `Kuulakehä ${i + 1}` : "Kuulakehä"),
  },
  {
    key: "discus",
    label: "Kiekkokehä",
    kind: "throw_ring",
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
    label: "Moukarikehä",
    kind: "throw_ring",
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
  const n = eventName.toLowerCase();
  if (/aita|aidat|hurdle/.test(n)) return kind === "track_straight" || kind === "track_oval";
  if (/pituus|long ?jump/.test(n)) return kind === "jump_pit";
  if (/kolmiloikka|triple/.test(n)) return kind === "jump_pit";
  if (/korkeus|high ?jump/.test(n)) return kind === "high_jump";
  if (/seiväs|seivas|pole ?vault/.test(n)) return kind === "pole_vault";
  if (/kuula|shot/.test(n)) return kind === "throw_ring";
  if (/kiekko|discus/.test(n)) return kind === "throw_ring";
  if (/keihäs|keihas|javelin/.test(n)) return kind === "throw_runway";
  if (/moukari|hammer/.test(n)) return kind === "throw_ring";
  if (/\d{2,5}\s*m\b|\d+\s*km/.test(n)) return kind === "track_straight" || kind === "track_oval";
  return true;
}

/**
 * Ohjearvo "aika per erä" (min) eri juoksumatkoille — perustuu YAG 2022 -aikataulun
 * manuaaliseen suunnitelmaan. Sisältää järjestäytymisajan eli ei vaadi erillistä eräväliä.
 */
export function defaultMinutesPerHeat(eventName: string): number {
  const n = (eventName ?? "").toLowerCase();
  // Kävely
  if (/3\s*000\s*m\s*käv|3000\s*m\s*käv|3\s*km\s*käv/.test(n)) return 18;
  if (/1\s*000\s*m\s*käv|1000\s*m\s*käv|1\s*km\s*käv/.test(n)) return 10;
  // Pitkät matkat
  if (/\b(3000|5000|10000)\s*m\b|\b(3|5|10)\s*km\b/.test(n)) return 16;
  if (/\b(1500|2000)\s*m\b/.test(n)) return 10;
  if (/\b(600|800|1000)\s*m\b/.test(n)) return 8;
  // Keskimatkat ja aidat
  if (/\b400\s*m/.test(n)) return 7;
  if (/\b300\s*m/.test(n)) return 6;
  if (/\b(100|110|150)\s*m/.test(n)) return 5;
  if (/\b(40|60|80)\s*m/.test(n)) return 4;
  return 5;
}
