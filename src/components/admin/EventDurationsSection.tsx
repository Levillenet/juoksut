import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, Loader2, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCompetitionId } from "@/lib/competition-store";
import {
  buildEventDurationRows,
  type EventDurationRow,
} from "@/lib/event-durations";

export function EventDurationsSection() {
  const [currentId] = useCompetitionId();
  const [input, setInput] = useState(String(currentId));
  const [rows, setRows] = useState<EventDurationRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const cid = parseInt(input.trim(), 10);
    if (!Number.isFinite(cid) || cid <= 0) {
      setError("Anna kelvollinen kilpailu-ID.");
      return;
    }
    setError(null);
    setLoading(true);
    setRows(null);
    setProgress({ done: 0, total: 0 });
    try {
      const data = await buildEventDurationRows(cid, (done, total) =>
        setProgress({ done, total }),
      );
      setRows(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const exportExcel = () => {
    if (!rows) return;
    const cid = parseInt(input.trim(), 10);
    const wb = XLSX.utils.book_new();

    const all = rows.map((r) => ({
      "Laji-ID": r.eventId,
      "Laji": r.eventName,
      "Sarja / ryhmä": r.groupName,
      "Kategoria": r.categoryLabel,
      "Alalaji": r.subCategoryLabel,
      "Alkamisaika": r.startHelsinki ?? "",
      "Erien määrä": r.heatCount ?? "",
      "Osanottajat (ilm.)": r.scheduledParticipants,
      "Osanottajat (tuloksissa)": r.resultParticipants,
      "Viimeinen tulos": r.lastResultHelsinki ?? "",
      "Kesto (min)": r.durationMinutes ?? "",
      "Status": r.status,
    }));
    const ws1 = XLSX.utils.json_to_sheet(all);
    XLSX.utils.book_append_sheet(wb, ws1, "Kaikki lajit");

    const running = rows
      .filter((r) => r.category === "Track")
      .map((r) => ({
        "Laji-ID": r.eventId,
        "Laji": r.eventName,
        "Sarja / ryhmä": r.groupName,
        "Erien määrä": r.heatCount ?? "",
        "Osanottajat yhteensä": r.scheduledParticipants,
        "Alkamisaika": r.startHelsinki ?? "",
        "Viimeinen tulos": r.lastResultHelsinki ?? "",
        "Kesto (min)": r.durationMinutes ?? "",
      }));
    const ws2 = XLSX.utils.json_to_sheet(running);
    XLSX.utils.book_append_sheet(wb, ws2, "Juoksut yhteenveto");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `lajien-kestot-${cid}-${date}.xlsx`);
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Timer className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Lajien kestot ja osanottajat</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Hakee tuloslistan aikataulun + omat tallennetut tulokset valitsemaltasi kisalta.
        Kesto = viimeisen tuloksen tallennusaika − aikataulun alkamisaika
        (tarkkuus ~minuutteja). Käytä tulevien kisojen aikataulutuksen tukena.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Kilpailu-ID</label>
          <input
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <Button onClick={load} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {progress && progress.total > 0
                ? `${progress.done}/${progress.total}`
                : "Ladataan…"}
            </>
          ) : (
            "Lataa data"
          )}
        </Button>
        <Button onClick={exportExcel} disabled={!rows || rows.length === 0} variant="secondary">
          <Download className="mr-2 h-4 w-4" />
          Vie Excel
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">Virhe: {error}</p>}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-2">Aika</th>
                <th className="py-1 pr-2">Laji</th>
                <th className="py-1 pr-2">Sarja</th>
                <th className="py-1 pr-2 text-right">Erät</th>
                <th className="py-1 pr-2 text-right">Osall.</th>
                <th className="py-1 pr-2 text-right">Tuloksissa</th>
                <th className="py-1 pr-2">Viim. tulos</th>
                <th className="py-1 pr-2 text-right">Kesto (min)</th>
                <th className="py-1 pr-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.eventId} className="border-t border-border/50">
                  <td className="py-1 pr-2 tabular-nums">{r.startHelsinki}</td>
                  <td className="py-1 pr-2">{r.eventName}</td>
                  <td className="py-1 pr-2">{r.groupName}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{r.heatCount ?? "–"}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{r.scheduledParticipants}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{r.resultParticipants}</td>
                  <td className="py-1 pr-2 tabular-nums">{r.lastResultHelsinki ?? "–"}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{r.durationMinutes ?? "–"}</td>
                  <td className="py-1 pr-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Ei lajeja tällä kilpailu-ID:llä.</p>
      )}
    </section>
  );
}
