import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Youtube } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchPublicVideos, type PublicVideoItem } from "@/lib/public-videos";
import { embedUrl } from "@/lib/result-videos";

export function PublicVideosSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-videos"],
    queryFn: fetchPublicVideos,
    staleTime: 60_000,
  });
  const [active, setActive] = useState<PublicVideoItem | null>(null);

  if (isLoading) return null;
  const items = data ?? [];

  return (
    <section className="pt-2">
      <div className="mb-3 flex items-center gap-2">
        <Youtube className="h-5 w-5 text-red-600" />
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Päivän videot
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-4 py-6 text-center text-xs text-muted-foreground">
          Ei vielä julkisia suoritusvideoita. Lisää omat urheilijaseurannassa ja
          aseta ne julkiseksi.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((v) => (
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
                  {[v.surname, v.firstname].filter(Boolean).join(" ") ||
                    "Urheilija"}
                </p>
                {v.organization && (
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
                      <span className="font-bold tabular-nums">
                        {v.result_text}
                      </span>
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
    </section>
  );
}
