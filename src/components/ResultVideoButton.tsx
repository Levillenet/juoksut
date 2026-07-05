import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Youtube, Loader2, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import {
  deleteResultVideo,
  embedUrl,
  insertResultVideo,
  parseYoutubeId,
  updateResultVideo,
  type ResultVideo,
} from "@/lib/result-videos";


interface Props {
  athleteKey: string;
  competitionId: number;
  eventName: string;
  subCategory: string;
  /** All videos visible for this result slot (own + public from others). */
  videos: ResultVideo[];
  /** Label used in dialog header, e.g. "T11 60m aidat · Kouvola Junior Games". */
  contextLabel?: string;
  /** Size preset for the trigger. */
  size?: "xs" | "sm";
}

export function ResultVideoButton({
  athleteKey,
  competitionId,
  eventName,
  subCategory,
  videos,
  contextLabel,
  size = "xs",
}: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "";
  const [open, setOpen] = useState(false);

  const own = videos.filter((v) => v.user_id === myUserId);
  const publicOthers = videos.filter(
    (v) => v.user_id !== myUserId && v.is_public,
  );
  const anyVisible = own.length > 0 || publicOthers.length > 0;
  const canEdit = !!user;

  if (!anyVisible && !canEdit) return null;

  const iconClass = size === "sm" ? "h-4 w-4" : "h-3.5 w-3.5";
  const btnClass =
    size === "sm"
      ? "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
      : "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={anyVisible ? "Katso suoritusvideo" : "Lisää suoritusvideo"}
        className={`${btnClass} transition-colors ${
          anyVisible
            ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title={anyVisible ? "Suoritusvideo" : "Lisää videolinkki"}
      >
        <Youtube className={iconClass} />
        {anyVisible ? (own.length + publicOthers.length > 1 ? <span className="ml-0.5">{own.length + publicOthers.length}</span> : null) : <span>Video</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-600" />
              Suoritusvideot
            </DialogTitle>
            {contextLabel && (
              <DialogDescription className="truncate">{contextLabel}</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {own.map((v) => (
              <VideoSection key={v.id} video={v} label="Sinun lisäämäsi video" editable />
            ))}
            {publicOthers.map((v) => (
              <VideoSection
                key={v.id}
                video={v}
                label="Julkinen video"
                editable={false}
              />
            ))}

            {canEdit && (
              <div className="rounded-lg border border-dashed bg-muted/30 p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  {own.length > 0 ? "Lisää uusi video" : "Lisää videolinkki"}
                </p>
                <VideoForm
                  athleteKey={athleteKey}
                  competitionId={competitionId}
                  eventName={eventName}
                  subCategory={subCategory}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


function VideoSection({
  video,
  label,
  editable,
}: {
  video: ResultVideo;
  label: string;
  editable: boolean;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const del = useMutation({
    mutationFn: () => deleteResultVideo(video.id),
    onSuccess: () => {
      toast.success("Video poistettu");
      qc.invalidateQueries({ queryKey: ["athlete-videos", video.athlete_key] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const togglePublic = useMutation({
    mutationFn: (nextPublic: boolean) =>
      updateResultVideo(video.id, {
        youtubeUrl: video.youtube_url,
        isPublic: nextPublic,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["athlete-videos", video.athlete_key] });
    },
    onError: (e) => toast.error((e as Error).message),
  });


  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {editable && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Switch
                id={`pub-${video.id}`}
                checked={video.is_public}
                onCheckedChange={(v) => togglePublic.mutate(v)}
                disabled={togglePublic.isPending}
              />
              <Label htmlFor={`pub-${video.id}`} className="text-[11px]">
                {video.is_public ? "Julkinen" : "Yksityinen"}
              </Label>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing((v) => !v)}
              aria-label="Muokkaa"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm("Poistetaanko video?")) del.mutate();
              }}
              disabled={del.isPending}
              aria-label="Poista"
            >
              {del.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>
      <div className="aspect-video overflow-hidden rounded-md bg-black">
        <iframe
          src={embedUrl(video.youtube_video_id)}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
      {editable && editing && (
        <div className="mt-3 border-t pt-3">
          <VideoForm
            athleteKey={video.athlete_key}
            competitionId={video.competition_id}
            eventName={video.event_name}
            subCategory={video.sub_category}
            editingId={video.id}
            initialUrl={video.youtube_url}
            initialIsPublic={video.is_public}
            onDone={() => setEditing(false)}
          />
        </div>
      )}

    </div>
  );
}

function VideoForm({
  athleteKey,
  competitionId,
  eventName,
  subCategory,
  editingId,
  initialUrl = "",
  initialIsPublic = false,
  onDone,
}: {
  athleteKey: string;
  competitionId: number;
  eventName: string;
  subCategory: string;
  editingId?: string;
  initialUrl?: string;
  initialIsPublic?: boolean;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState(initialUrl);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const preview = parseYoutubeId(url);

  const save = useMutation({
    mutationFn: () =>
      editingId
        ? updateResultVideo(editingId, { youtubeUrl: url, isPublic })
        : insertResultVideo({
            athleteKey,
            competitionId,
            eventName,
            subCategory,
            youtubeUrl: url,
            isPublic,
          }),
    onSuccess: () => {
      toast.success("Video tallennettu");
      qc.invalidateQueries({ queryKey: ["athlete-videos", athleteKey] });
      if (!editingId) setUrl("");
      onDone?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });


  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="yt-url" className="text-xs">
          YouTube-linkki
        </Label>
        <Input
          id="yt-url"
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="mt-1"
        />
        {url && !preview && (
          <p className="mt-1 text-[11px] text-destructive">
            Linkkiä ei tunnistettu YouTube-videoksi.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Switch id="new-public" checked={isPublic} onCheckedChange={setIsPublic} />
        <Label htmlFor="new-public" className="text-xs">
          {isPublic ? "Julkinen – näkyy kaikille" : "Yksityinen – vain sinulle"}
        </Label>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onDone && (
          <Button variant="ghost" size="sm" onClick={onDone}>
            <X className="h-3.5 w-3.5" />
            Peruuta
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => save.mutate()}
          disabled={!preview || save.isPending}
        >
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Tallenna
        </Button>
      </div>
    </div>
  );
}
