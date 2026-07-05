import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Youtube } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchPublicVideosForEvent,
  type PublicVideoItem,
} from "@/lib/public-videos";
import { embedUrl } from "@/lib/result-videos";

/**
 * Clickable red YouTube badge. Opens a dialog listing every public video for
 * the given (competition_id, event_name). If only one exists it plays inline;
 * with multiple, each is embedded stacked with a short heading.
 */
export function PublicVideoLinkButton({
  competitionId,
  eventName,
  contextLabel,
  size = "xs",
  className = "",
}: {
  competitionId: number;
  eventName: string;
  contextLabel?: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const icon = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  const query = useQuery({
    queryKey: ["public-videos-for-event", competitionId, eventName],
    queryFn: () => fetchPublicVideosForEvent(competitionId, eventName),
    enabled: open,
    staleTime: 60_000,
  });
  const videos = query.data ?? [];

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        title="Katso julkinen suoritusvideo"
        aria-label="Katso julkinen suoritusvideo"
        className={`inline-flex items-center gap-0.5 rounded-md bg-red-500/10 px-1 py-0.5 text-red-600 hover:bg-red-500/20 dark:text-red-400 ${className}`}
      >
        <Youtube className={icon} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-600" />
              {eventName}
            </DialogTitle>
            {contextLabel && (
              <DialogDescription className="truncate">
                {contextLabel}
              </DialogDescription>
            )}
          </DialogHeader>

          {query.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ladataan videoita…
            </p>
          ) : videos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ei julkisia videoita tälle lajille.
            </p>
          ) : (
            <div className="space-y-4">
              {videos.map((v) => (
                <VideoBlock key={v.id} v={v} />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function VideoBlock({ v }: { v: PublicVideoItem }) {
  const heading = v.athlete_key.startsWith("heat:")
    ? v.sub_category || "Eräkooste"
    : [v.surname, v.firstname].filter(Boolean).join(" ") || "Suoritusvideo";
  const detail = [
    v.age_class,
    v.sub_category && !v.athlete_key.startsWith("heat:") ? v.sub_category : null,
    v.result_text,
    v.result_rank != null ? `sija ${v.result_rank}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{heading}</p>
      {detail && (
        <p className="mb-2 truncate text-xs text-muted-foreground">{detail}</p>
      )}
      <div className="aspect-video overflow-hidden rounded-md bg-black">
        <iframe
          src={embedUrl(v.youtube_video_id)}
          title={`YouTube ${heading}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
