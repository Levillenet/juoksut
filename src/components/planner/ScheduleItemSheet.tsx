import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatEventLabel } from "@/lib/event-name";
import { useMutation } from "@tanstack/react-query";
import {
  Clock,
  MapPin,
  Copy,
  Trash2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getEventColorClass } from "@/lib/planner-defaults";
import type {
  PlanEventRow,
  PlanRow,
  ScheduleItemRow,
  VenueRow,
} from "@/lib/planner-types";
import type { Conflict } from "@/lib/planner-solver";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  plan: PlanRow;
  schedule: ScheduleItemRow[];
  events: PlanEventRow[];
  venues: VenueRow[];
  conflicts: Conflict[];
  onChange: () => void;
  /** Vaihda valinta toiseen aikataulu-itemiin (esim. nuolinäppäimet). */
  onSelect: (id: string) => void;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalDateTimeInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInputValue(v: string): string {
  return new Date(v).toISOString();
}

export function ScheduleItemSheet({
  open,
  onOpenChange,
  itemId,
  plan,
  schedule,
  events,
  venues,
  conflicts,
  onChange,
  onSelect,
}: Props) {
  const item = schedule.find((s) => s.id === itemId) ?? null;
  const ev = item ? events.find((e) => e.id === item.plan_event_id) ?? null : null;
  const venue = item ? venues.find((v) => v.id === item.venue_id) ?? null : null;

  const [confirmDelete, setConfirmDelete] = useState(false);

  // Editoitavat kentät — paikallinen tila + autosave on blur/change
  const [startLocal, setStartLocal] = useState("");
  const [durationMin, setDurationMin] = useState<number>(0);
  const [participants, setParticipants] = useState<number>(0);
  const [officialsCount, setOfficialsCount] = useState<number>(0);
  const [officialsOverridden, setOfficialsOverridden] = useState<boolean>(false);

  useEffect(() => {
    if (!item || !ev) return;
    setStartLocal(toLocalDateTimeInputValue(item.starts_at));
    const dur = Math.round(
      (new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60000,
    );
    setDurationMin(dur);
    setParticipants(ev.participants ?? 0);
    setOfficialsCount(ev.officials_count ?? 0);
    setOfficialsOverridden(ev.officials_count_overridden ?? false);
  }, [item?.id, ev?.id]);

  const updateItem = useMutation({
    mutationFn: async (patch: Partial<ScheduleItemRow>) => {
      if (!item) return;
      const { error } = await supabase
        .from("plan_schedule_items")
        .update({ ...patch, auto_generated: false })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: onChange,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEvent = useMutation({
    mutationFn: async (patch: Partial<PlanEventRow>) => {
      if (!ev) return;
      const { error } = await supabase
        .from("plan_events")
        .update(patch)
        .eq("id", ev.id);
      if (error) throw error;
    },
    onSuccess: onChange,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async () => {
      if (!item) return;
      const { error } = await supabase
        .from("plan_schedule_items")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aikataulutus poistettu");
      onChange();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyItem = useMutation({
    mutationFn: async () => {
      if (!item) return null;
      const newStart = new Date(new Date(item.starts_at).getTime() + 60 * 60000);
      const newEnd = new Date(new Date(item.ends_at).getTime() + 60 * 60000);
      const { data, error } = await supabase
        .from("plan_schedule_items")
        .insert({
          plan_id: item.plan_id,
          plan_event_id: item.plan_event_id,
          venue_id: item.venue_id,
          starts_at: newStart.toISOString(),
          ends_at: newEnd.toISOString(),
          phase: item.phase,
          auto_generated: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data?.id ?? null;
    },
    onSuccess: (newId) => {
      toast.success("Laji kopioitu (+1 h)");
      onChange();
      if (newId) onSelect(newId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shiftBy = (deltaMin: number) => {
    if (!item) return;
    const ns = new Date(new Date(item.starts_at).getTime() + deltaMin * 60000);
    const ne = new Date(new Date(item.ends_at).getTime() + deltaMin * 60000);
    updateItem.mutate({ starts_at: ns.toISOString(), ends_at: ne.toISOString() });
  };

  const sameVenueItems = useMemo(() => {
    if (!item) return [];
    return schedule
      .filter((s) => s.venue_id === item.venue_id)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [schedule, item?.venue_id]);

  const prevItem = useMemo(() => {
    if (!item) return null;
    const i = sameVenueItems.findIndex((s) => s.id === item.id);
    return i > 0 ? sameVenueItems[i - 1] : null;
  }, [sameVenueItems, item?.id]);
  const nextItem = useMemo(() => {
    if (!item) return null;
    const i = sameVenueItems.findIndex((s) => s.id === item.id);
    return i >= 0 && i < sameVenueItems.length - 1 ? sameVenueItems[i + 1] : null;
  }, [sameVenueItems, item?.id]);

  const itemConflicts = conflicts.filter(
    (c) => c.id === item?.id || c.relatedIds?.includes(item?.id ?? ""),
  );

  // Pikanäppäimet
  useEffect(() => {
    if (!open || !item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Escape") onOpenChange(false);
      else if (e.key === "ArrowLeft") {
        e.preventDefault();
        shiftBy(-15);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        shiftBy(15);
      } else if (e.key === "Delete") {
        e.preventDefault();
        setConfirmDelete(true);
      } else if (e.key === "ArrowUp" && prevItem) {
        e.preventDefault();
        onSelect(prevItem.id);
      } else if (e.key === "ArrowDown" && nextItem) {
        e.preventDefault();
        onSelect(nextItem.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, item?.id, prevItem?.id, nextItem?.id]);

  if (!item || !ev) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }

  const color = getEventColorClass(ev.event_name, ev.sub_category);
  const calcText = (() => {
    const stations = Math.max(1, ev.station_count);
    const heatSize = Math.max(1, ev.heat_size);
    const heats = Math.max(1, Math.ceil(participants / heatSize));
    const perHeat = Math.max(1, ev.between_heats_min ?? 0);
    return `${participants} osall. / ${heatSize} = ${heats} erää × ~${perHeat} min`;
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader
          className={`space-y-1 border-b ${color.bg} ${color.text} px-4 py-3`}
        >
          <SheetTitle className="text-lg font-semibold">
            {ev.age_class} {ev.event_name}
          </SheetTitle>
          <div className="flex items-center gap-1.5 text-xs opacity-90">
            <MapPin className="h-3 w-3" />
            Suorituspaikka: {venue?.name ?? "—"}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Pikatoiminnot */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              onClick={() => shiftBy(-15)}
            >
              <Clock className="mr-1 h-3.5 w-3.5" />
              −15 min
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              onClick={() => shiftBy(15)}
            >
              <Clock className="mr-1 h-3.5 w-3.5" />
              +15 min
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              onClick={() => copyItem.mutate()}
              disabled={copyItem.isPending}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              Kopioi
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 sm:min-h-9 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Poista
            </Button>
            {prevItem && (
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 sm:min-h-9"
                onClick={() => onSelect(prevItem.id)}
                title="Edellinen samalla paikalla (↑)"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
            )}
            {nextItem && (
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 sm:min-h-9"
                onClick={() => onSelect(nextItem.id)}
                title="Seuraava samalla paikalla (↓)"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Konflikti */}
          {itemConflicts.length > 0 && (
            <div className="mb-4 space-y-1 rounded-md border-l-4 border-red-500 bg-red-50 p-2 text-xs text-red-900">
              {itemConflicts.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{c.reason}</span>
                </div>
              ))}
            </div>
          )}

          {/* Editoitavat kentät */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Aloitusaika</Label>
              <Input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                onBlur={() => {
                  if (!startLocal) return;
                  const newStart = fromLocalDateTimeInputValue(startLocal);
                  const newEnd = new Date(
                    new Date(newStart).getTime() + durationMin * 60000,
                  ).toISOString();
                  if (newStart === item.starts_at) return;
                  updateItem.mutate({ starts_at: newStart, ends_at: newEnd });
                }}
                className="h-11 sm:h-9"
              />
            </div>

            <div>
              <Label className="text-xs">Kesto (min)</Label>
              <Input
                type="number"
                min={1}
                value={durationMin}
                onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)}
                onBlur={() => {
                  if (durationMin <= 0) return;
                  const newEnd = new Date(
                    new Date(item.starts_at).getTime() + durationMin * 60000,
                  ).toISOString();
                  if (newEnd === item.ends_at) return;
                  updateItem.mutate({ ends_at: newEnd });
                }}
                className="h-11 sm:h-9"
              />
            </div>

            <div>
              <Label className="text-xs">Suorituspaikka</Label>
              <Select
                value={item.venue_id}
                onValueChange={(v) => updateItem.mutate({ venue_id: v })}
              >
                <SelectTrigger className="h-11 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {venues
                    .filter((v) => v.included !== false)
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Osallistujamäärä</Label>
              <Input
                type="number"
                min={0}
                value={participants}
                onChange={(e) => setParticipants(parseInt(e.target.value) || 0)}
                onBlur={() => {
                  if (participants === ev.participants) return;
                  updateEvent.mutate({ participants });
                }}
                className="h-11 sm:h-9"
              />
            </div>

            <div>
              <Label className="text-xs">
                Toimitsijoita {officialsOverridden ? "(manuaalinen)" : "(auto)"}
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  value={officialsCount}
                  onChange={(e) => setOfficialsCount(parseInt(e.target.value) || 0)}
                  onBlur={() => {
                    if (
                      officialsCount === ev.officials_count &&
                      officialsOverridden === ev.officials_count_overridden
                    )
                      return;
                    updateEvent.mutate({
                      officials_count: officialsCount,
                      officials_count_overridden: true,
                    });
                    setOfficialsOverridden(true);
                  }}
                  className="h-11 sm:h-9"
                />
                {officialsOverridden && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 sm:h-9"
                    onClick={() => {
                      updateEvent.mutate({ officials_count_overridden: false });
                      setOfficialsOverridden(false);
                    }}
                  >
                    Palauta
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Lisätiedot */}
          <div className="mt-5 space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
            <div>
              <span className="text-muted-foreground">Laskenta: </span>
              {calcText}
            </div>
            <div>
              <span className="text-muted-foreground">Edellinen paikalla: </span>
              {prevItem
                ? `${eventLabel(prevItem, events)} (loppu ${fmtTime(prevItem.ends_at)})`
                : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Seuraava paikalla: </span>
              {nextItem
                ? `${eventLabel(nextItem, events)} (alku ${fmtTime(nextItem.starts_at)})`
                : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Vaihe: </span>
              {item.phase}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t bg-card p-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Sulje
          </Button>
        </div>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Poistetaanko {ev.age_class} {ev.event_name} aikataulusta?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vain aikataulutus poistuu. Laji säilyy lajilistassa ja voidaan
              uudelleen aikatauluttaa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                deleteItem.mutate();
              }}
            >
              Poista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

function eventLabel(it: ScheduleItemRow, events: PlanEventRow[]): string {
  const ev = events.find((e) => e.id === it.plan_event_id);
  return ev ? formatEventLabel(ev.age_class, ev.event_name) : "—";
}
