import { useState } from "react";
import { useTodayCompetitions } from "@/lib/competition-list";
import { useCompetitionId } from "@/lib/competition-store";
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

export function CompetitionSwitcher({
  className,
  confirmOnChange = false,
}: {
  className?: string;
  confirmOnChange?: boolean;
}) {
  const [competitionId, setCompetitionId] = useCompetitionId();
  const { list, loading } = useTodayCompetitions();
  const [pending, setPending] = useState<number | null>(null);

  // If current id is not in today's list, still show it as "Muu kisa"
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
      <Select value={String(competitionId)} onValueChange={handleChange}>
        <SelectTrigger className={className} aria-label="Valitse kisa">
          <SelectValue placeholder={loading ? "Ladataan…" : "Valitse päivän kisa"} />
        </SelectTrigger>
        <SelectContent>
          {!inList && (
            <SelectItem value={String(competitionId)}>Kisa #{competitionId}</SelectItem>
          )}
          {list.length === 0 && !loading && (
            <SelectItem value="__none" disabled>
              Ei kisoja tänään
            </SelectItem>
          )}
          {list.map((c) => (
            <SelectItem key={c.Id} value={String(c.Id)}>
              {c.Name} · {c.Location}
            </SelectItem>
          ))}
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
