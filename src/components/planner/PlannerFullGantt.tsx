import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveDayWindows,
  type PlanRow,
  type VenueRow,
  type PlanEventRow,
  type ScheduleItemRow,
} from "@/lib/planner-types";
import { resolveTimings } from "@/lib/planner-timings";

interface Props {
  plan: PlanRow;
  venues: VenueRow[];
  events: PlanEventRow[];
  schedule: ScheduleItemRow[];
  conflicts: Array<{ id: string; reason: string }>;
  onChange: () => void;
}

const PX_PER_5MIN = 22; // 264 px per tunti
const ROW_HEIGHT = 64;
const LEFT_COL = 220;

function ageClassSort(a: string, b: string): number {
  const order = (s: string) => {
    const ch = s.charAt(0);
    const ord = { T: 0, P: 1, N: 2, M: 3 }[ch] ?? 9;
    const num = parseInt(s.slice(1)) || 99;
    return ord * 100 + num;
  };
  return order(a) - order(b);
}

function colorFor(ageClass: string): string {
  let h = 0;
  for (let i = 0; i < ageClass.length; i++) h = (h * 31 + ageClass.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 70% / 0.55)`;
}

export function PlannerFullGantt({
  plan,
  venues,
  events,
  schedule,
  conflicts,
  onChange,
}: Props) {
  const windows = useMemo(() => resolveDayWindows(plan), [plan]);
  const [dayIdx, setDayIdx] = useState(0);
  const [showEmpty, setShowEmpty] = useState(false);
  const evMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const conflictMap = useMemo(
    () => new Map(conflicts.map((c) => [c.id, c.reason])),
    [conflicts],
  );

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
  const totalWidth = LEFT_COL + totalMin / 5 * PX_PER_5MIN;

  const dragRef = useRef<{
    id: string;
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  const updateTime = useMutation({
    mutationFn: async (p: { id: string; starts_at: string; ends_at: string }) => {
      const { error } = await supabase
        .from("plan_schedule_items")
        .update({ starts_at: p.starts_at, ends_at: p.ends_at, auto_generated: false })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });

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
    dragRef.current = { id: item.id, startX: e.clientX, origStart: orig, origEnd };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const minutes = Math.round(dx / PX_PER_5MIN) * 5;
    const els = document.querySelectorAll<HTMLElement>(`[data-bar-id="${d.id}"]`);
    els.forEach((el) => {
      const baseLeft = parseFloat(el.dataset.baseLeft || "0");
      el.style.left = `${baseLeft + minutes * (PX_PER_5MIN / 5)}px`;
    });
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    // Read final position from one of the bars
    const el = document.querySelector<HTMLElement>(`[data-bar-id="${d.id}"]`);
    if (!el) return;
    const baseLeft = parseFloat(el.dataset.baseLeft || "0");
    const finalLeft = parseFloat(el.style.left || `${baseLeft}`);
    const minutes = Math.round((finalLeft - baseLeft) / PX_PER_5MIN) * 5;
    if (minutes === 0) return;
    const newStart = new Date(d.origStart + minutes * 60000);
    const newEnd = new Date(d.origEnd + minutes * 60000);
    updateTime.mutate({
      id: d.id,
      starts_at: newStart.toISOString(),
      ends_at: newEnd.toISOString(),
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
    const left = LEFT_COL + (startOff / 5) * PX_PER_5MIN;
    const width = Math.max(18, (dur / 5) * PX_PER_5MIN - 2);
    const top = rowIdx * ROW_HEIGHT + 3;
    const conflictReason = conflictMap.get(s.id);
    const heats = t.isTrack ? Math.max(1, Math.ceil((ev.participants || 0) / 8)) : 1;
    const phase = s.phase;
    const primary = `${ev.age_class} ${ev.event_name}`;
    const subParts: string[] = [];
    if (ev.participants) subParts.push(`${ev.participants} osall.`);
    if (t.isTrack && heats > 1) subParts.push(`${heats} erää`);
    subParts.push(`${Math.round(dur)} min`);
    const subtitle = subParts.join(" · ");

    const tiny = width < 22;
    const veryNarrow = width < 30;
    const fontSize = width < 50 ? 10 : 11;

    return (
      <div
        key={`${keyPrefix}-${s.id}`}
        data-bar-id={s.id}
        data-base-left={left}
        onPointerDown={(e) => onPointerDown(e, s)}
        title={conflictReason ?? `${primary} (${phase}) · ${subtitle}`}
        className={`absolute cursor-grab touch-none select-none overflow-hidden rounded border px-1 py-0.5 leading-tight shadow-sm active:cursor-grabbing ${
          conflictReason ? "border-destructive ring-1 ring-destructive" : "border-border/60"
        }`}
        style={{
          left,
          top,
          width,
          height: ROW_HEIGHT - 6,
          background: colorFor(ev.age_class),
          fontSize: `${fontSize}px`,
        }}
      >
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
    );
  };

  const TimeAxis = () => (
    <div
      className="sticky top-0 z-30 flex border-b bg-card"
      style={{ width: totalWidth, height: 42 }}
    >
      <div
        className="sticky left-0 z-40 flex items-end border-r bg-card px-2 pb-1 text-xs font-semibold"
        style={{ width: LEFT_COL }}
      >
        Aika
      </div>
      <div className="relative" style={{ width: totalWidth - LEFT_COL, height: 42 }}>
        {/* Hour headers */}
        {hourTicks.map((m) => {
          const d = new Date(startMs + m * 60000);
          return (
            <div
              key={`h-${m}`}
              className="absolute top-0 border-l border-border/60 px-1 text-[11px] font-semibold"
              style={{ left: (m / 5) * PX_PER_5MIN, height: 22, lineHeight: "22px" }}
            >
              {d.getHours()}
            </div>
          );
        })}
        {/* 5-min labels */}
        {fiveTicks.map((m) => {
          const mm = (m % 60);
          if (mm === 0) return null;
          return (
            <div
              key={`f-${m}`}
              className="absolute border-l border-border/20 px-0.5 text-[9px] text-muted-foreground"
              style={{ left: (m / 5) * PX_PER_5MIN, top: 22, height: 20, lineHeight: "20px" }}
            >
              {mm}
            </div>
          );
        })}
      </div>
    </div>
  );

  const Section = ({
    title,
    rows,
    itemsForRow,
  }: {
    title: string;
    rows: Array<{ id: string; label: string }>;
    itemsForRow: (rowId: string) => ScheduleItemRow[];
  }) => (
    <div className="border-b" style={{ width: totalWidth }}>
      <div
        className="sticky left-0 z-20 border-b bg-muted/40 px-2 py-1 text-xs font-bold uppercase tracking-wide"
        style={{ width: LEFT_COL }}
      >
        {title}
      </div>
      <div className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
        {/* Row labels (sticky left) */}
        {rows.map((r, i) => (
          <div
            key={`lbl-${r.id}`}
            className="sticky left-0 z-10 flex items-center border-b border-r bg-card px-2 text-xs"
            style={{
              width: LEFT_COL,
              height: ROW_HEIGHT,
              top: 0,
              position: "absolute",
              transform: `translateY(${i * ROW_HEIGHT}px)`,
            }}
          >
            <span className="truncate font-medium">{r.label}</span>
          </div>
        ))}
        {/* Grid lines + bars */}
        <div
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

  return (
    <div className="flex h-full flex-col">
      {windows.length > 1 && (
        <div className="flex gap-1 border-b bg-card px-3 py-2">
          {windows.map((w, i) => (
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
        </div>
      )}
      <div
        className="relative flex-1 overflow-auto"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <TimeAxis />
        <Section
          title="Suorituspaikkakohtainen aikataulu"
          rows={venueRows}
          itemsForRow={(vid) => dayItems.filter((s) => s.venue_id === vid)}
        />
        <Section
          title="Ikäryhmäkohtainen aikataulu"
          rows={ageRows}
          itemsForRow={(age) =>
            dayItems.filter((s) => evMap.get(s.plan_event_id)?.age_class === age)
          }
        />
      </div>
    </div>
  );
}
