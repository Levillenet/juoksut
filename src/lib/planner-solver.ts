// Solver: monipäivätuki ja allowed_days-rajaus.

import type {
  PlanEventRow,
  VenueRow,
  ScheduleItemRow,
  SchedulePhase,
  ConflictGroupRow,
} from "./planner-types";
import {
  isVenueForEvent,
  getDistanceChangeoverMin,
  runningGroupKey,
  parseDistanceM,
  isHurdleEvent,
} from "./planner-defaults";

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
  /** Suorituspaikkojen rajoiteryhmät: max N samaan aikaan käytössä. */
  conflictGroups?: ConflictGroupRow[];
  /** Saako eri juoksumatkoja sijoittaa samalle suorituspaikalle? (oletus true) */
  allowDistanceChangeSameVenue?: boolean;
  /** Minimitauko (min) matkanvaihdon yhteydessä samalla suorituspaikalla. (oletus 5) */
  minDistanceChangeGapMin?: number;
}

interface Segment {
  eventId: string;
  eventName: string;
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
  /** KORJAUS 2: jos asetettu, segmentti pitää alkaa heti tämän vaiheen lopusta
   * (max maxGapAfterPhaseMin viiveellä) ja samoilla suorituspaikoilla. */
  afterPhaseKey?: string;
  maxGapAfterPhaseMin?: number;
  sameVenueAsPhase?: boolean;
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
  lastEventName: string | null;
}

interface AgeState {
  busyUntil: number;
}

export function solve(input: SolverInput): SolverResult {
  const warnings: string[] = [];
  const allowChange = input.allowDistanceChangeSameVenue !== false;
  const minChangeGap = Math.max(0, input.minDistanceChangeGapMin ?? 5);
  if (input.windows.length === 0) {
    return { items: [], warnings: ["Ei aikaikkunoita määritelty."] };
  }
  // Käytä vain included-paikkoja
  const usableVenues = input.venues.filter((v) => v.included !== false);
  const conflictGroups = (input.conflictGroups ?? []).map((g) => ({
    ...g,
    venue_ids: g.venue_ids.filter((vid) => usableVenues.some((v) => v.id === vid)),
  }));
  // Aikajanat per rajoiteryhmä: lista (startMs,endMs) sijoitetuista segmenteistä
  const groupBusy: Array<Array<{ s: number; e: number }>> = conflictGroups.map(() => []);

  // 1) Pilko lajit segmenteiksi
  const segments: Segment[] = [];
  for (const ev of input.events) {
    const allowedDays = ev.allowed_days && ev.allowed_days.length > 0
      ? new Set(ev.allowed_days)
      : null;
    const runKey = runningGroupKey(ev.event_name);
    const groupKey = ev.isHurdles
      ? `AAA_hurdles_${runKey ?? ev.id}`
      : runKey
        ? `BBB_run_${runKey}`
        : `CCC_evt_${ev.id}`;
    const baseSeg = {
      eventId: ev.id,
      eventName: ev.event_name,
      ageClass: ev.age_class,
      setupBeforeMin: ev.setupBeforeMin,
      needsStations: Math.max(1, ev.station_count),
      isHurdles: ev.isHurdles,
      hurdleSetupMin: ev.hurdleSetupMin,
      hurdleTeardownMin: ev.hurdleTeardownMin,
      groupKey,
      allowedDays,
    };
    if (ev.final_format === "a_b") {
      const heatsId = ev.id;
      // KORJAUS 4: estimateMinutes = alkuerien kesto (computeRuleEstimate palauttaa heats × perHeat).
      // A/B-finaalit ovat omat segmentit, niiden kestoja ei vähennetä heatsista.
      segments.push({
        ...baseSeg,
        phase: "heats",
        durationMin: Math.max(5, ev.estimateMinutes),
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

  // KORJAUS 1: vaihejärjestys saman eventin sisällä on kova rajoite.
  // heats (0) ennen final_a (1) ennen final_b (2). Single = 0.
  const phaseOrder = (p: SchedulePhase): number =>
    p === "heats" ? 0 : p === "final_a" ? 1 : p === "final_b" ? 2 : 0;

  // 2) Järjestys:
  //   - Saman eventin vaiheet aina heats → final_a → final_b (kova rajoite).
  //   - Muuten ryhmittele saman matkan juoksulajit; pisin & rinnakkaisin ensin.
  segments.sort((a, b) => {
    if (a.eventId === b.eventId) return phaseOrder(a.phase) - phaseOrder(b.phase);
    if (a.groupKey !== b.groupKey) return a.groupKey.localeCompare(b.groupKey);
    return b.durationMin * b.needsStations - a.durationMin * a.needsStations;
  });

  // 3) Tilakoneet per päivä — venue/age "busyUntil" on globaali aikaleima (ms),
  // mutta segmentti kokeilee jokaista sallittua päivää järjestyksessä.
  const venueStates: VenueState[] = usableVenues.map((v) => ({
    id: v.id,
    busyUntil: 0,
    lastWasHurdle: false,
    lastEventName: null,
  }));
  const ageStates = new Map<string, AgeState>();
  const eventEnds = new Map<string, number>();
  const items: SolverResultItem[] = [];

  // Reset venue busy alkuun ensimmäisen ikkunan alkuun
  for (const v of venueStates) v.busyUntil = input.windows[0].startMs;

  const venueKindById = new Map(usableVenues.map((v) => [v.id, v.kind]));

  // Apufunktio: löytyykö rajoiteryhmissä esteitä annetulla välillä?
  // Palauttaa aikaleiman johon mennessä este vapautuu (tai 0 jos ei estettä).
  const groupBlockUntil = (placedIds: string[], startMs: number, endMs: number): number => {
    let blockUntil = 0;
    for (let i = 0; i < conflictGroups.length; i++) {
      const g = conflictGroups[i];
      const usesGroup = placedIds.some((id) => g.venue_ids.includes(id));
      if (!usesGroup) continue;
      const overlapping = groupBusy[i].filter((b) => b.s < endMs && b.e > startMs);
      if (overlapping.length + 1 > g.max_concurrent) {
        const soonestFree = Math.min(...overlapping.map((b) => b.e));
        if (soonestFree > blockUntil) blockUntil = soonestFree;
      }
    }
    return blockUntil;
  };

  for (const seg of segments) {
    const segIsRun = parseDistanceM(seg.eventName) != null || isHurdleEvent(seg.eventName);
    const segDist = parseDistanceM(seg.eventName);
    const segHurdle = isHurdleEvent(seg.eventName);

    // Per-venue siirtoaika (ms) edellisestä juoksulajista tähän segmenttiin.
    const venueChangeoverMs = (vs: VenueState): number => {
      if (!vs.lastEventName) return 0;
      const co = getDistanceChangeoverMin(vs.lastEventName, seg.eventName, true);
      if (co === 0) return 0;
      return Math.max(co, minChangeGap) * 60000;
    };


    const eligibleStates = venueStates.filter((vs) => {
      const kind = venueKindById.get(vs.id);
      if (!kind || !isVenueForEvent(kind, seg.eventName)) return false;
      // Jos käyttäjä ei salli matkanvaihtoa samalla suorituspaikalla,
      // estä juoksupaikat joilla on aiempi eri matkan/tyypin juoksu.
      if (!allowChange && segIsRun && vs.lastEventName) {
        const prevDist = parseDistanceM(vs.lastEventName);
        const prevHurdle = isHurdleEvent(vs.lastEventName);
        if (prevDist != null && (prevDist !== segDist || prevHurdle !== segHurdle)) {
          return false;
        }
      }
      return true;
    });
    if (eligibleStates.length < seg.needsStations) {
      warnings.push(
        `${seg.ageClass} ${seg.eventName} – ei sopivaa suorituspaikkaa (${seg.needsStations} tarvitaan).`,
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

      // Per-venue "free at" huomioi siirtoajan.
      const freeAt = (vs: VenueState) => vs.busyUntil + venueChangeoverMs(vs);

      let candidateStart = Math.max(win.startMs, ageBusyUntil, prevEventEnd);
      let placedVenues: VenueState[] = [];

      for (let attempts = 0; attempts < 400; attempts++) {
        const sorted = eligibleStates.slice().sort((a, b) => freeAt(a) - freeAt(b));
        const ready = sorted.filter(
          (v) => freeAt(v) <= candidateStart - setupMs && candidateStart >= win.startMs,
        );
        if (ready.length >= seg.needsStations) {
          const cand = ready.slice(0, seg.needsStations);
          const candEnd = candidateStart + seg.durationMin * 60000;
          const blocked = groupBlockUntil(cand.map((v) => v.id), candidateStart, candEnd);
          if (blocked === 0) {
            placedVenues = cand;
            break;
          }
          candidateStart = blocked;
          if (candidateStart > win.endMs) break;
          continue;
        }
        const next = freeAt(sorted[seg.needsStations - 1]) + setupMs;
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
        if (segIsRun) v.lastEventName = seg.eventName;
      }
      ageStates.set(seg.ageClass, { busyUntil: segEnd });
      const prevEnd = eventEnds.get(seg.eventId) ?? 0;
      eventEnds.set(seg.eventId, Math.max(prevEnd, segEnd));

      // Päivitä konfliktiryhmien aikajanat
      const placedIds = placedVenues.map((v) => v.id);
      for (let i = 0; i < conflictGroups.length; i++) {
        if (placedIds.some((id) => conflictGroups[i].venue_ids.includes(id))) {
          groupBusy[i].push({ s: candidateStart, e: segEnd });
        }
      }

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

export type ConflictSeverity = "critical" | "high" | "warning";
export interface Conflict {
  id: string;
  reason: string;
  severity: ConflictSeverity;
  /** Muut aikatauluitemit jotka liittyvät samaan konfliktiin. */
  relatedIds?: string[];
}

/** Konfliktitarkistus käyttäjän muokkaamalle aikataululle. */
export function detectConflicts(
  items: ScheduleItemRow[],
  events: PlanEventRow[],
  venues: VenueRow[],
  defaultRecoveryMin: number,
  conflictGroups: ConflictGroupRow[] = [],
): Conflict[] {
  const evMap = new Map(events.map((e) => [e.id, e]));
  const venueMap = new Map(venues.map((v) => [v.id, v]));
  const out: Conflict[] = [];

  // Suorituspaikan tyyppi vs. laji
  for (const it of items) {
    const ev = evMap.get(it.plan_event_id);
    const v = venueMap.get(it.venue_id);
    if (!ev || !v) continue;
    if (!isVenueForEvent(v.kind, ev.event_name)) {
      out.push({
        id: it.id,
        severity: "high",
        reason: `Laji "${ev.event_name}" ei kuulu suorituspaikalle ${v.name}`,
      });
    }
  }

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
          severity: "high",
          relatedIds: [arr[i - 1].id],
          reason: `Päällekkäisyys paikalla ${venueMap.get(venueId)?.name ?? venueId}`,
        });
      }
      const prevEv = evMap.get(arr[i - 1].plan_event_id);
      const curEv = evMap.get(arr[i].plan_event_id);
      if (prevEv && curEv) {
        const need = getDistanceChangeoverMin(prevEv.event_name, curEv.event_name, true);
        if (need > 0) {
          const gap =
            (new Date(arr[i].starts_at).getTime() -
              new Date(arr[i - 1].ends_at).getTime()) /
            60000;
          if (gap < need) {
            out.push({
              id: arr[i].id,
              severity: "warning",
              relatedIds: [arr[i - 1].id],
              reason: `Matkanvaihto paikalla ${venueMap.get(venueId)?.name ?? venueId}: ${prevEv.event_name} → ${curEv.event_name} tarvitsee ${need} min siirron (nyt ${Math.round(gap)} min).`,
            });
          }
        }
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
            severity: "warning",
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
        out.push({
          id: arr[i].id,
          severity: "critical",
          relatedIds: [arr[i - 1].id],
          reason: `Sama ikäryhmä ${age} päällekkäin`,
        });
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
    const finalA = arr.find((i) => i.phase === "final_a");
    const finalB = arr.find((i) => i.phase === "final_b");
    const ev = evMap.get(eventId);

    // KORJAUS 6a: finaali ennen alkueriä (kriittinen — fyysisesti mahdoton)
    if (heats) {
      for (const f of [finalA, finalB]) {
        if (!f) continue;
        if (f.starts_at < heats.starts_at) {
          out.push({
            id: f.id,
            severity: "critical",
            relatedIds: [heats.id],
            reason: `Finaali (${f.phase}) ennen alkueriä – ${ev?.event_name ?? ""}`,
          });
        }
      }
    }

    // Palautusaika heats → finaali
    if (heats) {
      for (const f of [finalA, finalB]) {
        if (!f) continue;
        const gapMin =
          (new Date(f.starts_at).getTime() - new Date(heats.ends_at).getTime()) / 60000;
        if (gapMin >= 0 && gapMin < defaultRecoveryMin) {
          out.push({
            id: f.id,
            severity: "high",
            relatedIds: [heats.id],
            reason: `Palautusaika alle ${defaultRecoveryMin} min (${Math.round(gapMin)} min) – ${ev?.event_name ?? ""}`,
          });
        }
      }
    }

    // KORJAUS 6b: final_b pitää olla heti final_a:n jälkeen (max 5 min)
    if (finalA && finalB) {
      const gapMin =
        (new Date(finalB.starts_at).getTime() - new Date(finalA.ends_at).getTime()) / 60000;
      if (gapMin < 0) {
        out.push({
          id: finalB.id,
          severity: "critical",
          relatedIds: [finalA.id],
          reason: `B-finaali alkaa ennen A-finaalin päättymistä – ${ev?.event_name ?? ""}`,
        });
      } else if (gapMin > 5) {
        out.push({
          id: finalB.id,
          severity: "high",
          relatedIds: [finalA.id],
          reason: `A- ja B-finaalin välissä ${Math.round(gapMin)} min (max 5 min) – ${ev?.event_name ?? ""}`,
        });
      }
    }
  }

  // Konfliktiryhmät: aikahetkellä max_concurrent ylittyminen
  if (conflictGroups.length > 0) {
    const includedVenueIds = new Set(venues.filter((v) => v.included !== false).map((v) => v.id));
    for (const g of conflictGroups) {
      const activeVenueIds = g.venue_ids.filter((id) => includedVenueIds.has(id));
      if (activeVenueIds.length === 0) continue;
      const relevant = items
        .filter((it) => activeVenueIds.includes(it.venue_id))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      for (let i = 0; i < relevant.length; i++) {
        const it = relevant[i];
        const overlapping = relevant.filter(
          (o, j) => j !== i && o.starts_at < it.ends_at && o.ends_at > it.starts_at,
        );
        if (overlapping.length + 1 > g.max_concurrent) {
          out.push({
            id: it.id,
            severity: "high",
            relatedIds: overlapping.map((o) => o.id),
            reason: `Rajoiteryhmä "${g.name}" rikkoutuu (max ${g.max_concurrent} samaan aikaan)`,
          });
        }
      }
    }
  }

  return out;
}
