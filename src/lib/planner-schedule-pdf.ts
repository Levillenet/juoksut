import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  resolveDayWindows,
  type PlanRow,
  type VenueRow,
  type PlanEventRow,
  type ScheduleItemRow,
} from "./planner-types";
import { resolveTimings, estimateHeatsCount } from "./planner-timings";

const WEEKDAYS = ["Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai"];

function fmtTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateHeader(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  const wd = WEEKDAYS[d.getDay()];
  return `${wd} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export interface PlannerSchedulePdfOptions {
  plan: PlanRow;
  venues: VenueRow[];
  events: PlanEventRow[];
  schedule: ScheduleItemRow[];
  conflictIds?: Set<string>;
}

export function downloadPlannerSchedulePdf(opts: PlannerSchedulePdfOptions) {
  const { plan, venues, events, schedule, conflictIds } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${plan.name} — Aikataulu`, margin, margin + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Tulostettu ${new Date().toLocaleString("fi-FI")}`,
    margin,
    margin + 9,
  );

  let cursorY = margin + 13;

  const evMap = new Map(events.map((e) => [e.id, e]));
  const vMap = new Map(venues.map((v) => [v.id, v]));
  const days = resolveDayWindows(plan);

  // Group schedule rows by day (date string).
  const byDate = new Map<string, ScheduleItemRow[]>();
  for (const d of days) byDate.set(d.date, []);
  for (const s of schedule) {
    const dt = new Date(s.starts_at);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(s);
  }

  const sortedKeys = Array.from(byDate.keys()).sort();

  for (const date of sortedKeys) {
    const rows = (byDate.get(date) ?? [])
      .slice()
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    if (rows.length === 0) continue;

    if (cursorY > pageH - 30) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(fmtDateHeader(date), margin, cursorY);
    cursorY += 2;

    const body = rows.map((s) => {
      const ev = evMap.get(s.plan_event_id);
      const v = vMap.get(s.venue_id);
      const t = ev ? resolveTimings(ev, plan) : null;
      const start = new Date(s.starts_at);
      const end = new Date(s.ends_at);
      const time = `${fmtTime(start)}–${fmtTime(end)}`;
      let heats = "";
      if (t?.isTrack && ev) {
        const n = estimateHeatsCount(ev.participants);
        heats = `${n} erä${n === 1 ? "" : "ä"} × ${t.minutesPerHeatMin} min`;
      }
      const flag = conflictIds?.has(s.id) ? "!" : "";
      return [
        time,
        v?.name ?? "",
        ev?.age_class ?? "",
        ev?.event_name ?? "",
        heats,
        ev ? String(ev.participants) : "",
        flag,
      ];
    });

    autoTable(doc, {
      startY: cursorY,
      head: [["Aika", "Suorituspaikka", "Ikäluokka", "Laji", "Erät", "Osanottajat", "!"]],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 1.5, valign: "top" },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 50 },
        2: { cellWidth: 22 },
        3: { cellWidth: "auto" },
        4: { cellWidth: 36 },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 8, halign: "center" },
      },
      didDrawPage: () => {
        const ph = doc.internal.pageSize.getHeight();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text(`${plan.name} · ${new Date().toLocaleString("fi-FI")}`, margin, ph - 4);
        doc.text(
          `Sivu ${doc.getCurrentPageInfo().pageNumber}`,
          pageW - margin,
          ph - 4,
          { align: "right" },
        );
        doc.setTextColor(0);
      },
    });

    cursorY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  const today = new Date().toISOString().slice(0, 10);
  doc.save(`aikataulu-${slug(plan.name) || "suunnitelma"}-${today}.pdf`);
}
