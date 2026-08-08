import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  fetchVolunteerCall,
  fetchVolunteerSignups,
  fetchVolunteerTasks,
  taskTimeLabel,
  type VolunteerSignup,
  type VolunteerTask,
} from "@/lib/volunteers";

export const Route = createFileRoute("/toimitsija/talkoot/tulosta/$competitionId")({
  component: VolunteerPrintList,
});

function VolunteerPrintList() {
  const { competitionId } = Route.useParams();
  const compId = Number(competitionId);
  const [name, setName] = useState("");
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [signups, setSignups] = useState<VolunteerSignup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [c, t, s] = await Promise.all([
          fetchVolunteerCall(compId),
          fetchVolunteerTasks(compId),
          fetchVolunteerSignups(compId),
        ]);
        if (cancelled) return;
        setName(c?.competition_name ?? `Kilpailu ${compId}`);
        setTasks(t);
        setSignups(s);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lataus epäonnistui");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compId]);

  const byTask = useMemo(() => {
    const m = new Map<string, VolunteerSignup[]>();
    for (const s of signups) {
      const arr = m.get(s.task_id) ?? [];
      arr.push(s);
      m.set(s.task_id, arr);
    }
    return m;
  }, [signups]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <div className="print:hidden">
        <Link
          to="/toimitsija/talkoot/$competitionId"
          params={{ competitionId: String(compId) }}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Takaisin talkootehtäviin
        </Link>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Talkoolista</h1>
          <p className="text-sm text-muted-foreground">{name}</p>
        </div>
        <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" /> Tulosta
        </Button>
      </div>

      {loading && <p className="mt-4 text-sm text-muted-foreground">Ladataan…</p>}

      <div className="mt-4 space-y-4">
        {tasks.map((t) => {
          const people = byTask.get(t.id) ?? [];
          return (
            <div key={t.id} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {taskTimeLabel(t)}
                {t.location ? ` · ${t.location}` : ""}
                {t.contact_name ? ` · Vastuu: ${t.contact_name}` : ""}
                {t.contact_phone ? ` (${t.contact_phone})` : ""}
              </p>
              <ul className="mt-2 space-y-0.5 text-sm">
                {people.map((p) => (
                  <li key={p.id}>
                    {p.full_name}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </li>
                ))}
                {Array.from({ length: Math.max(0, t.needed_count - people.length) }).map(
                  (_, i) => (
                    <li key={`empty-${i}`} className="text-muted-foreground">
                      ______________________
                    </li>
                  ),
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
