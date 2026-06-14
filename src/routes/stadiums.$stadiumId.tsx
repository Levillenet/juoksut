import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Building2, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { VENUE_KIND_LABEL, type VenueKind } from "@/lib/planner-types";

export const Route = createFileRoute("/stadiums/$stadiumId")({
  component: StadiumEditor,
});

type Tab = "basics" | "venues" | "conflicts";

interface Stadium {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  notes: string | null;
}
interface StadiumVenue {
  id: string;
  stadium_id: string;
  name: string;
  kind: VenueKind;
  notes: string | null;
  sort_order: number;
}
interface ConflictGroup {
  id: string;
  stadium_id: string;
  name: string;
  description: string | null;
  venue_ids: string[];
  max_concurrent: number;
}

const DEFAULT_STADIUM_VENUES: Array<{ name: string; kind: VenueKind }> = [
  { name: "Pituushyppy etusuoralla", kind: "jump_pit" },
  { name: "Pituushyppy takasuoralla", kind: "jump_pit" },
  { name: "Korkeushyppy", kind: "high_jump" },
  { name: "Seiväshyppy", kind: "pole_vault" },
  { name: "Kuularengas", kind: "shot_ring" },
  { name: "Moukarihäkki", kind: "throw_cage" },
  { name: "Keihäsvauhdinotto", kind: "throw_runway" },
  { name: "Juoksuradat etusuora", kind: "track_straight" },
  { name: "Juoksuradat ovaali", kind: "track_oval" },
];

function StadiumEditor() {
  const { stadiumId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("basics");

  const stadiumQ = useQuery({
    queryKey: ["stadium", stadiumId],
    queryFn: async (): Promise<Stadium> => {
      const { data, error } = await supabase
        .from("stadiums")
        .select("id, user_id, name, location, notes")
        .eq("id", stadiumId)
        .single();
      if (error) throw error;
      return data as Stadium;
    },
  });

  const venuesQ = useQuery({
    queryKey: ["stadium", stadiumId, "venues"],
    queryFn: async (): Promise<StadiumVenue[]> => {
      const { data, error } = await supabase
        .from("stadium_venues")
        .select("id, stadium_id, name, kind, notes, sort_order")
        .eq("stadium_id", stadiumId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as StadiumVenue[];
    },
  });

  const conflictsQ = useQuery({
    queryKey: ["stadium", stadiumId, "conflicts"],
    queryFn: async (): Promise<ConflictGroup[]> => {
      const { data, error } = await supabase
        .from("stadium_conflict_groups")
        .select("id, stadium_id, name, description, venue_ids, max_concurrent")
        .eq("stadium_id", stadiumId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ConflictGroup[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["stadium", stadiumId] });
  };

  if (stadiumQ.isLoading) {
    return <div className="px-4 py-6 text-sm text-muted-foreground">Ladataan…</div>;
  }
  if (stadiumQ.error || !stadiumQ.data) {
    return <div className="px-4 py-6 text-sm text-destructive">Ei löytynyt.</div>;
  }
  const stadium = stadiumQ.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/stadiums" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="truncate text-lg font-semibold">{stadium.name}</h1>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 border-t px-4 text-sm">
          {([
            ["basics", "Perustiedot"],
            ["venues", "Suorituspaikat"],
            ["conflicts", "Rajoitteet"],
          ] as Array<[Tab, string]>).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`border-b-2 px-3 py-2 ${
                tab === k
                  ? "border-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {tab === "basics" && (
          <BasicsTab stadium={stadium} onSaved={invalidate} onDeleted={() => navigate({ to: "/stadiums" })} />
        )}
        {tab === "venues" && (
          <VenuesTab
            stadiumId={stadiumId}
            venues={venuesQ.data ?? []}
            loading={venuesQ.isLoading}
            onChange={invalidate}
          />
        )}
        {tab === "conflicts" && (
          <ConflictsTab
            stadiumId={stadiumId}
            venues={venuesQ.data ?? []}
            conflicts={conflictsQ.data ?? []}
            onChange={invalidate}
          />
        )}
      </main>
    </div>
  );
}

function BasicsTab({
  stadium,
  onSaved,
  onDeleted,
}: {
  stadium: Stadium;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({
    name: stadium.name,
    location: stadium.location ?? "",
    notes: stadium.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("stadiums")
        .update({
          name: form.name.trim() || "Nimetön stadion",
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
        })
        .eq("id", stadium.id);
      if (error) throw error;
    },
    onSuccess: onSaved,
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stadiums").delete().eq("id", stadium.id);
      if (error) throw error;
    },
    onSuccess: onDeleted,
  });

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Nimi</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Sijainti</label>
        <Input
          placeholder="Esim. Lahti, Salpausselän urheilukeskus"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Muistiinpanot</label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          rows={4}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <div className="flex items-center justify-between">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="mr-2 h-4 w-4" />
          Tallenna
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm("Poistetaanko stadion ja kaikki sen suorituspaikat?")) del.mutate();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4 text-destructive" />
          Poista stadion
        </Button>
      </div>
    </section>
  );
}

function VenuesTab({
  stadiumId,
  venues,
  loading,
  onChange,
}: {
  stadiumId: string;
  venues: StadiumVenue[];
  loading: boolean;
  onChange: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const upsert = useMutation({
    mutationFn: async (payload: Partial<StadiumVenue> & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase
          .from("stadium_venues")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stadium_venues").insert({
          stadium_id: stadiumId,
          name: payload.name ?? "Uusi paikka",
          kind: payload.kind ?? "other",
          sort_order: payload.sort_order ?? venues.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: onChange,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stadium_venues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });

  const move = async (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= venues.length) return;
    const a = venues[idx];
    const b = venues[next];
    await Promise.all([
      supabase.from("stadium_venues").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("stadium_venues").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    onChange();
  };

  const seedDefaults = async () => {
    const base = venues.length;
    const rows = DEFAULT_STADIUM_VENUES.map((d, i) => ({
      stadium_id: stadiumId,
      name: d.name,
      kind: d.kind,
      sort_order: base + i,
    }));
    const { error } = await supabase.from("stadium_venues").insert(rows);
    if (error) alert(error.message);
    onChange();
  };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Suorituspaikat</h2>
        <div className="flex gap-2">
          {venues.length === 0 && (
            <Button variant="secondary" onClick={seedDefaults}>
              <Sparkles className="mr-2 h-4 w-4" />
              Luo oletukset
            </Button>
          )}
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Lisää suorituspaikka
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Ladataan…</p>}
      {!loading && venues.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Ei vielä suorituspaikkoja. Aloita "Luo oletukset" -napilla tai lisää käsin.
        </p>
      )}

      {venues.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Nimi</th>
              <th className="py-1 pr-2">Tyyppi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {venues.map((v, i) => (
              <tr key={v.id} className="border-t border-border/50">
                <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                <td className="py-1 pr-2">
                  <Input
                    value={v.name}
                    onChange={(e) =>
                      upsert.mutate({ id: v.id, name: e.target.value })
                    }
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    className="rounded border border-input bg-background px-2 py-1 text-xs"
                    value={v.kind}
                    onChange={(e) =>
                      upsert.mutate({ id: v.id, kind: e.target.value as VenueKind })
                    }
                  >
                    {(Object.entries(VENUE_KIND_LABEL) as Array<[VenueKind, string]>).map(
                      ([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </td>
                <td className="py-1 pr-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => move(i, 1)}
                    disabled={i === venues.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(v.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddVenueDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onAdd={(name, kind) => upsert.mutate({ name, kind, sort_order: venues.length })}
      />
    </section>
  );
}

function AddVenueDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (name: string, kind: VenueKind) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<VenueKind>("jump_pit");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uusi suorituspaikka</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nimi</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Esim. Pituushyppy etusuoralla"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tyyppi</label>
            <select
              className="w-full rounded border border-input bg-background px-2 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as VenueKind)}
            >
              {(Object.entries(VENUE_KIND_LABEL) as Array<[VenueKind, string]>).map(
                ([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Peruuta
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              onAdd(name.trim(), kind);
              setName("");
              setKind("jump_pit");
              onOpenChange(false);
            }}
          >
            Lisää
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConflictsTab({
  stadiumId,
  venues,
  conflicts,
  onChange,
}: {
  stadiumId: string;
  venues: StadiumVenue[];
  conflicts: ConflictGroup[];
  onChange: () => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ConflictGroup | null>(null);

  const save = useMutation({
    mutationFn: async (g: Partial<ConflictGroup> & { id?: string }) => {
      if (g.id) {
        const { error } = await supabase
          .from("stadium_conflict_groups")
          .update({
            name: g.name,
            description: g.description ?? null,
            venue_ids: g.venue_ids ?? [],
            max_concurrent: g.max_concurrent ?? 1,
          })
          .eq("id", g.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stadium_conflict_groups").insert({
          stadium_id: stadiumId,
          name: g.name ?? "Uusi rajoite",
          description: g.description ?? null,
          venue_ids: g.venue_ids ?? [],
          max_concurrent: g.max_concurrent ?? 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: onChange,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stadium_conflict_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });

  const seedDefaults = async () => {
    const find = (kw: string) =>
      venues.find((v) => v.name.toLowerCase().includes(kw.toLowerCase()))?.id;
    const moukari = find("moukari");
    const keihas = find("keih");
    const kiekko = find("kiekko");
    const groups: Array<Partial<ConflictGroup>> = [];
    if (moukari && keihas) {
      groups.push({
        name: "Heittosektori — moukari + keihäs",
        description:
          "Moukarinheitto ja keihäänheitto käyttävät samaa heittosektoria — eivät voi olla käynnissä yhtä aikaa.",
        venue_ids: [moukari, keihas],
        max_concurrent: 1,
      });
    }
    if (moukari && kiekko) {
      groups.push({
        name: "Heittokehät — moukari + kiekko samalla häkillä",
        description: "Moukari- ja kiekkokehä jakavat saman häkin.",
        venue_ids: [moukari, kiekko],
        max_concurrent: 1,
      });
    }
    if (groups.length === 0) {
      alert("Lisää ensin moukari/keihäs/kiekko suorituspaikkoihin.");
      return;
    }
    const { error } = await supabase.from("stadium_conflict_groups").insert(
      groups.map((g) => ({
        stadium_id: stadiumId,
        name: g.name!,
        description: g.description ?? null,
        venue_ids: g.venue_ids ?? [],
        max_concurrent: g.max_concurrent ?? 1,
      })),
    );
    if (error) alert(error.message);
    onChange();
  };

  const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? "(poistettu)";

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Rajoitteet</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={seedDefaults}>
            <Sparkles className="mr-2 h-4 w-4" />
            Luo oletusrajoitteet
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Lisää rajoite
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Rajoiteryhmä kertoo että tietyt suorituspaikat eivät voi olla käynnissä yhtä aikaa
        (esim. heittosektorin jakaminen). Plannerin integrointi tulee myöhemmin.
      </p>

      {conflicts.length === 0 && (
        <p className="text-sm text-muted-foreground">Ei vielä rajoiteryhmiä.</p>
      )}

      <ul className="space-y-2">
        {conflicts.map((g) => (
          <li key={g.id} className="rounded-lg border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{g.name}</div>
                {g.description && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{g.description}</div>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {g.venue_ids.map((id) => (
                    <span
                      key={id}
                      className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                    >
                      {venueName(id)}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Max samanaikaisia: {g.max_concurrent}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(g);
                    setEditorOpen(true);
                  }}
                >
                  Muokkaa
                </Button>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(g.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <ConflictEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        venues={venues}
        initial={editing}
        onSave={(g) => save.mutate(g)}
      />
    </section>
  );
}

function ConflictEditorDialog({
  open,
  onOpenChange,
  venues,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  venues: StadiumVenue[];
  initial: ConflictGroup | null;
  onSave: (g: Partial<ConflictGroup> & { id?: string }) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    venue_ids: new Set(initial?.venue_ids ?? []),
    max_concurrent: initial?.max_concurrent ?? 1,
  });

  // Reset when open/initial changes
  const key = `${open}-${initial?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setForm({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      venue_ids: new Set(initial?.venue_ids ?? []),
      max_concurrent: initial?.max_concurrent ?? 1,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Muokkaa rajoitetta" : "Uusi rajoite"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nimi</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Selitys</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Suorituspaikat</label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
              {venues.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Lisää ensin suorituspaikkoja Suorituspaikat-välilehdellä.
                </p>
              )}
              {venues.map((v) => {
                const checked = form.venue_ids.has(v.id);
                return (
                  <label key={v.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(form.venue_ids);
                        if (e.target.checked) next.add(v.id);
                        else next.delete(v.id);
                        setForm({ ...form, venue_ids: next });
                      }}
                    />
                    {v.name}
                    <span className="text-[10px] text-muted-foreground">
                      ({VENUE_KIND_LABEL[v.kind] ?? v.kind})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Max samanaikaisia paikkoja
            </label>
            <Input
              type="number"
              min={1}
              value={form.max_concurrent}
              onChange={(e) =>
                setForm({ ...form, max_concurrent: Math.max(1, parseInt(e.target.value) || 1) })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Peruuta
          </Button>
          <Button
            onClick={() => {
              if (!form.name.trim()) return;
              onSave({
                id: initial?.id,
                name: form.name.trim(),
                description: form.description.trim() || null,
                venue_ids: Array.from(form.venue_ids),
                max_concurrent: form.max_concurrent,
              });
              onOpenChange(false);
            }}
          >
            Tallenna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
