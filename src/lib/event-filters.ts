// Maantie- ja maastojuoksujen tunnistus.
//
// Data tulee kolmessa eri muodossa (ks. .lovable/plan.md):
//   1) event_category === "Street"  (selkeät)
//   2) sub_category "RoadRun" / "CrossCountry"  (live-API:n arvot)
//   3) event_name sisältää "maantie" tai "maasto"  (väärin tagatut)
//
// Suodatus tehdään lukuhetkellä; data tallennetaan silti normaalisti.

const ROAD_CROSS_RX = /maantie|maasto|cross[- ]?country|road\s*run/i;

export function isRoadOrCrossCountry(r: {
  event_category?: string | null;
  sub_category?: string | null;
  event_name?: string | null;
}): boolean {
  if ((r.event_category ?? "") === "Street") return true;
  const sub = r.sub_category ?? "";
  if (sub === "RoadRun" || sub === "CrossCountry") return true;
  return ROAD_CROSS_RX.test(r.event_name ?? "");
}

/** Live-API Round/EventResults-muoto. */
export function isRoadOrCrossCountryRound(r: {
  Category?: string;
  SubCategory?: string;
  EventName?: string;
  EventCategory?: string;
  EventSubCategory?: string;
  Name?: string;
}): boolean {
  return isRoadOrCrossCountry({
    event_category: r.Category ?? r.EventCategory,
    sub_category: r.SubCategory ?? r.EventSubCategory,
    event_name: r.EventName ?? r.Name,
  });
}
