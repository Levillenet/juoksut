import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useCompetitionsWindow } from "@/lib/competition-list";
import { helsinkiDateKey } from "@/lib/tuloslista";
import {
  OfficialAthletePicker,
  type PickedAthlete,
} from "@/components/officials/OfficialAthletePicker";
import {
  addChild,
  fetchCalls,
  fetchMyAvailability,
  fetchMyChildren,
  fetchMyProfile,
  removeChild,
  saveMyProfile,
  setAvailability,
  setChildGuardian,
  type OfficialCall,
  type OfficialChild,
  type OfficialProfile,
} from "@/lib/officials";

export const Route = createFileRoute("/toimitsija/")({
  component: OfficialHome,
});

function OfficialHome() {
  const { user, isAdmin, isOfficial } = useAuth();
  const userId = user?.id ?? "";
  const [profile, setProfile] = useState<OfficialProfile | null>(null);
  const [children, setChildren] = useState<OfficialChild[]>([]);
  const [calls, setCalls] = useState<OfficialCall[]>([]);
  const [availability, setAvail] = useState<Record<number, { available: boolean; note: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guardianDefault, setGuardianDefault] = useState(true);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    club: "",
    skills: "",
    notes: "",
    can_lead: false,
    lead_events: [] as string[],
  });

  const canOrganize = isAdmin || isOfficial;
  const { list: upcoming } = useCompetitionsWindow(1, 60);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [p, c, a] = await Promise.all([
          fetchMyProfile(userId),
          Promise.resolve(null),
          fetchMyAvailability(userId),
        ]);
        void c;
        if (cancelled) return;
        setProfile(p);
        if (p) {
          setForm({
            full_name: p.full_name,
            email: p.email,
            phone: p.phone ?? "",
            club: p.club ?? "",
            skills: p.skills ?? "",
            notes: p.notes ?? "",
            can_lead: p.can_lead ?? false,
            lead_events: p.lead_events ?? [],
          });
          setChildren(await fetchMyChildren(p.id));
        } else {
          setForm((f) => ({
            ...f,
            email: user?.email ?? "",
            full_name: (user?.user_metadata?.full_name as string) ?? "",
          }));
        }
        const map: Record<number, { available: boolean; note: string }> = {};
        for (const row of a) {
          map[row.competition_id] = {
            available: row.available,
            note: row.constraint_note ?? "",
          };
        }
        setAvail(map);
        setCalls(await fetchCalls());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lataus epäonnistui");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, user]);

  const existingKeys = useMemo(
    () => new Set(children.map((c) => c.athlete_key)),
    [children],
  );

  const saveProfile = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Nimi ja sähköposti ovat pakollisia.");
      return;
    }
    setSaving(true);
    try {
      const p = await saveMyProfile(userId, {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        club: form.club.trim() || null,
        skills: form.skills.trim() || null,
        notes: form.notes.trim() || null,
        can_lead: form.can_lead,
        lead_events: form.can_lead ? form.lead_events : [],
      });
      setProfile(p);
      toast.success("Toimitsijaprofiili tallennettu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tallennus epäonnistui");
    } finally {
      setSaving(false);
    }
  };

  const pickAthlete = async (a: PickedAthlete) => {
    if (!profile) {
      toast.error("Tallenna ensin toimitsijaprofiili.");
      return;
    }
    try {
      await addChild(profile.id, userId, a, guardianDefault);
      setChildren(await fetchMyChildren(profile.id));
      toast.success(`${a.surname} ${a.firstname} kiinnitetty.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kiinnitys epäonnistui");
    }
  };

  const toggleAvailability = async (competitionId: number, next: boolean) => {
    const note = availability[competitionId]?.note ?? "";
    setAvail((m) => ({ ...m, [competitionId]: { available: next, note } }));
    try {
      await setAvailability(userId, competitionId, next, note || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tallennus epäonnistui");
    }
  };

  const saveNote = async (competitionId: number, note: string) => {
    const available = availability[competitionId]?.available ?? false;
    setAvail((m) => ({ ...m, [competitionId]: { available, note } }));
    try {
      await setAvailability(userId, competitionId, available, note || null);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> Etusivulle
      </Link>
      <h1 className="text-xl font-bold">Toimitsijat</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kenttälajien toimitsijat. Juoksulajit hoidetaan omassa prosessissaan.
      </p>

      <section className="mt-5 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Oma toimitsijaprofiili</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="full_name">Nimi</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">Sähköposti</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone">Puhelin</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="club">Seura</Label>
            <Input
              id="club"
              value={form.club}
              onChange={(e) => setForm({ ...form, club: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="skills">Osaaminen</Label>
            <Input
              id="skills"
              placeholder="esim. kuulan mittaus, tuloskirjuri"
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Lisätiedot</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <Button className="mt-3" onClick={() => void saveProfile()} disabled={saving}>
          {saving ? "Tallennetaan…" : "Tallenna profiili"}
        </Button>
      </section>

      <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Omat urheilijat</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Kiinnitä urheilijat, joiden lajeihin sinut ensisijaisesti ehdotetaan toimitsijaksi.
          Sama urheilija voi olla kiinnitettynä usealle aikuiselle.
        </p>
        {!profile && (
          <p className="mt-2 text-sm text-muted-foreground">
            Tallenna ensin profiili, niin voit kiinnittää urheilijoita.
          </p>
        )}
        {profile && (
          <>
            <div className="mt-3 flex items-center gap-2">
              <Switch
                id="guardian-default"
                checked={guardianDefault}
                onCheckedChange={setGuardianDefault}
              />
              <Label htmlFor="guardian-default" className="text-sm">
                Olen huoltaja (kiinnitetään uusiin urheilijoihin)
              </Label>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {children.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {c.surname} {c.firstname}
                    </p>
                    {c.organization && (
                      <p className="truncate text-xs text-muted-foreground">{c.organization}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={c.is_guardian}
                      aria-label="Olen huoltaja"
                      onCheckedChange={(v) => {
                        setChildren((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, is_guardian: v } : x)),
                        );
                        void setChildGuardian(c.id, v);
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Huoltaja</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Poista kiinnitys"
                      onClick={() => {
                        void (async () => {
                          await removeChild(c.id);
                          setChildren((prev) => prev.filter((x) => x.id !== c.id));
                        })();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <OfficialAthletePicker onPick={(a) => void pickAthlete(a)} existingKeys={existingKeys} />
            </div>
          </>
        )}
      </section>

      <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Käytettävissä kisoihin</h2>
        {calls.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Avoimia toimitsijahakuja ei ole juuri nyt.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {calls.map((c) => {
              const st = availability[c.competition_id];
              return (
                <li key={c.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.competition_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.competition_date ? helsinkiDateKey(c.competition_date) : ""}
                        {c.open_until ? ` · vastaa viimeistään ${c.open_until}` : ""}
                      </p>
                      {c.message && <p className="mt-1 text-xs">{c.message}</p>}
                      <div className="mt-1 flex flex-wrap gap-3">
                        <Link
                          to="/toimitsija/haku/$competitionId"
                          params={{ competitionId: String(c.competition_id) }}
                          className="text-xs text-primary hover:underline"
                        >
                          Ilmoittaudu lajeihin
                        </Link>
                        <Link
                          to="/toimitsija/aikataulu/$competitionId"
                          params={{ competitionId: String(c.competition_id) }}
                          className="text-xs text-primary hover:underline"
                        >
                          Oma aikataulu
                        </Link>
                      </div>

                    </div>
                    <Switch
                      checked={st?.available ?? false}
                      aria-label="Olen käytettävissä"
                      onCheckedChange={(v) => void toggleAvailability(c.competition_id, v)}
                    />
                  </div>
                  {st?.available && (
                    <Input
                      className="mt-2"
                      placeholder="Rajoite, esim. vain lauantaina"
                      value={st.note}
                      onChange={(e) =>
                        setAvail((m) => ({
                          ...m,
                          [c.competition_id]: { available: true, note: e.target.value },
                        }))
                      }
                      onBlur={(e) => void saveNote(c.competition_id, e.target.value)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canOrganize && (
        <section className="mt-4 rounded-xl border-2 border-primary/30 bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">Järjestelytoimikunta</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valitse kilpailu ja rakenna kenttälajien toimitsijaluettelo.
          </p>
          <ul className="mt-2 divide-y divide-border">
            {upcoming.slice(0, 30).map((c) => (
              <li key={c.Id} className="py-2">
                <Link
                  to="/toimitsija/kisa/$competitionId"
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
