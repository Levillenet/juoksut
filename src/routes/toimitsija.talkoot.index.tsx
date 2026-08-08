import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useCompetitionsWindow } from "@/lib/competition-list";
import { helsinkiDateKey } from "@/lib/tuloslista";
import {
  fetchMyVolunteerSignups,
  fetchOpenVolunteerCalls,
  fetchVolunteerTasks,
  taskTimeLabel,
  type VolunteerCall,
  type VolunteerSignup,
  type VolunteerTask,
} from "@/lib/volunteers";

export const Route = createFileRoute("/toimitsija/talkoot/")({
  component: VolunteerHome,
});

function VolunteerHome() {
  const { user, isAdmin, isOfficial } = useAuth();
  const canOrganize = isAdmin || isOfficial;
  const { list: upcoming } = useCompetitionsWindow(1, 60);

  const [calls, setCalls] = useState<VolunteerCall[]>([]);
  const [mine, setMine] = useState<VolunteerSignup[]>([]);
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const c = await fetchOpenVolunteerCalls();
        if (cancelled) return;
        setCalls(c);
        if (user?.id) {
          const my = await fetchMyVolunteerSignups(user.id);
          if (cancelled) return;
          setMine(my);
          const compIds = Array.from(new Set(my.map((s) => s.competition_id)));
          const lists = await Promise.all(compIds.map((id) => fetchVolunteerTasks(id)));
          if (cancelled) return;
          setTasks(lists.flat());
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lataus epäonnistui");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const callByComp = useMemo(
    () => new Map(calls.map((c) => [c.competition_id, c])),
    [calls],
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <Link
        to="/toimitsija"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Kilpailun järjestelyt
      </Link>
      <h1 className="text-xl font-bold">Talkoo- ja järjestelytehtävät</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Aitaryhmä, kahvio, tekninen ryhmä ja muut kilpailun käytännön järjestelyt. Nämä tehtävät
        ovat erillään lajitoimitsijoista.
      </p>

      <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Omat talkoovuorot</h2>
        {loading ? (
          <p className="mt-1 text-sm text-muted-foreground">Ladataan…</p>
        ) : mine.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Sinulla ei ole talkoovuoroja. Ilmoittaudu järjestäjän jakamasta linkistä.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {mine.map((s) => {
              const t = taskById.get(s.task_id);
              const c = callByComp.get(s.competition_id);
              return (
                <li key={s.id} className="py-2">
                  <p className="text-sm font-semibold">{t?.name ?? "Talkootehtävä"}</p>
                  <p className="text-xs text-muted-foreground">
                    {c?.competition_name ?? `Kilpailu ${s.competition_id}`}
                    {t ? ` · ${taskTimeLabel(t)}` : ""}
                    {t?.location ? ` · ${t.location}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Avoimet talkoohaut</h2>
        {calls.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Avoimia talkoohakuja ei ole nyt.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {calls.map((c) => (
              <li key={c.id} className="py-2">
                <a
                  href={`/talkoot/haku/${c.share_token}`}
                  className="flex items-center justify-between gap-3 hover:opacity-80"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {c.competition_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.competition_date ? helsinkiDateKey(c.competition_date) : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-primary">Ilmoittaudu</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canOrganize && (
        <section className="mt-4 rounded-xl border-2 border-primary/30 bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">Järjestäjä: talkooryhmien hallinta</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valitse kilpailu ja kokoa talkooryhmät.
          </p>
          <ul className="mt-2 divide-y divide-border">
            {upcoming.slice(0, 30).map((c) => (
              <li key={c.Id} className="py-2">
                <Link
                  to="/toimitsija/talkoot/$competitionId"
                  params={{ competitionId: String(c.Id) }}
                  className="flex items-center justify-between gap-3 hover:opacity-80"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{c.Name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {helsinkiDateKey(c.Date)} · {c.Location}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-primary">Avaa</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
