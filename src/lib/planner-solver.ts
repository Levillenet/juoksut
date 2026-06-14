// Solver: monipäivätuki ja allowed_days-rajaus.

import type {
  PlanEventRow,
  VenueRow,
  ScheduleItemRow,
  SchedulePhase,
} from "./planner-types";

export interface SolverInputEvent extends PlanEventRow {
  estimateMinutes: number;
  finalAMin: number | null;
  finalBMin: number | null;
  setupBeforeMin: number;
  /** Aika per erä juoksulajissa (sisältää järjestäytymisen). */
  minutesPerHeatMin: number;
  hurdleSetupMin: number;
  hurdleTeardownMin: number;
  isHurdles: boolean;
}

export interface SolverDayWindow {
  date: string;
  startMs: number;
  endMs: number;
}

export interface SolverInput {
  windows: SolverDayWindow[];
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
  afterEventIds: string[];
  recoveryAfterPrev: number;
  groupKey: string;
  allowedDays: Set<string> | null;
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
  lastWasHurdle: boolean;
}

interface AgeState {
  busyUntil: number;
}

export function solve(input: SolverInput): SolverResult {
  const warnings: string[] = [];
  if (input.windows.length === 0) {
    return { items: [], warnings: ["Ei aikaikkunoita määritelty."] };
  }

  // 1) Pilko lajit segmenteiksi
  const segments: Segment[] = [];
  for (const ev of input.events) {
    const allowedDays = ev.allowed_days && ev.allowed_days.length > 0
      ? new Set(ev.allowed_days)
      : null;
    const baseSeg = {
      eventId: ev.id,
      ageClass: ev.age_class,
      setupBeforeMin: ev.setupBeforeMin,
      needsStations: Math.max(1, ev.station_count),
      isHurdles: ev.isHurdles,
      hurdleSetupMin: ev.hurdleSetupMin,
      hurdleTeardownMin: ev.hurdleTeardownMin,
      groupKey: ev.isHurdles ? "AAA_hurdles" : `evt_${ev.id}`,
      allowedDays,
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

  // 2) Järjestys: aitablokit ensin, sitten pisimmät & rinnakkaisemmat.
  segments.sort((a, b) => {
    if (a.groupKey !== b.groupKey) return a.groupKey.localeCompare(b.groupKey);
    return b.durationMin * b.needsStations - a.durationMin * a.needsStations;
  });

  // 3) Tilakoneet per päivä — venue/age "busyUntil" on globaali aikaleima (ms),
  // mutta segmentti kokeilee jokaista sallittua päivää järjestyksessä.
  const venueStates: VenueState[] = input.venues.map((v) => ({
    id: v.id,
    busyUntil: 0,
    lastWasHurdle: false,
  }));
  const ageStates = new Map<string, AgeState>();
  const eventEnds = new Map<string, number>();
  const items: SolverResultItem[] = [];

  // Reset venue busy alkuun ensimmäisen ikkunan alkuun
  for (const v of venueStates) v.busyUntil = input.windows[0].startMs;

  for (const seg of segments) {
    if (venueStates.length < seg.needsStations) {
      warnings.push(
        `${seg.ageClass} – ei riittävästi suorituspaikkoja (${seg.needsStations} tarvitaan, ${venueStates.length} olemassa).`,
      );
      continue;
    }

    let placed = false;
    for (const win of input.windows) {
      if (seg.allowedDays && !seg.allowedDays.has(win.date)) continue;

      const setupMs = seg.setupBeforeMin * 60000;
      const ageBusyUntil = ageStates.get(seg.ageClass)?.busyUntil ?? 0;
      const prevEventEnd = seg.afterEventIds
        .map((id) => (eventEnds.get(id) ?? 0) + seg.recoveryAfterPrev * 60000)
        .reduce((a, b) => Math.max(a, b), 0);

      let candidateStart = Math.max(win.startMs, ageBusyUntil, prevEventEnd);
      let placedVenues: VenueState[] = [];

      for (let attempts = 0; attempts < 200; attempts++) {
        const sorted = venueStates.slice().sort((a, b) => a.busyUntil - b.busyUntil);
        const ready = sorted.filter(
          (v) => v.busyUntil <= candidateStart - setupMs && candidateStart >= win.startMs,
        );
        if (ready.length >= seg.needsStations) {
          placedVenues = ready.slice(0, seg.needsStations);
          break;
        }
        const next = sorted[seg.needsStations - 1].busyUntil + setupMs;
        const newCandidate = Math.max(next, ageBusyUntil, prevEventEnd, win.startMs);
        if (newCandidate <= candidateStart) break; // ei etene
        candidateStart = newCandidate;
        if (candidateStart > win.endMs) break;
      }
      if (placedVenues.length === 0) continue;

      let hurdleSetupForThis = 0;
      if (seg.isHurdles) {
        const anyPlacedHasHurdles = placedVenues.some((v) => v.lastWasHurdle);
        if (!anyPlacedHasHurdles) {
          hurdleSetupForThis = seg.hurdleSetupMin;
          candidateStart += hurdleSetupForThis * 60000;
        }
      } else {
        const anyHasHurdles = placedVenues.some((v) => v.lastWasHurdle);
        if (anyHasHurdles) {
          candidateStart += 8 * 60000;
          for (const v of placedVenues) v.lastWasHurdle = false;
        }
      }

      const segEnd = candidateStart + seg.durationMin * 60000;
      if (segEnd > win.endMs) continue; // kokeile seuraavaa päivää

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
      placed = true;
      break;
    }
    if (!placed) {
      warnings.push(
        `${seg.ageClass} ${seg.phase} – ei mahdu mihinkään sallittuun päivään.`,
      );
    }
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
            reason: `Aitablokki rikkoutuu paikalla ${venueMap.get(venueId)?.name ?? venueId}`,
          });
        }
        inHurdleBlock = true;
        blockHasFlat = false;
      } else if (inHurdleBlock) {
        blockHasFlat = true;
      }
    }
  }

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
