import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Plus, Printer, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCompetitionsWindow } from "@/lib/competition-list";
import { helsinkiDateKey } from "@/lib/tuloslista";
import { VOLUNTEER_TEMPLATES } from "@/lib/volunteer-templates";
import {
  addVolunteerManually,
  createVolunteerTask,
  deleteVolunteerTask,
  fetchVolunteerCall,
  fetchVolunteerSignups,
  fetchVolunteerTasks,
  openVolunteerCall,
  removeVolunteerSignup,
  taskTimeLabel,
  updateVolunteerTask,
  type VolunteerCall,
  type VolunteerSignup,
  type VolunteerTask,
} from "@/lib/volunteers";
import { OrganizerTabs } from "@/components/volunteers/OrganizerTabs";

export const Route = createFileRoute("/toimitsija/talkoot/$competitionId")({
  component: VolunteerOrganizer,
});

const emptyForm = {
  name: "",
  description: "",
  day: "",
  start_time: "",
  end_time: "",
  location: "",
  needed_count: 2,
  contact_name: "",
  contact_phone: "",
};

function VolunteerOrganizer() {
  const { competitionId } = Route.useParams();
  const compId = Number(competitionId);
  const { user, isAdmin, isOfficial, isOrganizer } = useAuth();
  const canManage = isOrganizer;

  const { list } = useCompetitionsWindow(30, 365);
  const competition = useMemo(
    () => list.find((c) => c.Id === compId) ?? null,
    [list, compId],
  );

  const [tplCounts, setTplCounts] = useState<Record<string, number>>({});
  const [call, setCall] = useState<VolunteerCall | null>(null);
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [signups, setSignups] = useState<VolunteerSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);
  const [manual, setManual] = useState<Record<string, { name: string; phone: string }>>({});

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
        setCall(c);
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

  const totals = useMemo(() => {
    let needed = 0;
    let filled = 0;
    let short = 0;
    for (const t of tasks) {
      const n = byTask.get(t.id)?.length ?? 0;
      needed += t.needed_count;
      filled += n;
      if (n < t.needed_count) short += 1;
    }
    return { needed, filled, short };
  }, [tasks, byTask]);

  const openCall = async () => {
    try {
      const c = await openVolunteerCall({
        competition_id: compId,
        competition_name: competition?.Name ?? `Kilpailu ${compId}`,
        competition_date: competition?.Date ?? null,
        open_from: null,
        open_until: null,
        message: null,
        opened_by: user?.id ?? null,
      });
      setCall(c);
      toast.success("Talkoohaku avattu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Avaus epäonnistui");
    }
  };

  const shareUrl = call
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/talkoot/haku/${call.share_token}`
    : "";

  const addTask = async (preset?: { name: string; description: string; needed_count: number }) => {
    const values = preset
      ? { ...emptyForm, ...preset }
      : form;
    if (!values.name.trim()) {
      toast.error("Anna tehtävän nimi.");
      return;
    }
    try {
      const t = await createVolunteerTask({
        competition_id: compId,
        name: values.name.trim(),
        description: values.description.trim() || null,
        day: values.day || null,
        start_time: values.start_time || null,
        end_time: values.end_time || null,
        location: values.location.trim() || null,
        needed_count: Number(values.needed_count) || 1,
        contact_name: values.contact_name.trim() || null,
        contact_phone: values.contact_phone.trim() || null,
        created_by: user?.id ?? null,
      });
      setTasks((prev) => [...prev, t]);
      if (!preset) {
        setForm({ ...emptyForm });
        setShowForm(false);
      }
      toast.success(`${t.name} lisätty.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lisäys epäonnistui");
    }
  };

  const changeNeeded = async (id: string, needed: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, needed_count: needed } : t)));
    try {
      await updateVolunteerTask(id, { needed_count: needed });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Päivitys epäonnistui");
    }
  };

  const removeTask = async (id: string) => {
    try {
      await deleteVolunteerTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setSignups((prev) => prev.filter((s) => s.task_id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Poisto epäonnistui");
    }
  };

  const addManual = async (taskId: string) => {
    const v = manual[taskId];
    if (!v?.name.trim()) {
      toast.error("Anna talkoolaisen nimi.");
      return;
    }
    try {
      const s = await addVolunteerManually({
        task_id: taskId,
        competition_id: compId,
        full_name: v.name.trim(),
        phone: v.phone.trim() || null,
        note: null,
      });
      setSignups((prev) => [...prev, s]);
      setManual((m) => ({ ...m, [taskId]: { name: "", phone: "" } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lisäys epäonnistui");
    }
  };

  const dropSignup = async (id: string) => {
    try {
      await removeVolunteerSignup(id);
      setSignups((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Poisto epäonnistui");
    }
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 text-sm text-muted-foreground">
        Talkootehtävien hallinta on järjestäjien käytössä.
      </div>
    );
  }

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
        {competition?.Name ?? `Kilpailu ${compId}`}
        {competition ? ` · ${helsinkiDateKey(competition.Date)}` : ""}
      </p>
      <OrganizerTabs competitionId={compId} active="talkoot" />

      <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Talkoohaku</h2>
            <p className="text-xs text-muted-foreground">
              Jaettava linkki toimii ilman kirjautumista.
            </p>
          </div>
          {call ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl);
                  toast.success("Linkki kopioitu.");
                }}
              >
                <Copy className="mr-1 h-4 w-4" /> Kopioi linkki
              </Button>
              <Link
                to="/toimitsija/talkoot/tulosta/$competitionId"
                params={{ competitionId: String(compId) }}
              >
                <Button size="sm" variant="outline">
                  <Printer className="mr-1 h-4 w-4" /> Tulosta
                </Button>
              </Link>
            </div>
          ) : (
            <Button size="sm" onClick={() => void openCall()}>
              Avaa talkoohaku
            </Button>
          )}
        </div>
        {call && (
          <p className="mt-2 break-all rounded-md bg-muted/40 p-2 text-xs">{shareUrl}</p>
        )}
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border bg-card p-2">
          <p className="text-lg font-bold">{totals.needed}</p>
          <p className="text-[11px] text-muted-foreground">Talkoopaikkoja</p>
        </div>
        <div className="rounded-lg border bg-card p-2">
          <p className="text-lg font-bold">{totals.filled}</p>
          <p className="text-[11px] text-muted-foreground">Ilmoittautuneita</p>
        </div>
        <div className="rounded-lg border bg-card p-2">
          <p className={`text-lg font-bold ${totals.short > 0 ? "text-destructive" : ""}`}>
            {totals.short}
          </p>
          <p className="text-[11px] text-muted-foreground">Ryhmiä vajaana</p>
        </div>
      </section>

      <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Lisää talkooryhmä</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Valitse pohja ja aseta tarvittava minimimäärä henkilöitä.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {VOLUNTEER_TEMPLATES.map((tpl) => (
            <div
              key={tpl.name}
              className="flex items-center gap-1 rounded-md border bg-background p-1"
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void addTask({
                    ...tpl,
                    needed_count: tplCounts[tpl.name] ?? tpl.needed_count,
                  })
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> {tpl.name}
              </Button>
              <Input
                type="number"
                min={1}
                aria-label={`${tpl.name}: minimimäärä`}
                className="h-8 w-14 text-center"
                value={tplCounts[tpl.name] ?? tpl.needed_count}
                onChange={(e) =>
                  setTplCounts((prev) => ({
                    ...prev,
                    [tpl.name]: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
              />
            </div>
          ))}
        </div>
        <Button
          className="mt-3"
          size="sm"
          variant="ghost"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Sulje oma tehtävä" : "Luo oma tehtävä"}
        </Button>
        {showForm && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="v-name">Tehtävän nimi</Label>
              <Input
                id="v-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="v-desc">Kuvaus</Label>
              <Textarea
                id="v-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="v-day">Päivä</Label>
              <Input
                id="v-day"
                type="date"
                value={form.day}
                onChange={(e) => setForm({ ...form, day: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="v-count">Tarvittava määrä</Label>
              <Input
                id="v-count"
                type="number"
                min={1}
                value={form.needed_count}
                onChange={(e) => setForm({ ...form, needed_count: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="v-start">Alkaa</Label>
              <Input
                id="v-start"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="v-end">Päättyy</Label>
              <Input
                id="v-end"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="v-loc">Kokoontumispaikka</Label>
              <Input
                id="v-loc"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="v-contact">Vastuuhenkilö</Label>
              <Input
                id="v-contact"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="v-phone">Vastuuhenkilön puhelin</Label>
              <Input
                id="v-phone"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={() => void addTask()}>Tallenna tehtävä</Button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Ladataan…</p>}
        {!loading && tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ei vielä talkootehtäviä. Lisää ryhmä yllä olevista pohjista.
          </p>
        )}
        {tasks.map((t) => {
          const people = byTask.get(t.id) ?? [];
          const missing = t.needed_count - people.length;
          return (
            <div key={t.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {taskTimeLabel(t)}
                    {t.location ? ` · ${t.location}` : ""}
                  </p>
                  {t.description && <p className="mt-1 text-xs">{t.description}</p>}
                  {t.contact_name && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vastuu: {t.contact_name}
                      {t.contact_phone ? ` · ${t.contact_phone}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      missing > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-emerald-500/10 text-emerald-600"
                    }`}
                  >
                    {people.length}/{t.needed_count}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    aria-label="Minimimäärä"
                    className="h-8 w-14 text-center"
                    value={t.needed_count}
                    onChange={(e) =>
                      void changeNeeded(t.id, Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Poista tehtävä"
                    onClick={() => void removeTask(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {people.length > 0 && (
                <ul className="mt-2 divide-y divide-border">
                  {people.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {p.full_name}
                        {p.phone ? (
                          <span className="text-muted-foreground"> · {p.phone}</span>
                        ) : null}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Poista ilmoittautuminen"
                        onClick={() => void dropSignup(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  className="h-8 w-36"
                  placeholder="Nimi"
                  value={manual[t.id]?.name ?? ""}
                  onChange={(e) =>
                    setManual((m) => ({
                      ...m,
                      [t.id]: { name: e.target.value, phone: m[t.id]?.phone ?? "" },
                    }))
                  }
                />
                <Input
                  className="h-8 w-32"
                  placeholder="Puhelin"
                  value={manual[t.id]?.phone ?? ""}
                  onChange={(e) =>
                    setManual((m) => ({
                      ...m,
                      [t.id]: { name: m[t.id]?.name ?? "", phone: e.target.value },
                    }))
                  }
                />
                <Button size="sm" variant="outline" onClick={() => void addManual(t.id)}>
                  <UserPlus className="mr-1 h-3.5 w-3.5" /> Lisää
                </Button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
