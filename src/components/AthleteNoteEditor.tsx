import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { upsertNote, type AthleteNote } from "@/lib/athlete-notes";

export function AthleteNoteEditor({
  athleteKey,
  competitionId,
  eventName,
  subCategory,
  placeholder,
  addLabel,
  note,
  otherNotes = [],
  labelMap,
}: {
  athleteKey: string;
  competitionId: number;
  eventName: string;
  subCategory: string;
  placeholder: string;
  addLabel: string;
  note: AthleteNote | null;
  otherNotes?: AthleteNote[];
  labelMap?: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(note?.note ?? "");
  const [saving, setSaving] = useState(false);
  const hasNote = !!note?.note;

  const open = () => {
    setDraft(note?.note ?? "");
    setExpanded(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await upsertNote({
        athleteKey,
        competitionId,
        eventName,
        subCategory,
        note: draft,
      });
      await queryClient.invalidateQueries({ queryKey: ["athlete-notes", athleteKey] });
      toast.success(draft.trim() ? "Muistiinpano tallennettu" : "Muistiinpano poistettu");
      setExpanded(false);
    } catch (err) {
      console.error(err);
      toast.error("Tallennus epäonnistui");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mt-1">
        {!expanded ? (
          <button
            type="button"
            onClick={open}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
              hasNote
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-label={hasNote ? "Avaa muistiinpano" : addLabel}
          >
            <StickyNote className="h-3 w-3" />
            {hasNote ? (
              <span className="max-w-[220px] truncate">{note!.note}</span>
            ) : (
              <span>{addLabel}</span>
            )}
          </button>
        ) : (
          <div className="mt-1 rounded-md border bg-muted/30 p-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className="min-h-[80px] text-xs"
              autoFocus
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(false)}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" />
                Peruuta
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Tallenna
              </Button>
            </div>
          </div>
        )}
      </div>
      {otherNotes.length > 0 && (
        <ul className="mt-1 space-y-1">
          {otherNotes.map((n) => (
            <li
              key={n.id}
              className="rounded-md border bg-muted/20 p-1.5 text-[11px]"
            >
              <p className="mb-0.5 text-[10px] text-muted-foreground">
                {labelMap?.get(n.user_id) ?? "Tiimiläinen"}
              </p>
              <p className="whitespace-pre-wrap">{n.note}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
