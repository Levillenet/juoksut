import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Play, Search, Youtube } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchPublicVideos, type PublicVideoItem } from "@/lib/public-videos";
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
          {filtered.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setActive(v)}
              className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
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
                  {v.athlete_key.startsWith("heat:")
                    ? v.sub_category || "Eräkooste"
                    : [v.surname, v.firstname].filter(Boolean).join(" ") || "Urheilija"}
                </p>
                {v.organization && !v.athlete_key.startsWith("heat:") && (
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
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
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
                {active.result_text ? ` · ${active.result_text}` : ""}
                {active.competition_name ? ` · ${active.competition_name}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          {active && (
            <div className="aspect-video overflow-hidden rounded-md bg-black">
              <iframe
                src={embedUrl(active.youtube_video_id)}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
