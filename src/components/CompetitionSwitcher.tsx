import { useTodayCompetitions } from "@/lib/competition-list";
import { useCompetitionId } from "@/lib/competition-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CompetitionSwitcher({ className }: { className?: string }) {
  const [competitionId, setCompetitionId] = useCompetitionId();
  const { list, loading } = useTodayCompetitions();

  // If current id is not in today's list, still show it as "Muu kisa"
  const inList = list.some((c) => c.Id === competitionId);

  return (
    <Select
      value={String(competitionId)}
      onValueChange={(v) => setCompetitionId(parseInt(v, 10))}
    >
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
  );
}
