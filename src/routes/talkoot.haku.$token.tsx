import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { helsinkiDateKey } from "@/lib/tuloslista";
import {
  fetchPublicCall,
  fetchPublicTasks,
  signUpForTask,
  taskTimeLabel,
  type PublicVolunteerCall,
  type PublicVolunteerTask,
} from "@/lib/volunteers";

export const Route = createFileRoute("/talkoot/haku/$token")({
  head: () => ({
    meta: [
      { title: "Talkoohaku – ilmoittaudu kilpailun järjestelytehtäviin" },
      {
        name: "description",
        content:
          "Ilmoittaudu kilpailun talkootehtäviin: aitaryhmä, kahvio, tekninen ryhmä ja muut järjestelytehtävät.",
      },
      { property: "og:title", content: "Talkoohaku – ilmoittaudu järjestelytehtäviin" },
      {
        property: "og:description",
        content: "Valitse sopiva talkoovuoro ja ilmoittaudu muutamalla klikkauksella.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VolunteerSignupPage,
});

function VolunteerSignupPage() {
  const { token } = Route.useParams();
  const { user } = useAuth();
  const [call, setCall] = useState<PublicVolunteerCall | null>(null);
  const [tasks, setTasks] = useState<PublicVolunteerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [c, t] = await Promise.all([fetchPublicCall(token), fetchPublicTasks(token)]);
        if (cancelled) return;
        setCall(c);
        setTasks(t);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lataus epäonnistui");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      full_name: f.full_name || ((user.user_metadata?.full_name as string) ?? ""),
      email: f.email || (user.email ?? ""),
    }));
  }, [user]);

  const submit = async (taskId: string) => {
    if (!form.full_name.trim()) {
      toast.error("Anna nimesi.");
      return;
    }
    try {
      await signUpForTask({
        token,
        task_id: taskId,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        note: null,
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, signed_count: t.signed_count + 1 } : t)),
      );
      setDone((s) => new Set(s).add(taskId));
      setOpenTask(null);
      toast.success("Kiitos, ilmoittautuminen tallennettu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ilmoittautuminen epäonnistui");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }

  if (!call) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <h1 className="text-lg font-bold">Talkoohakua ei löytynyt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Linkki voi olla vanhentunut. Pyydä järjestäjältä uusi linkki.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="text-xl font-bold">Talkoohaku</h1>
      <p className="mt-1 text-sm font-semibold">{call.competition_name}</p>
      <p className="text-xs text-muted-foreground">
        {call.competition_date ? helsinkiDateKey(call.competition_date) : ""}
      </p>
      {call.message && <p className="mt-2 text-sm">{call.message}</p>}
      {!call.is_open && (
        <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Talkoohaku ei ole tällä hetkellä auki.
        </p>
      )}

      <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Omat tiedot</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="vs-name">Nimi</Label>
            <Input
              id="vs-name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="vs-phone">Puhelin</Label>
            <Input
              id="vs-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="vs-email">Sähköposti</Label>
            <Input
              id="vs-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
      </div>

      <section className="mt-4 space-y-3">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">Talkootehtäviä ei ole vielä julkaistu.</p>
        )}
        {tasks.map((t) => {
          const free = Math.max(0, t.needed_count - t.signed_count);
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
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    free > 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {free > 0 ? `${free} vapaana` : "Täynnä"}
                </span>
              </div>

              {done.has(t.id) ? (
                <p className="mt-2 text-xs font-semibold text-emerald-600">
                  Olet ilmoittautunut tähän tehtävään.
                </p>
              ) : openTask === t.id ? (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => void submit(t.id)}>
                    Vahvista ilmoittautuminen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpenTask(null)}>
                    Peruuta
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-2"
                  size="sm"
                  variant={free > 0 ? "default" : "outline"}
                  disabled={!call.is_open}
                  onClick={() => setOpenTask(t.id)}
                >
                  {free > 0 ? "Ilmoittaudun" : "Ilmoittaudun varalle"}
                </Button>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
