import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Users } from "lucide-react";

import { competitionIndexQueryOptions } from "@/lib/tuloslista-queries";
import { useWatchedAthletes } from "@/lib/watch-store";
import { matchYagCalling, formatHeatList } from "@/lib/yag-calling-match";
import { downloadYagCallingPdf } from "@/lib/yag-calling-pdf";
import { YAG_COMPETITION_ID } from "@/data/yag-calling";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/RequireRole";
import { PrintTabs } from "@/components/PrintTabs";
import { usePrintOrientation, type Orientation } from "@/hooks/usePrintOrientation";

const DATE_LABEL: Record<string, string> = {
  "2026-06-12": "Perjantai 12.6.2026",
  "2026-06-13": "Lauantai 13.6.2026",
  "2026-06-14": "Sunnuntai 14.6.2026",
};

type Mode = "watched" | "club";

export const Route = createFileRoute("/print/yag-calling")({
  validateSearch: (search: Record<string, unknown>) => ({
    auto: search.auto === "1" || search.auto === 1 || search.auto === true,
    mode: (search.mode === "club" ? "club" : "watched") as Mode,
    org:
      typeof search.org === "string"
        ? parseInt(search.org, 10) || 0
        : Number(search.org) || 0,
  }),
  head: () => ({
    meta: [
      { title: "YAG Calling-aikataulu" },
      {
        name: "description",
        content:
          "Calling room -aikataulu YAG Espoo 2026 -kisaan seurannassa olevien tai valitun seuran urheilijoiden osalta.",
      },
    ],
  }),
  component: () => (
    <RequireRole allow={["user"]}>
      <YagCallingPage />
    </RequireRole>
  ),
});

function YagCallingPage() {
  const { auto, mode, org } = Route.useSearch();
  const navigate = useNavigate({ from: "/print/yag-calling" });
  const { list: watched } = useWatchedAthletes();
  const { orientation, setOrientation } = usePrintOrientation();
  const indexQuery = useQuery(competitionIndexQueryOptions(YAG_COMPETITION_ID));

  const entries = indexQuery.data?.entries ?? [];
  const compName = indexQuery.data?.name ?? "YAG Espoo 2026";

  const watchedKeys = useMemo(
    () =>
      new Set(
        watched.map(
          (w) => `${w.surname}|${w.firstname}|${w.organizationId ?? ""}`,
        ),
      ),
    [watched],
  );

  // Lista seuroista YAG-kisan urheilijoista
  const clubs = useMemo(() => {
    const map = new Map<number, { id: number; name: string; athletes: Set<string> }>();
    for (const e of entries) {
      const id = e.alloc.Organization?.Id;
      if (id == null) continue;
      const nm = e.alloc.Organization?.Name ?? "";
      if (!map.has(id)) map.set(id, { id, name: nm, athletes: new Set() });
      map.get(id)!.athletes.add(`${e.alloc.Surname}|${e.alloc.Firstname}`);
    }
    return Array.from(map.values())
      .map((c) => ({ id: c.id, name: c.name, athletes: c.athletes.size }))
      .sort((a, b) => a.name.localeCompare(b.name, "fi"));
  }, [entries]);

  const orgName = useMemo(() => {
    const c = clubs.find((x) => x.id === org);
    return c?.name ?? "";
  }, [clubs, org]);

  const matches = useMemo(() => {
    let filtered: typeof entries = [];
    if (mode === "watched") {
      if (watchedKeys.size === 0) return [];
      filtered = entries.filter((e) => {
        const k = `${e.alloc.Surname}|${e.alloc.Firstname}|${e.alloc.Organization?.Id ?? ""}`;
        return watchedKeys.has(k);
      });
    } else {
      if (!org) return [];
      filtered = entries.filter((e) => (e.alloc.Organization?.Id ?? -1) === org);
    }
    return matchYagCalling(filtered);
  }, [entries, watchedKeys, mode, org]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof matches>();
    for (const m of matches) {
      const list = map.get(m.row.date) ?? [];
      list.push(m);
      map.set(m.row.date, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({
        date,
        rows: [...rows].sort((a, b) => a.row.calling.localeCompare(b.row.calling)),
      }));
  }, [matches]);

  const handleDownload = useCallback(() => {
    if (grouped.length === 0) return;
    downloadYagCallingPdf({
      grouped,
      compName,
      orientation,
      mode,
      orgName,
      watchedCount: watched.length,
    });
  }, [grouped, compName, orientation, mode, orgName, watched.length]);

  useEffect(() => {
    if (auto && !indexQuery.isLoading && grouped.length > 0) {
      const t = setTimeout(() => handleDownload(), 400);
      return () => clearTimeout(t);
    }
  }, [auto, indexQuery.isLoading, grouped.length, handleDownload]);

  const setMode = (m: Mode) =>
    navigate({ search: (prev: { auto: boolean; mode: Mode; org: number }) => ({ ...prev, mode: m }) });
  const setOrg = (id: number) =>
    navigate({ search: (prev: { auto: boolean; mode: Mode; org: number }) => ({ ...prev, org: id }) });

  const headerSub =
    mode === "watched"
      ? `${watched.length} urheilijaa seurannassa · ${compName}`
      : orgName
        ? `${orgName} · ${compName}`
        : `Valitse seura · ${compName}`;


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              YAG Calling-aikataulu
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {headerSub}
            </p>
          </div>
          <Button
            onClick={handleDownload}
            size="sm"
            className="gap-2"
            disabled={grouped.length === 0}
          >
            <Download className="h-4 w-4" />
            Lataa PDF
          </Button>
        </div>
      </header>

      <PrintTabs />

      <main
        className={`mx-auto max-w-3xl px-4 py-6 print:py-2 print-schedule print-${orientation}`}
      >
        <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm print:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Näytä
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "watched", label: "Seurannassa" },
              { v: "club", label: "Oma seura" },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => setMode(o.v)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === o.v
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-background text-foreground hover:bg-secondary"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {mode === "club" && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Valitse seura
              </label>
              <select
                value={org || ""}
                onChange={(e) => setOrg(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Valitse —</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.athletes})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mb-5 rounded-xl border bg-card p-4 shadow-sm print:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tulostussuunta
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full gap-2 sm:w-auto">
              {(["portrait", "landscape"] as Orientation[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
                    orientation === o
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {o === "portrait" ? "Pysty" : "Vaaka"}
                </button>
              ))}
            </div>
            <Button
              onClick={handleDownload}
              size="sm"
              className="gap-2 shrink-0"
              disabled={grouped.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Lataa PDF</span>
              <span className="sm:hidden">Lataa</span>
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Vinkki: erä-numero näkyy vasta kun tuloslista on julkaissut eräjaon.
          </p>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold print:text-lg">
            {compName} — Calling-aikataulu
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "watched"
              ? "Seurannassa olevien urheilijoiden lähdöt"
              : orgName
                ? `Seuran ${orgName} urheilijoiden lähdöt`
                : "Valitse seura nähdäksesi lähdöt"}
          </p>
        </div>

        {mode === "watched" && watched.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground print:hidden">
            <Users className="mx-auto mb-2 h-6 w-6 opacity-60" />
            Ei urheilijoita seurannassa. Lisää urheilijoita{" "}
            <Link to="/watch" className="text-primary underline">
              kilpailijaseurannassa
            </Link>
            .
          </p>
        )}

        {mode === "club" && !org && !indexQuery.isLoading && (
          <p className="py-12 text-center text-sm text-muted-foreground print:hidden">
            Valitse seura yllä olevasta valikosta.
          </p>
        )}

        {indexQuery.isLoading && entries.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ladataan…
          </p>
        )}

        {!indexQuery.isLoading &&
          ((mode === "watched" && watched.length > 0) ||
            (mode === "club" && org > 0)) &&
          grouped.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {mode === "watched"
                ? "Seuratuilla ei ole lähtöjä YAG-kisassa."
                : "Tällä seuralla ei ole lähtöjä YAG-kisassa."}
            </p>
          )}


        {grouped.map((g) => (
          <section key={g.date} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 border-b-2 border-primary pb-1 text-lg font-bold print:text-base">
              {DATE_LABEL[g.date] ?? g.date}
            </h2>
            <table className="w-full text-sm print:text-xs">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 pr-2 font-semibold">Calling</th>
                  <th className="py-1 pr-2 font-semibold">Kentälle</th>
                  <th className="py-1 pr-2 font-semibold">Alkaa</th>
                  <th className="py-1 pr-2 font-semibold">Sarja / Laji</th>
                  <th className="py-1 pr-2 font-semibold">Erä</th>
                  <th className="py-1 font-semibold">Paikka</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((m, idx) => {
                  const isUnpublished = m.allHeats != null;
                  // Erä julkaistuille: tuloslistasta jos yksiselitteinen,
                  // muutoin PDF:stä.
                  const heatFromEntries = (() => {
                    const set = new Set(
                      m.entries.map((e) => e.heatIndex).filter((h) => h > 0),
                    );
                    if (set.size === 1) return [...set][0];
                    return null;
                  })();
                  const erä = heatFromEntries ?? m.heatNumber;
                  return (
                    <tr
                      key={`${m.row.date}-${m.row.calling}-${idx}`}
                      className="border-b border-border/50 align-top"
                    >
                      <td className="py-2 pr-2 font-semibold tabular-nums">
                        {isUnpublished ? (
                          <ul className="space-y-0.5">
                            {m.allHeats!.map((h, i) => (
                              <li key={i} className="whitespace-nowrap">
                                {h.calling}
                                {h.heat != null && (
                                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                                    erä {h.heat}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          m.row.calling
                        )}
                      </td>
                      <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                        {isUnpublished ? (
                          <ul className="space-y-0.5">
                            {m.allHeats!.map((h, i) => (
                              <li key={i}>{h.kentalle}</li>
                            ))}
                          </ul>
                        ) : (
                          m.row.kentalle
                        )}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">
                        {isUnpublished ? (
                          <ul className="space-y-0.5">
                            {m.allHeats!.map((h, i) => (
                              <li key={i}>{h.alkaa}</li>
                            ))}
                          </ul>
                        ) : (
                          m.row.alkaa
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="font-semibold leading-tight">
                          {m.row.sarja} {m.row.laji.replace(/\s*\(erä\s*\d+\)/, "")}
                        </div>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {m.entries.map((e, i) => (
                            <li key={`${e.alloc.Id}-${i}`}>
                              <span className="font-medium">
                                {e.alloc.Surname} {e.alloc.Firstname}
                              </span>
                              {e.alloc.Organization?.NameShort && (
                                <span className="ml-1 text-muted-foreground">
                                  {e.alloc.Organization.NameShort}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {m.overflowHeats && m.overflowHeats.length > 0 && (
                          <div className="mt-1 text-[10px] italic text-amber-700 print:text-black">
                            Huom: yllä mukana myös erät {formatHeatList(m.overflowHeats)} — calling-aikataulu puuttuu, selvitetään myöhemmin.
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">
                        {isUnpublished ? (
                          <span className="text-xs text-muted-foreground">
                            ei vielä
                            <br />
                            julkaistu
                          </span>
                        ) : erä != null ? (
                          erä
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                      <td className="py-2">
                        {isUnpublished ? (
                          (() => {
                            const places = Array.from(
                              new Set(m.allHeats!.map((h) => h.paikka)),
                            );
                            return places.length === 1 ? places[0] : (
                              <ul className="space-y-0.5">
                                {m.allHeats!.map((h, i) => (
                                  <li key={i}>{h.paikka}</li>
                                ))}
                              </ul>
                            );
                          })()
                        ) : (
                          m.row.paikka
                        )}
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </section>
        ))}

        <p className="mt-8 text-center text-xs text-muted-foreground print:mt-4">
          Lähde: live.tuloslista.com + virallinen Calling-aikataulu · Tulostettu{" "}
          {new Date().toLocaleString("fi-FI")}
        </p>
      </main>
    </div>
  );
}
