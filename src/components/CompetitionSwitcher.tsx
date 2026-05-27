import { useMemo, useRef, useState } from "react";
import { useCompetitionsWindow } from "@/lib/competition-list";
import { useCompetitionId } from "@/lib/competition-store";
import { helsinkiDateKey } from "@/lib/tuloslista";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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

export function CompetitionSwitcher({
  className,
  confirmOnChange = false,
}: {
  className?: string;
  confirmOnChange?: boolean;
}) {
  const [competitionId, setCompetitionId] = useCompetitionId();
  const { list, loading } = useCompetitionsWindow(7, 21);
  const [pending, setPending] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const todayKey = helsinkiDateKey(new Date().toISOString());
  const groups = useMemo(() => {
    const byDate = new Map<string, typeof list>();
    for (const c of list) {
      const k = helsinkiDateKey(c.Date);
      const arr = byDate.get(k) ?? [];
      arr.push(c);
      byDate.set(k, arr);
    }
    const keys = Array.from(byDate.keys()).sort((a, b) => {
      const [da, ma, ya] = a.split(".").map(Number);
      const [db, mb, yb] = b.split(".").map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return keys.map((k) => {
      const [d, m, y] = k.split(".").map(Number);
      const diff = Math.round(
        (new Date(y, m - 1, d).getTime() - todayMid.getTime()) / 86_400_000,
      );
      let label: string;
      if (k === todayKey) label = `Tänään · ${k}`;
      else if (diff === 1) label = `Huomenna · ${k}`;
      else if (diff === -1) label = `Eilen · ${k}`;
      else if (diff > 1) label = `${k} (+${diff} pv)`;
      else label = `${k} (${diff} pv)`;
      return { key: k, label, items: byDate.get(k)! };
    });
  }, [list, todayKey]);

  const inList = list.some((c) => c.Id === competitionId);

  const handleChange = (v: string) => {
    const next = parseInt(v, 10);
    if (next === competitionId) return;
    if (confirmOnChange) {
      setPending(next);
    } else {
      setCompetitionId(next);
    }
  };

  const pendingName =
    pending != null
      ? list.find((c) => c.Id === pending)?.Name ?? `Kisa #${pending}`
      : "";

  return (
    <>
      <Select
        value={String(competitionId)}
        onValueChange={handleChange}
        onOpenChange={(open) => {
          if (!open) return;
          requestAnimationFrame(() => {
            const root = contentRef.current;
            if (!root) return;
            const el = root.querySelector<HTMLElement>('[data-today="true"]');
            if (el) el.scrollIntoView({ block: "start" });
          });
        }}
      >
        <SelectTrigger className={className} aria-label="Valitse kisa">
          <SelectValue placeholder={loading ? "Ladataan…" : "Valitse kisa"} />
        </SelectTrigger>
        <SelectContent ref={contentRef} className="max-h-[70vh]">
          {!inList && (
            <SelectItem value={String(competitionId)}>Kisa #{competitionId}</SelectItem>
          )}
          {list.length === 0 && !loading && (
            <SelectItem value="__none" disabled>
              Ei kisoja tällä aikavälillä
            </SelectItem>
          )}
          {groups.map((g) => {
            const isToday = g.key === todayKey;
            return (
              <SelectGroup key={g.key}>
                <SelectLabel
                  data-today={isToday ? "true" : undefined}
                  className={
                    isToday
                      ? "sticky top-0 z-10 bg-primary px-2 py-1.5 text-sm font-extrabold uppercase tracking-wide text-primary-foreground"
                      : "bg-muted/60 px-2 py-1 text-xs font-bold uppercase tracking-wide text-foreground"
                  }
                >
                  {g.label}
                </SelectLabel>
                {g.items.map((c) => (
                  <SelectItem key={c.Id} value={String(c.Id)}>
                    {c.Name}
                    {c.Location ? ` · ${c.Location}` : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>

      <AlertDialog
        open={pending != null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vaihda kilpailua?</AlertDialogTitle>
            <AlertDialogDescription>
              Vaihdetaanko aktiiviseksi kisaksi: <strong>{pendingName}</strong>?
              Vaihto vaikuttaa vain sinun näkymääsi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending != null) setCompetitionId(pending);
                setPending(null);
              }}
            >
              Vaihda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
