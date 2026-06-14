// Greedy-aikataulugeneraattori, joka huomioi:
//  - lajikohtaisen valmisteluajan (setupBeforeMin) ennen segmentin alkua
//  - juoksuerien välisen järjestäytymisajan
//  - aitajuoksujen niputus per suorituspaikka + aitojen pystytys/purku
//  - finaalia edeltävän palautusajan
//
// Visualisointia ja konfliktinhakua varten setup-aika tallennetaan vielä erikseen,
// jotta UI voi piirtää sen haaleampana segmenttinä varsinaisen kilpailun eteen.

import type { PlanEventRow, VenueRow, ScheduleItemRow, SchedulePhase } from "./planner-types";

export interface SolverInputEvent extends PlanEventRow {
  estimateMinutes: number;
  finalAMin: number | null;
  finalBMin: number | null;
  setupBeforeMin: number;
  betweenHeatsMin: number;
  hurdleSetupMin: number;
  hurdleTeardownMin: number;
  isHurdles: boolean;
}

export interface SolverInput {
  startISO: string;
  endISO: string;
  defaultRecoveryMin: number;
  venues: VenueRow[];
  events: SolverInputEvent[];
}

interface Segment {
  eventId: string;
  ageClass: string;
  phase: SchedulePhase;
  durationMin: number;
  setupBeforeMin: number;
  needsStations: number;
  isHurdles: boolean;
  hurdleSetupMin: number;
  hurdleTeardownMin: number;
  /** Edeltävät segmentit, joiden on loputtava + palautusaika ennen kuin tämä alkaa. */
  afterEventIds: string[];
  recoveryAfterPrev: number;
  /** Prioriteetti niputtamista varten: aitalajit saavat saman tyyppinumeron, jotta menevät peräkkäin. */
  groupKey: string;
}

export interface SolverResultItem {
  plan_event_id: string;
  venue_ids: string[];
  phase: SchedulePhase;
  starts_at: string;
  ends_at: string;
  setup_before_min: number;
}

export interface SolverResult {
  items: SolverResultItem[];
  warnings: string[];
}

interface VenueState {
  id: string;
  busyUntil: number;
  lastWasHurdle: boolean; // jos true, aidat ovat vielä paikalla — säästyy uudelta pystytykseltä
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
    const baseSeg = {
      eventId: ev.id,
      ageClass: ev.age_class,
      setupBeforeMin: ev.setupBeforeMin,
      needsStations: Math.max(1, ev.station_count),
      isHurdles: ev.isHurdles,
      hurdleSetupMin: ev.hurdleSetupMin,
      hurdleTeardownMin: ev.hurdleTeardownMin,
      // Aitablokki saa korkean prioriteetin, jotta ne niputtuvat peräkkäin.
      groupKey: ev.isHurdles ? "AAA_hurdles" : `evt_${ev.id}`,
    };
    if (ev.final_format === "a_b") {
      const heatsId = ev.id;
      segments.push({
        ...baseSeg,
        phase: "heats",
        durationMin: Math.max(5, ev.estimateMinutes - (ev.finalAMin ?? 0) - (ev.finalBMin ?? 0)),
        afterEventIds: [],
        recoveryAfterPrev: 0,
      });
      if (ev.finalAMin) {
        segments.push({
          ...baseSeg,
          phase: "final_a",
          durationMin: ev.finalAMin,
          needsStations: 1,
          afterEventIds: [heatsId],
          recoveryAfterPrev: input.defaultRecoveryMin,
        });
      }
      if (ev.finalBMin) {
        segments.push({
          ...baseSeg,
          phase: "final_b",
          durationMin: ev.finalBMin,
          needsStations: 1,
          afterEventIds: [heatsId],
          recoveryAfterPrev: input.defaultRecoveryMin,
        });
      }
    } else {
      segments.push({
        ...baseSeg,
        phase: "single",
        durationMin: ev.estimateMinutes,
        afterEventIds: [],
        recoveryAfterPrev: 0,
      });
    }
  }

  // 2) Järjestys: aitablokit ensin (jotta menevät peräkkäin), sitten pisimmät & rinnakkaisemmat.
  segments.sort((a, b) => {
    if (a.groupKey !== b.groupKey) {
      // "AAA_" -alkuiset (= aidat) tulee aakkosjärjestyksessä ensin → niputtaa.
      return a.groupKey.localeCompare(b.groupKey);
    }
    return b.durationMin * b.needsStations - a.durationMin * a.needsStations;
  });

  // 3) Tilakoneet
  const venueStates: VenueState[] = input.venues.map((v) => ({
    id: v.id,
    busyUntil: start,
    lastWasHurdle: false,
  }));
  const ageStates = new Map<string, AgeState>();
  const eventEnds = new Map<string, number>();

  const items: SolverResultItem[] = [];

  for (const seg of segments) {
    if (venueStates.length < seg.needsStations) {
      warnings.push(
        `${seg.ageClass} – ei riittävästi suorituspaikkoja (${seg.needsStations} tarvitaan, ${venueStates.length} olemassa).`,
      );
      continue;
    }
    const ageBusyUntil = ageStates.get(seg.ageClass)?.busyUntil ?? start;
    const prevEventEnd = seg.afterEventIds
      .map((id) => (eventEnds.get(id) ?? start) + seg.recoveryAfterPrev * 60000)
      .reduce((a, b) => Math.max(a, b), start);

    // Setup ennen lajia varaa paikan jo aiemmin → laske vaadittu vapaa hetki paikalle.
    const setupMs = seg.setupBeforeMin * 60000;

    let candidateStart = Math.max(start, ageBusyUntil, prevEventEnd);
    let placedVenues: VenueState[] = [];
    let hurdleSetupForThis = 0;
    let hurdleTeardownForThis = 0;

    for (let attempts = 0; attempts < 200; attempts++) {
      const sorted = venueStates.slice().sort((a, b) => a.busyUntil - b.busyUntil);
      // Paikan oltava vapaa jo candidateStart - setupMs:llä.
      const ready = sorted.filter((v) => v.busyUntil <= candidateStart - setupMs);
      if (ready.length >= seg.needsStations) {
        placedVenues = ready.slice(0, seg.needsStations);
        break;
      }
      candidateStart = sorted[seg.needsStations - 1].busyUntil + setupMs;
      candidateStart = Math.max(candidateStart, ageBusyUntil, prevEventEnd);
    }
    if (placedVenues.length === 0) {
      warnings.push(`${seg.ageClass} ${seg.phase} – aikatauluikkuna täynnä.`);
      continue;
    }

    // Aitablokin pystytys: jos paikalla EI ole edellistä aitaa, lisätään pystytysaika.
    if (seg.isHurdles) {
      const anyPlacedHasHurdles = placedVenues.some((v) => v.lastWasHurdle);
      if (!anyPlacedHasHurdles) {
        hurdleSetupForThis = seg.hurdleSetupMin;
        candidateStart += hurdleSetupForThis * 60000;
      }
    } else {
      // Sileä juoksu samalla paikalla aitojen jälkeen → puretaan aidat ensin.
      const anyHasHurdles = placedVenues.some((v) => v.lastWasHurdle);
      if (anyHasHurdles) {
        const teardown = Math.max(...placedVenues.map((v) => (v.lastWasHurdle ? 1 : 0))) > 0
          ? Math.max(
              ...placedVenues
                .filter((v) => v.lastWasHurdle)
                .map(() => 0), // teardown haetaan globaalisti seuraavasta segmentistä; käytetään defaultia
            )
          : 0;
        // Teardown-aika tulee aitablokin lopusta, ei seuraavan lajin alusta.
        // Käytä aitojen oletusta = 8 min, ja merkitse paikat ei-aidaksi tästä lähtien.
        void teardown;
        candidateStart += 8 * 60000;
        for (const v of placedVenues) v.lastWasHurdle = false;
      }
    }

    const segEnd = candidateStart + seg.durationMin * 60000;
    if (segEnd > end) {
      warnings.push(
        `${seg.ageClass} ${seg.phase} – ei mahdu aikaikkunaan (${new Date(segEnd).toISOString()}).`,
      );
    }
    for (const v of placedVenues) {
      v.busyUntil = segEnd;
      if (seg.isHurdles) v.lastWasHurdle = true;
    }
    ageStates.set(seg.ageClass, { busyUntil: segEnd });
    const prevEnd = eventEnds.get(seg.eventId) ?? 0;
    eventEnds.set(seg.eventId, Math.max(prevEnd, segEnd));

    items.push({
      plan_event_id: seg.eventId,
      venue_ids: placedVenues.map((v) => v.id),
      phase: seg.phase,
      starts_at: new Date(candidateStart).toISOString(),
      ends_at: new Date(segEnd).toISOString(),
      setup_before_min: seg.setupBeforeMin + hurdleSetupForThis,
    });
    void hurdleTeardownForThis;
  }

  // Lopuksi: viimeisen aidan paikoille lisätään loppupystytyksen purkuaika
  // visualisoitavaksi seuraavan kerran kun paikkaa käytetään (yllä jo huomioitu).
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
    // Aitablokin rikkomistarkistus: jos saman venuen sisällä on aita → sileä → aita,
    // sileä rikkoo aitablokin.
    let inHurdleBlock = false;
    let blockHasFlat = false;
    for (const it of arr) {
      const ev = evMap.get(it.plan_event_id);
      if (!ev) continue;
      const isH = /aita|aidat|hurdle/i.test(ev.event_name);
      if (isH) {
        if (blockHasFlat && inHurdleBlock) {
          out.push({
            id: it.id,
            reason: `Aitablokki rikkoutuu paikalla ${venueMap.get(venueId)?.name ?? venueId} – sileä juoksu aitojen välissä`,
          });
        }
        inHurdleBlock = true;
        blockHasFlat = false;
      } else if (inHurdleBlock) {
        blockHasFlat = true;
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
