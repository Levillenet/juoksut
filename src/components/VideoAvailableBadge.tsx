import { useQuery } from "@tanstack/react-query";
import { Youtube } from "lucide-react";
import { fetchPublicVideoIndex } from "@/lib/result-videos";

/** Provides the current index of (competition_id, event_name) pairs with public videos. */
export function usePublicVideoIndex() {
  return useQuery({
    queryKey: ["public-video-index"],
    queryFn: fetchPublicVideoIndex,
    staleTime: 60_000,
  });
}

export function hasPublicVideo(
  index: Set<string> | undefined,
  competitionId: number | null | undefined,
  eventName: string | null | undefined,
): boolean {
  if (!index || competitionId == null || !eventName) return false;
  return index.has(`${competitionId}|${eventName}`);
}

/**
 * Small red YouTube badge shown next to an event/result row when the system
 * has at least one public video for that (competition, event).
 */
export function VideoAvailableBadge({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "xs" | "sm";
}) {
  const icon = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span
      title="Julkinen suoritusvideo saatavilla"
      aria-label="Julkinen suoritusvideo saatavilla"
      className={`inline-flex items-center gap-0.5 rounded-md bg-red-500/10 px-1 py-0.5 text-red-600 dark:text-red-400 ${className}`}
    >
      <Youtube className={icon} />
    </span>
  );
}
