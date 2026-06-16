import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Maximize2, Minimize2, Minus, Plus, RotateCcw, Rows3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveDayWindows,
  type PlanRow,
  type VenueRow,
  type PlanEventRow,
  type ScheduleItemRow,
} from "@/lib/planner-types";
import { resolveTimings } from "@/lib/planner-timings";
import { getEventColorClass, isVenueForEvent } from "@/lib/planner-defaults";
import { computeRuleEstimate } from "@/lib/planner-rules";
import { formatEventLabel, normalizeEventName } from "@/lib/event-name";
import type { Conflict, ConflictSeverity } from "@/lib/planner-solver";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  plan: PlanRow;
  venues: VenueRow[];
  events: PlanEventRow[];
  schedule: ScheduleItemRow[];
  conflicts: Conflict[];
  /** Aikatauluitemien id:t joita korostetaan hetkellisesti. */
  highlightIds?: string[];
  /** Kun käyttäjä klikkaa palkkia (ei vetää). */
  onSelectItem?: (id: string) => void;
  onChange: () => void;
}

const SEVERITY_ORDER: Record<ConflictSeverity, number> = {
  critical: 3,
  high: 2,
  warning: 1,
};

const ROW_HEIGHT_DEFAULT = 48;
const ROW_HEIGHT_MIN = 28;
const ROW_HEIGHT_MAX = 96;
// Sticky left column with venue/age labels. Smaller on mobile.
const LEFT_COL_DESKTOP = 180;
const LEFT_COL_MOBILE = 120;
// pixels-per-minute bounds (user can zoom in/out within these)
const MIN_PX_PER_MIN = 2;
const MAX_PX_PER_MIN = 50;
// auto-fit bounds (default when no user zoom)
const AUTOFIT_MIN = 4;
const AUTOFIT_MAX = 20;

function ageClassSort(a: string, b: string): number {
  const order = (s: string) => {
    const ch = s.charAt(0);
    const ord = { T: 0, P: 1, N: 2, M: 3 }[ch] ?? 9;
    const num = parseInt(s.slice(1)) || 99;
    return ord * 100 + num;
  };
  return order(a) - order(b);
}

const LEGEND: Array<{ label: string; cls: string }> = [
  { label: "Pikajuoksut", cls: "bg-sky-200 border-sky-400" },
  { label: "Pidemmät juoksut", cls: "bg-blue-200 border-blue-400" },
  { label: "Tasohypyt", cls: "bg-emerald-200 border-emerald-400" },
  { label: "Pystyhypyt", cls: "bg-green-300 border-green-500" },
  { label: "Kuula", cls: "bg-amber-200 border-amber-400" },
  { label: "Pitkät heitot", cls: "bg-orange-300 border-orange-500" },
  { label: "Yhdistetyt", cls: "bg-purple-200 border-purple-400" },
];

export function PlannerFullGantt({
  plan,
  venues,
  events,
  schedule,
  conflicts,
  highlightIds,
  onSelectItem,
  onChange,
}: Props) {
  const windows = useMemo(() => resolveDayWindows(plan), [plan]);
  const [dayIdx, setDayIdx] = useState(0);
  const [showEmpty, setShowEmpty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hideLegend, setHideLegend] = useState(false);
  const [compactNames, setCompactNames] = useState(false);

  const rowHeightKey = `planner_gantt_row_height_${plan.id}`;
  const [ROW_HEIGHT, setRowHeight] = useState<number>(() => {
    if (typeof window === "undefined") return ROW_HEIGHT_DEFAULT;
    const raw = window.localStorage.getItem(rowHeightKey) ?? window.localStorage.getItem("ganttRowHeight");
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= ROW_HEIGHT_MIN && n <= ROW_HEIGHT_MAX ? n : ROW_HEIGHT_DEFAULT;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(rowHeightKey, String(ROW_HEIGHT));
      window.localStorage.setItem("ganttRowHeight", String(ROW_HEIGHT));
    } catch {
      /* noop */
    }
  }, [ROW_HEIGHT, rowHeightKey]);
  const bumpRowHeight = useCallback(
    (delta: number) =>
      setRowHeight((h) => Math.max(ROW_HEIGHT_MIN, Math.min(ROW_HEIGHT_MAX, h + delta))),
    [],
  );
  const resetRowHeight = useCallback(() => setRowHeight(ROW_HEIGHT_DEFAULT), []);
  const evMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const venueMap = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues]);

  // Pidä per id-konflikti, joka on vakavin
  const conflictMap = useMemo(() => {
    const m = new Map<string, Conflict>();
    for (const c of conflicts) {
      const prev = m.get(c.id);
      if (!prev || SEVERITY_ORDER[c.severity] > SEVERITY_ORDER[prev.severity]) {
        m.set(c.id, c);
      }
    }
    return m;
  }, [conflicts]);

  // Mikä taulukon item on osana mitä-tahansa konfliktia (myös relatedIds)
  const conflictedAnyIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) {
      s.add(c.id);
      c.relatedIds?.forEach((id) => s.add(id));
    }
    return s;
  }, [conflicts]);

  const highlightSet = useMemo(
    () => new Set(highlightIds ?? []),
    [highlightIds],
  );
  const isHighlightActive = highlightSet.size > 0;

  const ageClasses = useMemo(
    () => Array.from(new Set(events.map((e) => e.age_class))).sort(ageClassSort),
    [events],
  );

  const win = windows[Math.min(dayIdx, Math.max(0, windows.length - 1))];

  // Pyöristä päivän aikaikkuna tasatuntiin
  const { startMs, endMs, hourTicks, fiveTicks } = useMemo(() => {
    if (!win) return { startMs: 0, endMs: 0, hourTicks: [] as number[], fiveTicks: [] as number[] };
    const startDate = new Date(win.startMs);
    startDate.setMinutes(0, 0, 0);
    const endDate = new Date(win.endMs);
    if (endDate.getMinutes() !== 0 || endDate.getSeconds() !== 0) {
      endDate.setHours(endDate.getHours() + 1, 0, 0, 0);
    }
    const sMs = startDate.getTime();
    const eMs = endDate.getTime();
    const totalMin = (eMs - sMs) / 60000;
    const hours: number[] = [];
    for (let m = 0; m <= totalMin; m += 60) hours.push(m);
    const fives: number[] = [];
    for (let m = 0; m < totalMin; m += 5) fives.push(m);
    return { startMs: sMs, endMs: eMs, hourTicks: hours, fiveTicks: fives };
  }, [win]);

  const totalMin = (endMs - startMs) / 60000;

  // ── Responsive layout & zoom ─────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({ left: 0, width: 1, view: 1 });
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window === "undefined" ? 1200 : window.innerWidth,
  );

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      left: el.scrollLeft,
      width: Math.max(1, el.scrollWidth),
      view: Math.max(1, el.clientWidth),
    });
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) {
        setContainerWidth((prev) => (Math.abs(w - prev) > 4 ? w : prev));
        window.requestAnimationFrame(updateScrollState);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollState]);

  const isMobile = containerWidth > 0 && containerWidth < 768;
  const LEFT_COL = isMobile ? LEFT_COL_MOBILE : LEFT_COL_DESKTOP;

  const zoomKey = `planner_gantt_zoom_${plan.id}`;
  const [zoomFactor, setZoomFactor] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const raw = window.localStorage.getItem(zoomKey);
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(zoomKey, String(zoomFactor));
    } catch {
      /* noop */
    }
  }, [zoomFactor, zoomKey]);

  const autoFitPxMin = useMemo(() => {
    if (!totalMin || containerWidth <= 0) return 8;
    const avail = Math.max(200, containerWidth - LEFT_COL - 24);
    return Math.max(AUTOFIT_MIN, Math.min(AUTOFIT_MAX, avail / totalMin));
  }, [totalMin, containerWidth, LEFT_COL]);

  const pxPerMin = Math.max(
    MIN_PX_PER_MIN,
    Math.min(MAX_PX_PER_MIN, autoFitPxMin * zoomFactor),
  );
  const PX_PER_5MIN = pxPerMin * 5;
  const totalWidth = LEFT_COL + (totalMin / 5) * PX_PER_5MIN;
  const zoomPercent = Math.round((pxPerMin / autoFitPxMin) * 100);
  const miniThumbWidth = Math.min(100, (scrollState.view / scrollState.width) * 100);
  const miniThumbLeft = Math.min(
    Math.max(0, (scrollState.left / scrollState.width) * 100),
    Math.max(0, 100 - miniThumbWidth),
  );

  const zoomIn = useCallback(
    () => setZoomFactor((z) => Math.min(z * 1.5, MAX_PX_PER_MIN / Math.max(0.01, autoFitPxMin))),
    [autoFitPxMin],
  );
  const zoomOut = useCallback(
    () => setZoomFactor((z) => Math.max(z * 0.67, MIN_PX_PER_MIN / Math.max(0.01, autoFitPxMin))),
    [autoFitPxMin],
  );
  const zoomReset = useCallback(() => setZoomFactor(1), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        zoomReset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, zoomReset]);

  // Pikanäppäimet rivien korkeudelle (+ / − / 0) ja fullscreenistä ulos (Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        return;
      }
      // Ohita kun käyttäjä kirjoittaa kenttään
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable))
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        bumpRowHeight(8);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        bumpRowHeight(-8);
      } else if (e.key === "0") {
        e.preventDefault();
        resetRowHeight();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bumpRowHeight, resetRowHeight, isFullscreen]);

  useEffect(() => {
    updateScrollState();
  }, [totalWidth, containerWidth, updateScrollState]);

  const dragRef = useRef<{
    id: string;
    isUnplaced: boolean;
    eventId?: string;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
    origStart: number;
    origEnd: number;
    origVenueId: string;
    origRowIdx: number;
    origTop: number;
    barEl: HTMLElement;
    sectionEl: HTMLElement | null;
  } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const autoScrollVRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });

  const updateTime = useMutation({
    mutationFn: async (p: {
      id: string;
      starts_at: string;
      ends_at: string;
      venue_id?: string;
    }) => {
      const payload: {
        starts_at: string;
        ends_at: string;
        auto_generated: boolean;
        venue_id?: string;
      } = {
        starts_at: p.starts_at,
        ends_at: p.ends_at,
        auto_generated: false,
      };
      if (p.venue_id) payload.venue_id = p.venue_id;
      const { error } = await supabase
        .from("plan_schedule_items")
        .update(payload)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });

  const createItem = useMutation({
    mutationFn: async (p: {
      plan_event_id: string;
      venue_id: string;
      starts_at: string;
      ends_at: string;
    }) => {
      const { error } = await supabase.from("plan_schedule_items").insert({
        plan_id: plan.id,
        plan_event_id: p.plan_event_id,
        venue_id: p.venue_id,
        phase: "single",
        starts_at: p.starts_at,
        ends_at: p.ends_at,
        auto_generated: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Laji sijoitettu aikatauluun");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message ?? "Sijoitus epäonnistui"),
  });

  // Lajit joita solver ei sijoittanut: ei yhtään schedule-riviä.
  const unplacedEvents = useMemo(() => {
    const placed = new Set(schedule.map((s) => s.plan_event_id));
    return events.filter((e) => !placed.has(e.id));
  }, [events, schedule]);

  const eventDurationMin = useCallback((ev: PlanEventRow): number => {
    if (ev.override_duration_min && ev.override_duration_min > 0) return ev.override_duration_min;
    try {
      const r = computeRuleEstimate({
        event_name: ev.event_name,
        sub_category: ev.sub_category,
        participants: ev.participants,
        station_count: ev.station_count,
        heat_size: ev.heat_size,
      });
      return Math.max(5, r.minutes);
    } catch {
      return 30;
    }
  }, []);

  // Tiivis pakkaus: sijoittamattomat lajit asetellaan useammalle riville
  // first-fit -menetelmällä, säästäen pystytilaa.
  const unplacedAreaWidth = Math.max(200, totalWidth - LEFT_COL);
  const unplacedLayout = useMemo(() => {
    const GAP = 4;
    const rowFill: number[] = [];
    const items = unplacedEvents.map((ev) => {
      const dur = eventDurationMin(ev);
      const width = Math.max(40, (dur / 5) * PX_PER_5MIN - 2);
      let rowIdx = rowFill.findIndex((cursor) => cursor + width <= unplacedAreaWidth);
      if (rowIdx === -1) {
        rowIdx = rowFill.length;
        rowFill.push(0);
      }
      const left = rowFill[rowIdx];
      rowFill[rowIdx] = left + width + GAP;
      return { ev, left, top: rowIdx * ROW_HEIGHT + 3, width, dur };
    });
    return { items, rowCount: Math.max(1, rowFill.length) };
  }, [unplacedEvents, eventDurationMin, PX_PER_5MIN, unplacedAreaWidth]);

  const dayItems = useMemo(
    () =>
      schedule.filter((s) => {
        const t = new Date(s.starts_at).getTime();
        return t >= startMs - 3600000 && t < endMs + 6 * 3600 * 1000;
      }),
    [schedule, startMs, endMs],
  );

  if (!win) {
    return <p className="p-6 text-sm text-muted-foreground">Aseta perustietoihin päivän aikaikkuna.</p>;
  }
  if (venues.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Lisää suorituspaikat välilehdellä "Suorituspaikat" nähdäksesi kalenterin.
      </p>
    );
  }

  const onPointerDown = (e: React.PointerEvent, item: ScheduleItemRow) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const orig = new Date(item.starts_at).getTime();
    const origEnd = new Date(item.ends_at).getTime();
    const barEl = e.currentTarget as HTMLElement;
    const sectionEl = barEl.closest<HTMLElement>('[data-section="venue"]');
    const origTop = parseFloat(barEl.style.top || "0");
    const origRowIdx = Math.max(0, Math.round((origTop - 3) / ROW_HEIGHT));
    dragRef.current = {
      id: item.id,
      isUnplaced: false,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      startScrollTop: scrollRef.current?.scrollTop ?? 0,
      origStart: orig,
      origEnd,
      origVenueId: item.venue_id,
      origRowIdx,
      origTop,
      barEl,
      sectionEl,
    };
    barEl.setPointerCapture(e.pointerId);
  };

  const onUnplacedPointerDown = (e: React.PointerEvent, ev: PlanEventRow) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const barEl = e.currentTarget as HTMLElement;
    const origTop = parseFloat(barEl.style.top || "0");
    dragRef.current = {
      id: `unplaced-${ev.id}`,
      isUnplaced: true,
      eventId: ev.id,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      startScrollTop: scrollRef.current?.scrollTop ?? 0,
      origStart: 0,
      origEnd: 0,
      origVenueId: "",
      origRowIdx: 0,
      origTop,
      barEl,
      sectionEl: null,
    };
    barEl.style.zIndex = "60";
    barEl.setPointerCapture(e.pointerId);
  };

  const stopAutoScroll = () => {
    if (autoScrollRafRef.current != null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    autoScrollVRef.current = { vx: 0, vy: 0 };
  };

  const maybeAutoScroll = (clientX: number, clientY: number) => {
    const sc = scrollRef.current;
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    const EDGE = 70;
    const MAX = 22;
    let vy = 0;
    let vx = 0;
    if (clientY < r.top + EDGE)
      vy = -MAX * Math.min(1, (r.top + EDGE - clientY) / EDGE);
    else if (clientY > r.bottom - EDGE)
      vy = MAX * Math.min(1, (clientY - (r.bottom - EDGE)) / EDGE);
    if (clientX < r.left + EDGE)
      vx = -MAX * Math.min(1, (r.left + EDGE - clientX) / EDGE);
    else if (clientX > r.right - EDGE)
      vx = MAX * Math.min(1, (clientX - (r.right - EDGE)) / EDGE);
    autoScrollVRef.current = { vx, vy };
    if (vx === 0 && vy === 0) {
      stopAutoScroll();
      return;
    }
    if (autoScrollRafRef.current != null) return;
    const tick = () => {
      if (!dragRef.current) {
        stopAutoScroll();
        return;
      }
      const v = autoScrollVRef.current;
      if (v.vx === 0 && v.vy === 0) {
        stopAutoScroll();
        return;
      }
      const el = scrollRef.current;
      if (el) {
        el.scrollTop += v.vy;
        el.scrollLeft += v.vx;
      }
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };
    autoScrollRafRef.current = requestAnimationFrame(tick);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const sc = scrollRef.current;
    const scrollDx = (sc?.scrollLeft ?? 0) - d.startScrollLeft;
    const scrollDy = (sc?.scrollTop ?? 0) - d.startScrollTop;
    const dx = e.clientX - d.startX + scrollDx;
    const minutes = Math.round(dx / PX_PER_5MIN) * 5;
    const els = document.querySelectorAll<HTMLElement>(`[data-bar-id="${d.id}"]`);
    els.forEach((el) => {
      const baseLeft = parseFloat(el.dataset.baseLeft || "0");
      el.style.left = `${baseLeft + minutes * (PX_PER_5MIN / 5)}px`;
    });
    if (d.isUnplaced) {
      const dy = e.clientY - d.startY + scrollDy;
      d.barEl.style.top = `${d.origTop + dy}px`;
    } else if (d.sectionEl) {
      const dy = e.clientY - d.startY + scrollDy;
      const rowDelta = Math.round(dy / ROW_HEIGHT);
      const maxIdx = Math.max(0, venueRows.length - 1);
      const newIdx = Math.min(maxIdx, Math.max(0, d.origRowIdx + rowDelta));
      d.barEl.style.top = `${newIdx * ROW_HEIGHT + 3}px`;
    }
    maybeAutoScroll(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    stopAutoScroll();
    if (!d) return;

    if (d.isUnplaced) {
      const ev = events.find((x) => x.id === d.eventId);
      // Palauta visuaalinen sijainti aina
      const baseLeft = parseFloat(d.barEl.dataset.baseLeft || "0");
      d.barEl.style.left = `${baseLeft}px`;
      d.barEl.style.top = `${d.origTop}px`;
      d.barEl.style.zIndex = "";
      if (!ev) return;
      const venueGrid = document.querySelector<HTMLElement>('[data-section="venue"]');
      if (!venueGrid) {
        toast.error("Raahaa blokki suorituspaikkariville.");
        return;
      }
      const rect = venueGrid.getBoundingClientRect();
      const yIn = e.clientY - rect.top;
      const xIn = e.clientX - rect.left;
      if (yIn < 0 || yIn > venueRows.length * ROW_HEIGHT || xIn < 0) {
        toast.error("Raahaa blokki suorituspaikkariville.");
        return;
      }
      const rowIdx = Math.min(
        venueRows.length - 1,
        Math.max(0, Math.floor(yIn / ROW_HEIGHT)),
      );
      const target = venueRows[rowIdx];
      const venue = venueMap.get(target.id);
      if (!venue || !isVenueForEvent(venue.kind, ev.event_name)) {
        toast.error(
          `Lajia "${ev.event_name}" ei voi sijoittaa suorituspaikalle ${venue?.name ?? "?"}.`,
        );
        return;
      }
      const minutes = Math.max(0, Math.round(xIn / PX_PER_5MIN) * 5);
      const dur = eventDurationMin(ev);
      const starts = new Date(startMs + minutes * 60000);
      const ends = new Date(starts.getTime() + dur * 60000);
      createItem.mutate({
        plan_event_id: ev.id,
        venue_id: target.id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
      });
      return;
    }

    const el = document.querySelector<HTMLElement>(`[data-bar-id="${d.id}"]`);
    if (!el) return;
    const baseLeft = parseFloat(el.dataset.baseLeft || "0");
    const finalLeft = parseFloat(el.style.left || `${baseLeft}`);
    const minutes = Math.round((finalLeft - baseLeft) / PX_PER_5MIN) * 5;

    let newVenueId: string | undefined;
    if (d.sectionEl) {
      const finalTop = parseFloat(d.barEl.style.top || `${d.origTop}`);
      const newRowIdx = Math.max(0, Math.round((finalTop - 3) / ROW_HEIGHT));
      if (newRowIdx !== d.origRowIdx) {
        const target = venueRows[newRowIdx];
        if (target && target.id !== d.origVenueId) {
          const ev = evMap.get(
            schedule.find((s) => s.id === d.id)?.plan_event_id ?? "",
          );
          const targetVenue = venueMap.get(target.id);
          if (ev && targetVenue && !isVenueForEvent(targetVenue.kind, ev.event_name)) {
            toast.error(
              `Lajia "${ev.event_name}" ei voi sijoittaa suorituspaikalle ${targetVenue.name}.`,
            );
            // Palauta visuaalinen sijainti
            d.barEl.style.top = `${d.origTop}px`;
            if (minutes === 0) return;
          } else {
            newVenueId = target.id;
          }
        }
      }
    }

    if (minutes === 0 && !newVenueId) {
      onSelectItem?.(d.id);
      return;
    }
    const newStart = new Date(d.origStart + minutes * 60000);
    const newEnd = new Date(d.origEnd + minutes * 60000);
    updateTime.mutate({
      id: d.id,
      starts_at: newStart.toISOString(),
      ends_at: newEnd.toISOString(),
      venue_id: newVenueId,
    });
  };

  const renderBar = (
    s: ScheduleItemRow,
    rowIdx: number,
    keyPrefix: string,
  ) => {
    const ev = evMap.get(s.plan_event_id);
    if (!ev) return null;
    const t = resolveTimings(ev, plan);
    const startOff = (new Date(s.starts_at).getTime() - startMs) / 60000;
    const dur = (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000;
    if (startOff + dur < 0 || startOff > totalMin) return null;
    const left = (startOff / 5) * PX_PER_5MIN;
    const width = Math.max(18, (dur / 5) * PX_PER_5MIN - 2);
    const top = rowIdx * ROW_HEIGHT + 3;
    const conflict = conflictMap.get(s.id);
    const heats = t.isTrack ? Math.max(1, Math.ceil((ev.participants || 0) / 8)) : 1;
    const phase = s.phase;
    const primary = compactNames ? ev.event_name : `${ev.age_class} ${ev.event_name}`;
    const subParts: string[] = [];
    if (ev.participants) subParts.push(`${ev.participants} osall.`);
    if (t.isTrack && heats > 1) subParts.push(`${heats} erää`);
    subParts.push(`${Math.round(dur)} min`);
    const subtitle = subParts.join(" · ");

    const tiny = width < 22;
    const veryNarrow = width < 30;
    const fontSize = width < 50 ? 10 : 11;

    const color = getEventColorClass(ev.event_name, ev.sub_category);
    const venue = venueMap.get(s.venue_id);

    const sevBorder =
      conflict?.severity === "critical"
        ? "border-[3px] border-red-600 ring-2 ring-red-300/70"
        : conflict?.severity === "high"
          ? "border-2 border-orange-500"
          : conflict?.severity === "warning"
            ? "border border-yellow-500"
            : `border ${color.border}`;

    const isHl = highlightSet.has(s.id);
    const dimmed = isHighlightActive && !isHl;
    const flash = isHl ? "ring-4 ring-primary animate-pulse" : "";

    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });

    const tooltipNode = (
      <div className="space-y-1.5">
        <div className="text-sm font-semibold">{primary}</div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">Aika</span>
          <span>
            {fmt(s.starts_at)} – {fmt(s.ends_at)} ({Math.round(dur)} min)
          </span>
          <span className="text-muted-foreground">Osallistujia</span>
          <span>{ev.participants || 0}</span>
          {t.isTrack && heats > 1 && (
            <>
              <span className="text-muted-foreground">Eriä</span>
              <span>{heats}</span>
            </>
          )}
          <span className="text-muted-foreground">Toimitsijoita</span>
          <span>{ev.officials_count}</span>
          <span className="text-muted-foreground">Paikka</span>
          <span>{venue?.name ?? "—"}</span>
          <span className="text-muted-foreground">Vaihe</span>
          <span>{phase}</span>
        </div>
        {conflict ? (
          <div
            className={`flex items-start gap-1.5 rounded border px-2 py-1 text-xs ${
              conflict.severity === "critical"
                ? "border-red-500 bg-red-50 text-red-900"
                : conflict.severity === "high"
                  ? "border-orange-500 bg-orange-50 text-orange-900"
                  : "border-yellow-500 bg-yellow-50 text-yellow-900"
            }`}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{conflict.reason}</span>
          </div>
        ) : (
          <div className="text-xs text-emerald-700">✓ OK</div>
        )}
      </div>
    );

    return (
      <Tooltip key={`${keyPrefix}-${s.id}`}>
        <TooltipTrigger asChild>
          <div
            data-bar-id={s.id}
            data-base-left={left}
            onPointerDown={(e) => onPointerDown(e, s)}
            className={`absolute cursor-grab touch-none select-none overflow-hidden rounded px-1 py-0.5 leading-tight shadow-sm transition-opacity active:cursor-grabbing ${color.bg} ${color.text} ${sevBorder} ${flash} ${
              dimmed ? "opacity-25" : ""
            }`}
            style={{
              left,
              top,
              width,
              height: ROW_HEIGHT - 6,
              fontSize: `${fontSize}px`,
            }}
          >
            {conflict && width >= 28 && (
              <div className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-white shadow">
                <AlertTriangle size={9} strokeWidth={3} />
              </div>
            )}
            {tiny ? (
              <div className="font-semibold" style={{ fontSize: "10px" }}>
                {ev.age_class}
              </div>
            ) : veryNarrow ? (
              <div
                className="font-semibold"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-word",
                }}
              >
                {primary}
              </div>
            ) : (
              <>
                <div
                  className="font-semibold"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    wordBreak: "break-word",
                    paddingRight: conflict ? 14 : 0,
                  }}
                >
                  {primary}
                </div>
                <div className="truncate text-foreground/70" style={{ fontSize: "10px" }}>
                  {subtitle}
                </div>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-xs">
          {tooltipNode}
        </TooltipContent>
      </Tooltip>
    );
  };

  // Zoom-aware tick density
  const showHalfHours = pxPerMin >= 6;
  const show10Min = pxPerMin >= 12;
  const show5MinNumbers = pxPerMin >= 20;

  const TimeAxis = () => (
    <div
        className="sticky top-0 z-30 flex border-b bg-background shadow-sm"
      style={{ width: totalWidth, height: 44 }}
    >
      <div
        className="sticky left-0 z-40 flex items-end border-r bg-background px-2 pb-1 text-xs font-semibold shadow-md"
        style={{ width: LEFT_COL }}
      >
        Aika
      </div>
      <div className="relative" style={{ width: totalWidth - LEFT_COL, height: 44 }}>
        {/* Hour headers — bold and large */}
        {hourTicks.map((m) => {
          const d = new Date(startMs + m * 60000);
          return (
            <div
              key={`h-${m}`}
              className="absolute top-0 border-l-2 border-border px-1 text-base font-bold"
              style={{ left: (m / 5) * PX_PER_5MIN, height: 24, lineHeight: "24px" }}
            >
              {d.getHours()}
            </div>
          );
        })}
        {/* Minor ticks */}
        {fiveTicks.map((m) => {
          const mm = m % 60;
          if (mm === 0) return null;
          const isHalf = mm === 30;
          const isTen = mm % 10 === 0;
          if (isHalf && !showHalfHours) return null;
          if (!isHalf && isTen && !show10Min) return null;
          if (!isHalf && !isTen && !show5MinNumbers) return null;
          const label = isHalf ? ":30" : String(mm);
          return (
            <div
              key={`f-${m}`}
              className={`absolute border-l text-muted-foreground ${
                isHalf ? "border-border/60 text-[10px] font-medium" : "border-border/20 text-[9px]"
              }`}
              style={{ left: (m / 5) * PX_PER_5MIN, top: 24, height: 20, lineHeight: "20px", paddingLeft: 2 }}
            >
              {label}
            </div>
          );
        })}
        {/* Plain 5-min gridline marks (no number) when zoom too small */}
        {!show5MinNumbers &&
          fiveTicks.map((m) => {
            const mm = m % 60;
            if (mm === 0 || mm === 30 || mm % 10 === 0) return null;
            return (
              <div
                key={`tick-${m}`}
                className="absolute border-l border-border/15"
                style={{ left: (m / 5) * PX_PER_5MIN, top: 36, height: 6 }}
              />
            );
          })}
      </div>
    </div>
  );


  const Section = ({
    title,
    section,
    rows,
    itemsForRow,
  }: {
    title: string;
    section: "venue" | "age";
    rows: Array<{ id: string; label: string }>;
    itemsForRow: (rowId: string) => ScheduleItemRow[];
  }) => (
    <div className="border-b" style={{ width: totalWidth }}>
      <div
        className="sticky left-0 z-20 border-b bg-background px-2 py-1 text-xs font-bold uppercase tracking-wide shadow-md"
        style={{ width: LEFT_COL }}
      >
        {title}
      </div>
      <div className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
        {/* Row labels (sticky left) */}
        <div className="sticky left-0 z-20 bg-background shadow-md" style={{ width: LEFT_COL }}>
          {rows.map((r) => (
            <div
              key={`lbl-${r.id}`}
              className="flex items-center border-b border-r bg-background px-2 text-xs"
              style={{ height: ROW_HEIGHT }}
            >
              <span className="truncate font-medium">{r.label}</span>
            </div>
          ))}
        </div>
        {/* Grid lines + bars */}
        <div
          data-section={section}
          className="absolute top-0"
          style={{ left: LEFT_COL, width: totalWidth - LEFT_COL, height: rows.length * ROW_HEIGHT }}
        >
          {/* row separators */}
          {rows.map((_, i) => (
            <div
              key={`rs-${i}`}
              className="absolute left-0 right-0 border-b border-border/40"
              style={{ top: (i + 1) * ROW_HEIGHT - 1, height: 0 }}
            />
          ))}
          {/* vertical hour lines */}
          {hourTicks.map((m) => (
            <div
              key={`v-${m}`}
              className="absolute top-0 border-l border-border/40"
              style={{ left: (m / 5) * PX_PER_5MIN, height: rows.length * ROW_HEIGHT }}
            />
          ))}
          {/* bars */}
          {rows.flatMap((r, i) => itemsForRow(r.id).map((s) => renderBar(s, i, title)))}
        </div>
      </div>
    </div>
  );

  const venueHas = (vid: string) => dayItems.some((s) => s.venue_id === vid);
  const ageHas = (age: string) =>
    dayItems.some((s) => evMap.get(s.plan_event_id)?.age_class === age);
  const venueRows = venues
    .filter((v) => showEmpty || venueHas(v.id))
    .map((v) => ({ id: v.id, label: v.name }));
  const ageRows = ageClasses
    .filter((a) => showEmpty || ageHas(a))
    .map((a) => ({ id: a, label: a }));

  useEffect(() => {
    if (!isHighlightActive || !scrollRef.current) return;
    const first = scrollRef.current.querySelector<HTMLElement>(
      `[data-bar-id="${[...highlightSet][0]}"]`,
    );
    if (first) {
      first.scrollIntoView({ behavior: "smooth", inline: "center", block: "center" });
    }
  }, [isHighlightActive, highlightSet]);

  return (
    <TooltipProvider delayDuration={200}>
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background"
          : "flex h-full flex-col"
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        {windows.length > 1 &&
          windows.map((w, i) => (
            <button
              key={w.date}
              onClick={() => setDayIdx(i)}
              className={`rounded-md px-3 py-1 text-xs ${
                i === dayIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {new Date(w.date).toLocaleDateString("fi-FI", {
                weekday: "short",
                day: "numeric",
                month: "numeric",
              })}
            </button>
          ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showEmpty}
              onChange={(e) => setShowEmpty(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Tyhjät paikat
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={hideLegend}
              onChange={(e) => setHideLegend(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Piilota selite
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={compactNames}
              onChange={(e) => setCompactNames(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Kompaktit nimet
          </label>
          {/* Rivien korkeus */}
          <div className="flex items-center gap-0.5 rounded-md border bg-background p-0.5" title="Rivien korkeus (+ / − / 0)">
            <Rows3 className="ml-1 mr-0.5 h-3.5 w-3.5 text-muted-foreground" />
            <button
              type="button"
              onClick={() => bumpRowHeight(-8)}
              title="Pienennä rivejä (−)"
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={resetRowHeight}
              title="Palauta oletus (0)"
              className="flex h-7 min-w-[3rem] items-center justify-center gap-1 rounded px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              {ROW_HEIGHT}px
            </button>
            <button
              type="button"
              onClick={() => bumpRowHeight(8)}
              title="Kasvata rivejä (+)"
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Zoom */}
          <div className="flex items-center gap-0.5 rounded-md border bg-background p-0.5">
            <button
              type="button"
              onClick={zoomOut}
              title="Zoom out (Ctrl+−)"
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={zoomReset}
              title="Reset zoom (Ctrl+0)"
              className="flex h-7 min-w-[3rem] items-center justify-center gap-1 rounded px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              {zoomPercent}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              title="Zoom in (Ctrl++)"
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? "Poistu koko näytöstä (Esc)" : "Koko näyttö"}
            className="grid h-7 w-7 place-items-center rounded-md border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {!hideLegend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-card/50 px-3 py-1.5 text-[10px] text-muted-foreground">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded border ${l.cls}`} />
              {l.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded border-2 border-red-500 bg-background" />
            Konflikti
          </span>
        </div>
      )}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto"
        onScroll={updateScrollState}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <TimeAxis />
        {unplacedEvents.length > 0 && (
          <div className="border-b border-red-400" style={{ width: totalWidth }}>
            <div
              className="sticky left-0 z-20 border-b bg-red-50 px-2 py-1 text-xs font-bold uppercase tracking-wide text-red-900 shadow-md"
              style={{ width: LEFT_COL }}
            >
              Sijoittamattomat lajit ({unplacedEvents.length}) — raahaa paikalleen
            </div>
            <div
              className="relative bg-red-50/40"
              style={{ height: unplacedLayout.rowCount * ROW_HEIGHT }}
            >
              <div
                className="sticky left-0 z-20 flex items-center border-r border-red-200 bg-red-50/80 px-2 text-[10px] font-medium uppercase tracking-wide text-red-900 shadow-md"
                style={{ width: LEFT_COL, height: unplacedLayout.rowCount * ROW_HEIGHT }}
              >
                {unplacedEvents.length} lajia
              </div>
              <div
                className="absolute top-0"
                style={{
                  left: LEFT_COL,
                  width: totalWidth - LEFT_COL,
                  height: unplacedLayout.rowCount * ROW_HEIGHT,
                }}
              >
                {unplacedLayout.items.map(({ ev, left, top, width, dur }) => {
                  const color = getEventColorClass(ev.event_name, ev.sub_category);
                  return (
                    <Tooltip key={`u-${ev.id}`}>
                      <TooltipTrigger asChild>
                        <div
                          data-bar-id={`unplaced-${ev.id}`}
                          data-base-left={left}
                          onPointerDown={(e) => onUnplacedPointerDown(e, ev)}
                          className={`absolute cursor-grab touch-none select-none overflow-hidden rounded border-2 border-dashed border-red-600 px-1 py-0.5 leading-tight shadow-sm active:cursor-grabbing ${color.bg} ${color.text}`}
                          style={{
                            left,
                            top,
                            width,
                            height: ROW_HEIGHT - 6,
                            fontSize: "11px",
                          }}
                        >
                          <div
                            className="font-semibold"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              wordBreak: "break-word",
                            }}
                          >
                            {compactNames ? ev.event_name : `${ev.age_class} ${ev.event_name}`}
                          </div>
                          <div
                            className="truncate text-foreground/70"
                            style={{ fontSize: "10px" }}
                          >
                            {ev.participants} osall. · {dur} min
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6}>
                        <div className="text-xs">
                          Sijoittamaton — raahaa suorituspaikkariville sijoittaaksesi.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <Section
          title="Suorituspaikkakohtainen aikataulu"
          section="venue"
          rows={venueRows}
          itemsForRow={(vid) => dayItems.filter((s) => s.venue_id === vid)}
        />

        <Section
          title="Ikäryhmäkohtainen aikataulu"
          section="age"
          rows={ageRows}
          itemsForRow={(age) =>
            dayItems.filter((s) => evMap.get(s.plan_event_id)?.age_class === age)
          }
        />
      </div>
      <div className="border-t bg-card px-3 py-1.5">
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute top-0 h-2 rounded-full bg-primary/70"
            style={{ left: `${miniThumbLeft}%`, width: `${miniThumbWidth}%` }}
          />
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
