// Yksinkertainen greedy-aikataulugeneraattori.
// Sijoittaa lajien segmentit (heats/single + final_a/final_b) suorituspaikoille
// niin että saman ikäryhmän kilpailut eivät mene päällekkäin ja että
// finaalia edeltää käyttäjän määräämä palautusaika.

import type { PlanEventRow, VenueRow, ScheduleItemRow, SchedulePhase } from "./planner-types";

export interface SolverInput {
  startISO: string;
  endISO: string;
  defaultRecoveryMin: number;
  venues: VenueRow[];
  events: Array<PlanEventRow & { estimateMinutes: number; finalAMin: number | null; finalBMin: number | null }>;
}

interface Segment {
  eventId: string;
  ageClass: string;
  phase: SchedulePhase;
  durationMin: number;
  needsStations: number;
  /** Edeltävät segmentit, joiden on loputtava + palautusaika ennen kuin tämä alkaa. */
  afterEventIds: string[];
  recoveryAfterPrev: number;
}

export interface SolverResultItem {
  plan_event_id: string;
  venue_ids: string[]; // 1+ paikkaa
  phase: SchedulePhase;
  starts_at: string;
  ends_at: string;
}

export interface SolverResult {
  items: SolverResultItem[];
  warnings: string[];
}

interface VenueState {
  id: string;
  busyUntil: number; // ms
}

interface AgeState {
  busyUntil: number;
}

export function solve(input: SolverInput): SolverResult {
  const start = new Date(input.startISO).getTime();
  const end = new Date(input.endISO).getTime();
  const warnings: string[] = [];

  // 1) Pilko lajit segmenteiksi
  const segments: Segment[] = [];
  for (const ev of input.events) {
    if (ev.final_format === "a_b") {
      const heatsId = ev.id;
      segments.push({
        eventId: ev.id,
        ageClass: ev.age_class,
        phase: "heats",
        durationMin: Math.max(5, ev.estimateMinutes - (ev.finalAMin ?? 0) - (ev.finalBMin ?? 0)),
        needsStations: Math.max(1, ev.station_count),
        afterEventIds: [],
        recoveryAfterPrev: 0,
      });
      if (ev.finalAMin) {
        segments.push({
          eventId: ev.id,
          ageClass: ev.age_class,
          phase: "final_a",
          durationMin: ev.finalAMin,
          needsStations: 1,
          afterEventIds: [heatsId],
          recoveryAfterPrev: input.defaultRecoveryMin,
        });
      }
      if (ev.finalBMin) {
        segments.push({
          eventId: ev.id,
          ageClass: ev.age_class,
          phase: "final_b",
          durationMin: ev.finalBMin,
          needsStations: 1,
          afterEventIds: [heatsId],
          recoveryAfterPrev: input.defaultRecoveryMin,
        });
      }
    } else {
      segments.push({
        eventId: ev.id,
        ageClass: ev.age_class,
        phase: "single",
        durationMin: ev.estimateMinutes,
        needsStations: Math.max(1, ev.station_count),
        afterEventIds: [],
        recoveryAfterPrev: 0,
      });
    }
  }

  // 2) Järjestä prioriteetilla: pisimmät + monta asemaa ensin.
  segments.sort((a, b) => b.durationMin * b.needsStations - a.durationMin * a.needsStations);

  // 3) Tilakoneet
  const venueStates: VenueState[] = input.venues.map((v) => ({ id: v.id, busyUntil: start }));
  const ageStates = new Map<string, AgeState>();
  const eventEnds = new Map<string, number>(); // eventId → viimeisen segmentin loppu (ms)

  const items: SolverResultItem[] = [];

  for (const seg of segments) {
    if (venueStates.length < seg.needsStations) {
      warnings.push(`${seg.ageClass} – ei riittävästi suorituspaikkoja (${seg.needsStations} tarvitaan, ${venueStates.length} olemassa).`);
      continue;
    }
    const ageBusyUntil = ageStates.get(seg.ageClass)?.busyUntil ?? start;
    const prevEventEnd = seg.afterEventIds
      .map((id) => (eventEnds.get(id) ?? start) + seg.recoveryAfterPrev * 60000)
      .reduce((a, b) => Math.max(a, b), start);

    // Etsi aikaisin slot, johon seg.needsStations vapaata paikkaa mahtuu rinnakkain.
    let candidateStart = Math.max(start, ageBusyUntil, prevEventEnd);
    let placedVenues: VenueState[] = [];
    for (let attempts = 0; attempts < 200; attempts++) {
      // Järjestä paikat busyUntil-ajan mukaan ja ota needsStations vapaaksi viimeistään candidateStartiin.
      const sorted = venueStates.slice().sort((a, b) => a.busyUntil - b.busyUntil);
      const ready = sorted.filter((v) => v.busyUntil <= candidateStart);
      if (ready.length >= seg.needsStations) {
        placedVenues = ready.slice(0, seg.needsStations);
        break;
      }
      // Aikaisin hetki kun tarpeeksi paikkoja vapaita: needsStations-pienin busyUntil.
      candidateStart = sorted[seg.needsStations - 1].busyUntil;
      candidateStart = Math.max(candidateStart, ageBusyUntil, prevEventEnd);
    }
    if (placedVenues.length === 0) {
      warnings.push(`${seg.ageClass} ${seg.phase} – aikatauluikkuna täynnä.`);
      continue;
    }
    const segEnd = candidateStart + seg.durationMin * 60000;
    if (segEnd > end) {
      warnings.push(`${seg.ageClass} ${seg.phase} – ei mahdu aikaikkunaan (${new Date(segEnd).toISOString()}).`);
    }
    for (const v of placedVenues) v.busyUntil = segEnd;
    ageStates.set(seg.ageClass, { busyUntil: segEnd });
    const prevEnd = eventEnds.get(seg.eventId) ?? 0;
    eventEnds.set(seg.eventId, Math.max(prevEnd, segEnd));

    items.push({
      plan_event_id: seg.eventId,
      venue_ids: placedVenues.map((v) => v.id),
      phase: seg.phase,
      starts_at: new Date(candidateStart).toISOString(),
      ends_at: new Date(segEnd).toISOString(),
    });
  }

  return { items, warnings };
}

/** Konfliktitarkistus käyttäjän muokkaamalle aikataululle. */
export function detectConflicts(
  items: ScheduleItemRow[],
  events: PlanEventRow[],
  venues: VenueRow[],
  defaultRecoveryMin: number,
): Array<{ id: string; reason: string }> {
  const evMap = new Map(events.map((e) => [e.id, e]));
  const venueMap = new Map(venues.map((v) => [v.id, v]));
  const out: Array<{ id: string; reason: string }> = [];

  // Sama suorituspaikka samaan aikaan.
  const byVenue = new Map<string, ScheduleItemRow[]>();
  for (const it of items) {
    const arr = byVenue.get(it.venue_id) ?? [];
    arr.push(it);
    byVenue.set(it.venue_id, arr);
  }
  for (const [venueId, arr] of byVenue) {
    arr.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].starts_at < arr[i - 1].ends_at) {
        out.push({
          id: arr[i].id,
          reason: `Päällekkäisyys paikalla ${venueMap.get(venueId)?.name ?? venueId}`,
        });
      }
    }
  }

  // Sama ikäryhmä samaan aikaan.
  const byAge = new Map<string, Array<ScheduleItemRow & { age: string }>>();
  for (const it of items) {
    const ev = evMap.get(it.plan_event_id);
    if (!ev) continue;
    const arr = byAge.get(ev.age_class) ?? [];
    arr.push({ ...it, age: ev.age_class });
    byAge.set(ev.age_class, arr);
  }
  for (const [age, arr] of byAge) {
    arr.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].starts_at < arr[i - 1].ends_at) {
        out.push({ id: arr[i].id, reason: `Sama ikäryhmä ${age} päällekkäin` });
      }
    }
  }

  // Heats → final palautusaika.
  const itemsByEvent = new Map<string, ScheduleItemRow[]>();
  for (const it of items) {
    const arr = itemsByEvent.get(it.plan_event_id) ?? [];
    arr.push(it);
    itemsByEvent.set(it.plan_event_id, arr);
  }
  for (const [eventId, arr] of itemsByEvent) {
    const heats = arr.find((i) => i.phase === "heats");
    if (!heats) continue;
    for (const f of arr) {
      if (f.phase !== "final_a" && f.phase !== "final_b") continue;
      const gapMin = (new Date(f.starts_at).getTime() - new Date(heats.ends_at).getTime()) / 60000;
      if (gapMin < defaultRecoveryMin) {
        const ev = evMap.get(eventId);
        out.push({
          id: f.id,
          reason: `Palautusaika alle ${defaultRecoveryMin} min (${Math.round(gapMin)} min) – ${ev?.event_name ?? ""}`,
        });
      }
    }
  }

  return out;
}
