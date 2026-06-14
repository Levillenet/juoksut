// Visuaalinen Excel-vienti (YAG22-mallin mukainen):
// - Yksi välilehti / päivä
// - Suorituspaikkakohtainen ruudukko (rivit = paikat) + Ikäryhmäkohtainen ruudukko (rivit = ikäluokat)
// - Aikasarakkeet 5 min raster, palkki = soluyhdistys + taustaväri
import XLSX from "xlsx-js-style";
import {
  resolveDayWindows,
  type PlanRow,
  type VenueRow,
  type PlanEventRow,
  type ScheduleItemRow,
} from "@/lib/planner-types";
import { resolveTimings } from "@/lib/planner-timings";

interface Args {
  plan: PlanRow;
  venues: VenueRow[];
  events: PlanEventRow[];
  schedule: ScheduleItemRow[];
  conflictIds: Set<string>;
}

const MIN_PER_COL = 5;

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
  // Pastelli per ikäluokka (deterministinen HSL → hex)
  let h = 0;
  for (let i = 0; i < ageClass.length; i++) h = (h * 31 + ageClass.charCodeAt(i)) % 360;
  // Pastel: H, S=60%, L=80% → hex
  const s = 0.6,
    l = 0.8;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return toHex(r) + toHex(g) + toHex(b);
}

function setCell(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string | number | null,
  style?: XLSX.CellStyle,
) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell: XLSX.CellObject = {
    v: value as string | number,
    t: typeof value === "number" ? "n" : "s",
  };
  if (style) cell.s = style;
  ws[addr] = cell;
}

function ensureRange(ws: XLSX.WorkSheet, lastRow: number, lastCol: number) {
  const cur = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  cur.e.r = Math.max(cur.e.r, lastRow);
  cur.e.c = Math.max(cur.e.c, lastCol);
  ws["!ref"] = XLSX.utils.encode_range(cur);
}

interface BarSpec {
  rowIdx: number; // 0-based row within the section
  startCol: number;
  endCol: number;
  text: string;
  bgHex: string;
  conflict: boolean;
}

function buildBarText(
  ev: PlanEventRow,
  plan: PlanRow,
): string {
  const t = resolveTimings(ev, plan);
  if (t.isTrack) {
    const lanes = Math.max(1, ev.station_count);
    const heats = Math.max(1, Math.ceil(ev.participants / lanes));
    return `${ev.age_class} ${ev.event_name} (${heats}) ${t.minutesPerHeatMin} min/erä`;
  }
  return `${ev.age_class} ${ev.event_name}${ev.participants ? ` (${ev.participants})` : ""}`;
}

function buildSection(
  ws: XLSX.WorkSheet,
  title: string,
  startRow: number,
  totalCols: number,
  startMs: number,
  rowLabels: string[],
  bars: BarSpec[],
): number {
  // Title row
  setCell(ws, startRow, 0, title, {
    font: { bold: true, sz: 11 },
    alignment: { vertical: "center" },
  });
  // Hour header row (startRow) and minute row (startRow + 1)
  const hourHeaderRow = startRow;
  const minuteRow = startRow + 1;
  for (let c = 0; c < totalCols; c++) {
    const totalMinutes = c * MIN_PER_COL;
    const t = new Date(startMs + totalMinutes * 60000);
    const mm = t.getMinutes();
    // Tasatunti label only on minute=0 cells (in hour row)
    if (mm === 0) {
      setCell(ws, hourHeaderRow, c + 1, t.getHours(), {
        font: { bold: true, sz: 10 },
        alignment: { horizontal: "center" },
        border: { left: { style: "thin", color: { rgb: "000000" } } },
      });
    }
    setCell(ws, minuteRow, c + 1, mm, {
      font: { sz: 8, color: { rgb: "888888" } },
      alignment: { horizontal: "center" },
      border: mm === 0
        ? { left: { style: "thin", color: { rgb: "000000" } }, bottom: { style: "thin", color: { rgb: "999999" } } }
        : { bottom: { style: "thin", color: { rgb: "999999" } } },
    });
  }
  // Row labels
  const firstDataRow = startRow + 2;
  for (let i = 0; i < rowLabels.length; i++) {
    setCell(ws, firstDataRow + i, 0, rowLabels[i], {
      font: { bold: true, sz: 10 },
      alignment: { vertical: "center", wrapText: true },
      border: { right: { style: "thin", color: { rgb: "000000" } } },
    });
    // Empty bordered cells across the row for visual grid
    for (let c = 0; c < totalCols; c++) {
      const mm = ((c * MIN_PER_COL) % 60);
      const addr = XLSX.utils.encode_cell({ r: firstDataRow + i, c: c + 1 });
      if (!ws[addr]) {
        ws[addr] = {
          v: "",
          t: "s",
          s: {
            border: mm === 0
              ? { left: { style: "thin", color: { rgb: "BBBBBB" } } }
              : undefined,
          },
        };
      }
    }
  }
  // Bars
  const merges = (ws["!merges"] = ws["!merges"] ?? []);
  for (const bar of bars) {
    const r = firstDataRow + bar.rowIdx;
    const c1 = bar.startCol + 1;
    const c2 = bar.endCol + 1;
    const border: XLSX.CellStyle["border"] = bar.conflict
      ? {
          top: { style: "medium", color: { rgb: "CC0000" } },
          bottom: { style: "medium", color: { rgb: "CC0000" } },
          left: { style: "medium", color: { rgb: "CC0000" } },
          right: { style: "medium", color: { rgb: "CC0000" } },
        }
      : {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        };
    setCell(ws, r, c1, bar.text, {
      fill: { fgColor: { rgb: bar.bgHex } },
      font: { sz: 9, bold: false },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border,
    });
    if (c2 > c1) merges.push({ s: { r, c: c1 }, e: { r, c: c2 } });
  }
  const lastRow = firstDataRow + rowLabels.length - 1;
  ensureRange(ws, lastRow, totalCols);
  return lastRow;
}

export function downloadPlannerScheduleVisualXlsx({
  plan,
  venues,
  events,
  schedule,
  conflictIds,
}: Args) {
  const wb = XLSX.utils.book_new();
  const windows = resolveDayWindows(plan);
  if (windows.length === 0) return;
  const evMap = new Map(events.map((e) => [e.id, e]));

  for (const win of windows) {
    // Pyöristä tasatuntiin
    const startDate = new Date(win.startMs);
    startDate.setMinutes(0, 0, 0);
    const endDate = new Date(win.endMs);
    if (endDate.getMinutes() !== 0 || endDate.getSeconds() !== 0) {
      endDate.setHours(endDate.getHours() + 1, 0, 0, 0);
    }
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const totalMin = Math.max(MIN_PER_COL, (endMs - startMs) / 60000);
    const totalCols = Math.ceil(totalMin / MIN_PER_COL);

    // Päivän aikataulu-itemit
    const dayItems = schedule.filter((s) => {
      const t = new Date(s.starts_at).getTime();
      return t >= startMs - 60 * 60000 && t < endMs + 12 * 3600000;
    });

    const ws: XLSX.WorkSheet = { "!ref": "A1" };
    // Otsikko
    setCell(ws, 0, 0, plan.name, { font: { bold: true, sz: 14 } });
    const weekday = startDate.toLocaleDateString("fi-FI", { weekday: "long" });
    const dateStr = startDate.toLocaleDateString("fi-FI", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
    setCell(ws, 1, 0, `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${dateStr}`, {
      font: { bold: true, sz: 11 },
    });

    // Suorituspaikat-osio
    const venueLabels = venues.map((v) => v.name);
    const venueRowById = new Map(venues.map((v, i) => [v.id, i]));
    const venueBars: BarSpec[] = dayItems
      .map<BarSpec | null>((s) => {
        const ev = evMap.get(s.plan_event_id);
        if (!ev) return null;
        const rowIdx = venueRowById.get(s.venue_id);
        if (rowIdx === undefined) return null;
        const st = new Date(s.starts_at).getTime();
        const en = new Date(s.ends_at).getTime();
        const startCol = Math.floor((st - startMs) / 60000 / MIN_PER_COL);
        const endCol = Math.max(startCol, Math.ceil((en - startMs) / 60000 / MIN_PER_COL) - 1);
        if (endCol < 0 || startCol >= totalCols) return null;
        return {
          rowIdx,
          startCol: Math.max(0, startCol),
          endCol: Math.min(totalCols - 1, endCol),
          text: buildBarText(ev, plan),
          bgHex: colorFor(ev.age_class),
          conflict: conflictIds.has(s.id),
        };
      })
      .filter((b): b is BarSpec => b !== null);

    let lastRow = buildSection(
      ws,
      "Suorituspaikkakohtainen aikataulu",
      3,
      totalCols,
      startMs,
      venueLabels,
      venueBars,
    );

    // Ikäryhmäosio (vain tämän päivän eventeissä esiintyvät)
    const ageClasses = Array.from(
      new Set(
        dayItems
          .map((s) => evMap.get(s.plan_event_id)?.age_class)
          .filter((a): a is string => !!a),
      ),
    ).sort(ageClassSort);
    const ageRowById = new Map(ageClasses.map((a, i) => [a, i]));
    const ageBars: BarSpec[] = dayItems
      .map<BarSpec | null>((s) => {
        const ev = evMap.get(s.plan_event_id);
        if (!ev) return null;
        const rowIdx = ageRowById.get(ev.age_class);
        if (rowIdx === undefined) return null;
        const st = new Date(s.starts_at).getTime();
        const en = new Date(s.ends_at).getTime();
        const startCol = Math.floor((st - startMs) / 60000 / MIN_PER_COL);
        const endCol = Math.max(startCol, Math.ceil((en - startMs) / 60000 / MIN_PER_COL) - 1);
        if (endCol < 0 || startCol >= totalCols) return null;
        return {
          rowIdx,
          startCol: Math.max(0, startCol),
          endCol: Math.min(totalCols - 1, endCol),
          text: buildBarText(ev, plan),
          bgHex: colorFor(ev.age_class),
          conflict: conflictIds.has(s.id),
        };
      })
      .filter((b): b is BarSpec => b !== null);

    const ageSectionStart = lastRow + 3;
    lastRow = buildSection(
      ws,
      "Ikäryhmäkohtainen aikataulu",
      ageSectionStart,
      totalCols,
      startMs,
      ageClasses,
      ageBars,
    );

    // Sarakeleveydet ja rivikorkeudet
    ws["!cols"] = [
      { wch: 24 },
      ...Array.from({ length: totalCols }, () => ({ wch: 3 })),
    ];
    ws["!rows"] = [];
    for (let r = 0; r <= lastRow; r++) {
      ws["!rows"][r] = { hpt: r === 0 || r === 1 ? 18 : 22 };
    }
    // Freeze: vasen sarake + ylätunnisteet
    // Note: SheetJS community edition ei tue freeze panesia; sheet näytetään ilman jäädytystä.

    const sheetName = startDate
      .toLocaleDateString("fi-FI", { weekday: "long" })
      .replace(/[^a-zA-ZäöÄÖåÅ]/g, "")
      .slice(0, 28) || `Päivä ${win.date}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const slug = plan.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-äöÄÖåÅ]/g, "");
  XLSX.writeFile(wb, `aikataulu-${slug}.xlsx`);
}
