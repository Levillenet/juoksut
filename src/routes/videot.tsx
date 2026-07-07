import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Play, Search, Youtube } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchPublicVideos,
  type PublicVideoItem,
} from "@/lib/public-videos";
import { supabase } from "@/integrations/supabase/client";
import { fetchEvent, fetchRounds } from "@/lib/tuloslista";
import type { HeatResultSnapshot } from "@/lib/result-videos";
import { useQueryClient } from "@tanstack/react-query";
import { embedUrl } from "@/lib/result-videos";

export const Route = createFileRoute("/videot")({
  component: VideotPage,
  head: () => ({
    meta: [
      { title: "Päivän videot – julkiset juoksusuoritukset" },
      {
        name: "description",
        content:
          "Selaa viimeisimpiä julkisia juoksu- ja viestisuoritusten videoita päivämäärän ja kilpailun mukaan.",
      },
      { property: "og:title", content: "Päivän videot" },
      {
        property: "og:description",
        content:
          "Julkiset suoritusvideot yleisurheilukisoista – suodata päivämäärän ja kilpailun mukaan.",
      },
    ],
  }),
});

function helsinkiTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ymdFromIso(iso: string): string {
  // Convert an ISO timestamp to Helsinki YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function VideotPage() {
  const [dateYmd, setDateYmd] = useState<string>(""); // "" = show all
  const [competitionId, setCompetitionId] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [active, setActive] = useState<PublicVideoItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["public-videos-archive"],
    queryFn: () => fetchPublicVideos({ sinceHours: 30 * 24, limit: 300 }),
    staleTime: 60_000,
  });
  const items = data ?? [];

  const competitions = useMemo(() => {
    const map = new Map<number, string>();
    for (const v of items) {
      if (!map.has(v.competition_id)) {
        map.set(v.competition_id, v.competition_name || `Kisa #${v.competition_id}`);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fi"));
  }, [items]);

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return items.filter((v) => {
      if (competitionId && String(v.competition_id) !== competitionId) return false;
      if (dateYmd) {
        const ymd = v.competition_date || ymdFromIso(v.created_at);
        if (ymd !== dateYmd) return false;
      }
      if (qLower) {
        const hay = [
          v.event_name,
          v.age_class,
          v.surname,
          v.firstname,
          v.sub_category,
          v.competition_name,
          v.organization,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [items, competitionId, dateYmd, q]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="mb-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Etusivulle
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Youtube className="h-6 w-6 text-red-600" />
        <h1 className="text-2xl font-bold tracking-tight">Päivän videot</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Kaikki viimeisen 30 päivän julkiset suoritusvideot. Suodata päivän, kilpailun tai
        hakusanan mukaan.
      </p>

      <details className="group mb-4 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
        <summary className="cursor-pointer list-none font-semibold text-foreground marker:hidden">
          ❓ Miten jaan oman videon?
          <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
            (avaa ohje)
          </span>
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground">
          <li>
            <strong>Lataa video omalle YouTube-tilillesi.</strong> Aseta se tarpeen mukaan{" "}
            <em>Piilotettu (Unlisted)</em> -tilaan – silloin videota ei löydä hausta, mutta
            linkin avulla sen voi katsoa.
          </li>
          <li>
            <strong>Kopioi videon linkki</strong> YouTuben <em>Jaa</em>-toiminnolla.
          </li>
          <li>
            <strong>Liitä linkki urheilijaseurannassa</strong> oikean urheilijan oikeaan
            juoksuerään (rivin lopussa oleva YouTube-nappi).
          </li>
        </ol>
        <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <strong>Huom:</strong> Juoksulajien videot voi asettaa julkiseksi tai
          yksityiseksi. Kenttälajien videot ovat aina yksityisiä ja jäävät vain sinulle omaan
          arkistoosi myöhempää katselua varten.
        </p>
      </details>


      {/* Filters */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Päivämäärä
          </label>
          <input
            type="date"
            value={dateYmd}
            max={helsinkiTodayYmd()}
            onChange={(e) => setDateYmd(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {dateYmd && (
            <button
              type="button"
              onClick={() => setDateYmd("")}
              className="mt-1 text-[11px] text-primary hover:underline"
            >
              Näytä kaikki päivät
            </button>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Kilpailu
          </label>
          <select
            value={competitionId}
            onChange={(e) => setCompetitionId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Kaikki kilpailut ({competitions.length})</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Haku (laji, nimi, ikäluokka)
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="esim. 60 m aidat, T11, Aavikko"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {isLoading ? "Ladataan…" : `${filtered.length} / ${items.length} videota`}
      </p>

      {!isLoading && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          Ei videoita näillä ehdoilla.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const isHeat = v.athlete_key.startsWith("heat:");
            return (
              <div
                key={v.id}
                className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setActive(v)}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-video overflow-hidden bg-black">
                    <img
                      src={`https://i.ytimg.com/vi/${v.youtube_video_id}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white transition-colors group-hover:bg-red-600">
                        <Play className="h-6 w-6 fill-current" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-bold leading-tight">
                      {isHeat
                        ? v.sub_category || "Eräkooste"
                        : [v.surname, v.firstname].filter(Boolean).join(" ") || "Urheilija"}
                    </p>
                    {v.organization && !isHeat && (
                      <p className="truncate text-xs text-muted-foreground">
                        {v.organization}
                      </p>
                    )}
                    <p className="mt-1 truncate text-xs">
                      <span className="font-semibold">
                        {v.age_class ? `${v.age_class} ` : ""}
                        {v.event_name}
                      </span>
                      {v.result_text && (
                        <>
                          {" · "}
                          <span className="font-bold tabular-nums">{v.result_text}</span>
                          {v.result_rank != null && (
                            <span className="ml-1 text-muted-foreground">
                              ({v.result_rank}.)
                            </span>
                          )}
                        </>
                      )}
                    </p>
                    {v.competition_name && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {v.competition_date ? `${v.competition_date} · ` : ""}
                        {v.competition_name}
                      </p>
                    )}
                  </div>
                </button>
                {isHeat && <HeatResultsToggle video={v} />}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-600" />
              {active
                ? [active.surname, active.firstname].filter(Boolean).join(" ") ||
                  active.sub_category ||
                  "Suoritusvideo"
                : "Suoritusvideo"}
            </DialogTitle>
            {active && (
              <DialogDescription className="truncate">
                {active.age_class ? `${active.age_class} ` : ""}
                {active.event_name}
                {active.sub_category ? ` · ${active.sub_category}` : ""}
                {active.result_text ? ` · ${active.result_text}` : ""}
                {active.competition_name ? ` · ${active.competition_name}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          {active && (
            <div className="mx-auto w-full shrink-0 overflow-hidden rounded-md bg-black" style={{ maxWidth: "min(100%, calc((45vh) * 16 / 9))" }}>
              <div className="aspect-video w-full">
                <iframe
                  src={embedUrl(active.youtube_video_id)}
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>
          )}
          {active?.athlete_key.startsWith("heat:") && (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-card/50 px-3 py-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  {active.sub_category ? `${active.sub_category} · ` : ""}Tulokset
                </h2>
                <span className="text-xs text-muted-foreground">
                  {active.age_class ? `${active.age_class} ` : ""}{active.event_name}
                </span>
              </div>
              <HeatResultsList video={active} enabled />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

function HeatResultsToggle({ video }: { video: PublicVideoItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
        aria-expanded={open}
      >
        <span>{open ? "Piilota erän tulokset" : "Näytä erän tulokset"}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 text-xs">
          <HeatResultsList video={video} enabled={open} />
        </div>
      )}
    </div>
  );
}

function HeatResultsList({ video, enabled }: { video: PublicVideoItem; enabled: boolean }) {
  const qc = useQueryClient();
  const heatId = useMemo(() => {
    const m = video.athlete_key.match(/^heat:(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  }, [video.athlete_key]);

  const storedRows = video.stored_heat_results ?? null;
  const canStoreFromResults =
    enabled && !video.heat_results && !!storedRows && storedRows.length > 0;
  const { data: savedStoredRows } = useQuery({
    queryKey: ["heat-results-store-from-results", video.id],
    queryFn: async () => {
      await supabase.rpc("set_heat_results_if_null", {
        _video_id: video.id,
        _snapshot: storedRows as any,
      });
      qc.invalidateQueries({ queryKey: ["public-videos-archive"] });
      return storedRows;
    },
    enabled: canStoreFromResults,
    staleTime: Infinity,
    retry: false,
  });

  const canBackfill =
    enabled &&
    !video.heat_results &&
    !storedRows &&
    heatId != null;
  const { data: backfilled, isLoading } = useQuery({
    queryKey: ["heat-backfill-v2", video.id, video.event_id ?? "discover"],
    queryFn: async () => {
      const eventIds = new Set<number>();
      if (video.event_id != null) eventIds.add(video.event_id);
      if (eventIds.size === 0) {
        const byDate = await fetchRounds(video.competition_id);
        for (const round of Object.values(byDate).flat()) {
          if (round.EventName === video.event_name) eventIds.add(round.EventId);
        }
      }

      for (const eventId of eventIds) {
        const ev = await fetchEvent(video.competition_id, eventId);
        for (const round of ev.Rounds ?? []) {
          for (const heat of round.Heats ?? []) {
            if (heat.Id === heatId) {
              const allocs = [...heat.Allocations]
                .sort((a, b) => a.Position - b.Position)
                .map((a) => ({
                  position: a.Position ?? null,
                  surname: a.Surname ?? null,
                  firstname: a.Firstname ?? null,
                  organization: a.Organization?.Name ?? null,
                  result_text: a.Result ?? null,
                  result_rank: a.ResultRank ?? null,
                }));
              if (allocs.length > 0) {
                await supabase.rpc("set_heat_results_if_null", {
                  _video_id: video.id,
                  _snapshot: allocs as any,
                });
                qc.invalidateQueries({ queryKey: ["public-videos-archive"] });
              }
              return allocs;
            }
          }
        }
      }
      return null;
    },
    enabled: canBackfill,
    staleTime: 0,
    retry: false,
  });

  const rows = video.heat_results ?? savedStoredRows ?? storedRows ?? backfilled ?? null;
  const sorted = useMemo(() => {
    if (!rows) return null;
    const hasAnyLane = rows.some((r) => r.position != null);
    return [...rows].sort((a, b) => {
      if (hasAnyLane) {
        const ap = a.position ?? 9999;
        const bp = b.position ?? 9999;
        if (ap !== bp) return ap - bp;
      }
      const ar = a.result_rank ?? 9999;
      const br = b.result_rank ?? 9999;
      return ar - br;
    });
  }, [rows]);
  return (
    <>
      {!sorted && isLoading ? (
        <p className="text-muted-foreground">Ladataan…</p>
      ) : !sorted || sorted.length === 0 ? (
        <p className="text-muted-foreground">Ei tuloksia tallennettu tälle videolle.</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[1.75rem_2rem_minmax(0,1fr)_3.25rem] items-center gap-2 bg-muted/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid-cols-[2rem_2.25rem_minmax(0,1fr)_4rem] sm:gap-3 sm:px-3">
            <span className="text-center">Sija</span>
            <span className="text-center">Rata</span>
            <span>Nimi</span>
            <span className="text-right">Tulos</span>
          </div>
          <ul className="divide-y">
            {sorted.map((r, i) => (
              <li
                key={`${r.surname ?? ""}-${r.firstname ?? ""}-${r.position ?? i}`}
                className="grid grid-cols-[1.75rem_2rem_minmax(0,1fr)_3.25rem] items-center gap-2 px-2 py-2 sm:grid-cols-[2rem_2.25rem_minmax(0,1fr)_4rem] sm:gap-3 sm:px-3"
              >
                <span className="grid h-6 w-6 place-items-center justify-self-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-foreground/80">
                  {r.result_rank != null ? r.result_rank : "–"}
                </span>
                <span className="justify-self-center font-mono text-[11px] font-bold tabular-nums text-primary">
                  {r.position != null ? `R${r.position}` : "–"}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[13px] font-semibold text-foreground">
                    {[r.surname, r.firstname].filter(Boolean).join(" ") || "—"}
                  </span>
                  {r.organization && (
                    <span className="truncate text-[10px] text-muted-foreground">
                      {r.organization}
                    </span>
                  )}
                </span>
                <span className="text-right text-[13px] font-bold tabular-nums">
                  {r.result_text || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>


      )}
    </>
  );
}
