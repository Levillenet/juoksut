import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { YagCallingMatch } from "./yag-calling-match";

const DATE_LABEL: Record<string, string> = {
  "2026-06-12": "Perjantai 12.6.2026",
  "2026-06-13": "Lauantai 13.6.2026",
  "2026-06-14": "Sunnuntai 14.6.2026",
};

export interface GroupedDay {
  date: string;
  rows: YagCallingMatch[];
}

export interface YagPdfOptions {
  grouped: GroupedDay[];
  compName: string;
  orientation: "portrait" | "landscape";
  mode: "watched" | "club";
  orgName?: string;
  watchedCount?: number;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function downloadYagCallingPdf(opts: YagPdfOptions) {
  const { grouped, compName, orientation, mode, orgName, watchedCount } = opts;
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = orientation === "landscape" ? 8 : 10;

  // Otsikko
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${compName} — Calling-aikataulu`, margin, margin + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const sub =
    mode === "watched"
      ? `Seurannassa olevien urheilijoiden lähdöt (${watchedCount ?? 0})`
      : `Seuran ${orgName ?? ""} urheilijoiden lähdöt`;
  doc.text(sub, margin, margin + 9);

  let cursorY = margin + 13;

  for (const g of grouped) {
    if (cursorY > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(DATE_LABEL[g.date] ?? g.date, margin, cursorY);
    cursorY += 2;

    const body = g.rows.map((m) => {
      const isUnpublished = m.allHeats != null;
      const heatFromEntries = (() => {
        const set = new Set(
          m.entries.map((e) => e.heatIndex).filter((h) => h > 0),
        );
        return set.size === 1 ? [...set][0] : null;
      })();
      const erä = heatFromEntries ?? m.heatNumber;

      const calling = isUnpublished
        ? m.allHeats!
            .map(
              (h) =>
                `${h.calling}${h.heat != null ? ` (erä ${h.heat})` : ""}`,
            )
            .join("\n")
        : m.row.calling;

      const kentalle = isUnpublished
        ? m.allHeats!.map((h) => h.kentalle).join("\n")
        : m.row.kentalle;

      const alkaa = isUnpublished
        ? m.allHeats!.map((h) => h.alkaa).join("\n")
        : m.row.alkaa;

      const lajiTxt = `${m.row.sarja} ${m.row.laji.replace(/\s*\(erä\s*\d+\)/, "")}`;
      const athletes = m.entries
        .map((e) => {
          const parts = [`${e.alloc.Surname} ${e.alloc.Firstname}`];
          if (e.alloc.Organization?.NameShort)
            parts.push(e.alloc.Organization.NameShort);
          if (e.alloc.Number) parts.push(`#${e.alloc.Number}`);
          return parts.join(" ");
        })
        .join("\n");
      const sarjaCell = `${lajiTxt}\n${athletes}`;

      const eräCell = isUnpublished
        ? "ei vielä julkaistu"
        : erä != null
          ? String(erä)
          : "–";

      const paikka = isUnpublished
        ? (() => {
            const uniq = Array.from(new Set(m.allHeats!.map((h) => h.paikka)));
            return uniq.length === 1 ? uniq[0] : m.allHeats!.map((h) => h.paikka).join("\n");
          })()
        : m.row.paikka;

      return [calling, kentalle, alkaa, sarjaCell, eräCell, paikka];
    });

    autoTable(doc, {
      startY: cursorY,
      head: [["Calling", "Kentälle", "Alkaa", "Sarja / Laji", "Erä", "Paikka"]],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 1.5, valign: "top" },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: orientation === "landscape" ? 28 : 22 },
        1: { cellWidth: orientation === "landscape" ? 18 : 14 },
        2: { cellWidth: orientation === "landscape" ? 18 : 14 },
        3: { cellWidth: "auto" },
        4: { cellWidth: orientation === "landscape" ? 22 : 18 },
        5: { cellWidth: orientation === "landscape" ? 30 : 24 },
      },
      didDrawPage: () => {
        // sivunumerot / footer
        const ph = doc.internal.pageSize.getHeight();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text(
          `Lähde: live.tuloslista.com + virallinen Calling-aikataulu · ${new Date().toLocaleString("fi-FI")}`,
          margin,
          ph - 4,
        );
        const pageStr = `Sivu ${doc.getCurrentPageInfo().pageNumber}`;
        doc.text(pageStr, pageW - margin, ph - 4, { align: "right" });
        doc.setTextColor(0);
      },
    });

    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  const today = new Date().toISOString().slice(0, 10);
  const suffix =
    mode === "watched" ? "seurannassa" : slugify(orgName ?? "seura") || "seura";
  doc.save(`yag-calling-${suffix}-${today}.pdf`);
}
