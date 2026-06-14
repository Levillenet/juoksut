import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import { ArrowLeft, Trash2, Plus, Wand2, Save, Download, LayoutGrid, Sparkles } from "lucide-react";
import * as XLSX from "xlsx";
import { downloadPlannerSchedulePdf } from "@/lib/planner-schedule-pdf";

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
import {
  VENUE_KIND_LABEL,
  resolveDayWindows,
  type PlanRow,
  type VenueRow,
  type PlanEventRow,
  type ScheduleItemRow,
  type CatalogEntry,
  type VenueKind,
  type FinalFormat,
  type DayWindow,
} from "@/lib/planner-types";
import { estimateDuration } from "@/lib/planner-estimate";
import { solve, detectConflicts } from "@/lib/planner-solver";
import { resolveTimings } from "@/lib/planner-timings";
import { DEFAULT_VENUES, buildDefaultVenueRows } from "@/lib/planner-defaults";
import { fillPlanWithDemo } from "@/lib/planner-demo";

export const Route = createFileRoute("/planner/$planId")({
  component: PlanEditor,
});

type Tab = "basics" | "venues" | "events" | "schedule";

function fmtDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDateTimeInput(s: string): string {
  return new Date(s).toISOString();
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function PlanEditor() {
  const { planId } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("basics");

  const planQ = useQuery({
    queryKey: ["planner", "plan", planId],
    queryFn: async (): Promise<PlanRow> => {
      const { data, error } = await supabase
        .from("competition_plans")
        .select("*")
        .eq("id", planId)
        .single();
      if (error) throw error;
      return data as unknown as PlanRow;
    },
  });
  const venuesQ = useQuery({
    queryKey: ["planner", "venues", planId],
    queryFn: async (): Promise<VenueRow[]> => {
      const { data, error } = await supabase
        .from("plan_venues")
        .select("*")
        .eq("plan_id", planId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as VenueRow[];
    },
  });
  const eventsQ = useQuery({
    queryKey: ["planner", "events", planId],
    queryFn: async (): Promise<PlanEventRow[]> => {
      const { data, error } = await supabase
        .from("plan_events")
        .select("*")
        .eq("plan_id", planId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as PlanEventRow[];
    },
  });
  const scheduleQ = useQuery({
    queryKey: ["planner", "schedule", planId],
    queryFn: async (): Promise<ScheduleItemRow[]> => {
      const { data, error } = await supabase
        .from("plan_schedule_items")
        .select("*")
        .eq("plan_id", planId)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as ScheduleItemRow[];
    },
  });
  const catalogQ = useQuery({
    queryKey: ["planner", "catalog-full"],
    queryFn: async (): Promise<CatalogEntry[]> => {
      const { data, error } = await supabase.rpc("get_event_catalog_full");
      if (error) throw error;
      return (data ?? []) as CatalogEntry[];
    },
    staleTime: 60 * 60 * 1000,
  });

  const invalidate = (k: string) => qc.invalidateQueries({ queryKey: ["planner", k, planId] });
  const invalidateAll = () => {
    invalidate("plan");
    invalidate("venues");
    invalidate("events");
    invalidate("schedule");
  };

  if (planQ.isLoading) return <div className="p-8 text-sm">Ladataan…</div>;
  if (!planQ.data) return <div className="p-8 text-sm">Suunnitelmaa ei löydy.</div>;
  const plan = planQ.data;
  const venues = venuesQ.data ?? [];
  const events = eventsQ.data ?? [];
  const schedule = scheduleQ.data ?? [];
  const catalog = catalogQ.data ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/planner" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="flex-1 truncate text-lg font-semibold">{plan.name}</h1>
          <div className="flex shrink-0 gap-0.5 rounded-full border border-border bg-card p-0.5 text-[11px] font-medium">
            {(["basics", "venues", "events", "schedule"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t === "basics"
                  ? "Perustiedot"
                  : t === "venues"
                    ? "Suorituspaikat"
                    : t === "events"
                      ? "Lajit"
                      : "Aikataulu"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {tab === "basics" && (
          <BasicsTab plan={plan} onChange={() => invalidate("plan")} onDemoFilled={invalidateAll} />
        )}
        {tab === "venues" && (
          <VenuesTab planId={planId} venues={venues} onChange={() => invalidate("venues")} />
        )}
        {tab === "events" && (
          <EventsTab
            plan={plan}
            planId={planId}
            events={events}
            venues={venues}
            catalog={catalog}
            onChange={() => invalidate("events")}
          />
        )}
        {tab === "schedule" && (
          <ScheduleTab
            plan={plan}
            venues={venues}
            events={events}
            schedule={schedule}
            onChange={() => {
              invalidate("schedule");
              invalidate("events");
            }}
          />
        )}
      </main>
    </div>
  );
}

// ─── Perustiedot ─────────────────────────────────────────────────────────
function BasicsTab({
  plan,
  onChange,
  onDemoFilled,
}: {
  plan: PlanRow;
  onChange: () => void;
  onDemoFilled: () => void;
}) {
  const [form, setForm] = useState({
    name: plan.name,
    starts: fmtDateTimeInput(plan.starts_at),
    ends: fmtDateTimeInput(plan.ends_at),
    recovery: plan.default_recovery_min,
    setupField: plan.default_setup_field_min,
    setupVertical: plan.default_setup_vertical_min,
    betweenHeats: plan.default_between_heats_min,
    hurdleSetup: plan.default_hurdle_setup_min,
    hurdleTeardown: plan.default_hurdle_teardown_min,
    isMultiDay: plan.is_multi_day,
    dayWindows: (plan.day_windows ?? []) as DayWindow[],
    notes: plan.notes ?? "",
  });
  const [demoBusy, setDemoBusy] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("competition_plans")
        .update({
          name: form.name,
          starts_at: fromDateTimeInput(form.starts),
          ends_at: fromDateTimeInput(form.ends),
          default_recovery_min: form.recovery,
          default_setup_field_min: form.setupField,
          default_setup_vertical_min: form.setupVertical,
          default_between_heats_min: form.betweenHeats,
          default_hurdle_setup_min: form.hurdleSetup,
          default_hurdle_teardown_min: form.hurdleTeardown,
          is_multi_day: form.isMultiDay,
          day_windows: form.isMultiDay ? (form.dayWindows as unknown as never) : null,
          notes: form.notes,
        })
        .eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });

  const addDay = () => {
    const last = form.dayWindows[form.dayWindows.length - 1];
    let nextDate = fmtDate(form.starts);
    if (last) {
      const d = new Date(last.date);
      d.setDate(d.getDate() + 1);
      nextDate = fmtDate(d.toISOString());
    }
    setForm({
      ...form,
      dayWindows: [...form.dayWindows, { date: nextDate, start: "09:00", end: "17:00" }],
    });
  };

  const runDemo = async () => {
    if (
      !confirm(
        "Tämä korvaa nykyiset suorituspaikat, lajit ja aikataulun YU-kentän oletuspaikoilla ja demolajeilla. Jatketaanko?",
      )
    )
      return;
    setDemoBusy(true);
    try {
      await fillPlanWithDemo({ planId: plan.id });
      onDemoFilled();
    } finally {
      setDemoBusy(false);
    }
  };

  const numField = (key: keyof typeof form, label: string, hint?: string) => (
    <Field label={label}>
      <Input
        type="number"
        value={form[key] as number}
        onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })}
      />
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </Field>
  );

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Perustiedot</h2>
        <Button variant="outline" size="sm" onClick={runDemo} disabled={demoBusy}>
          <Sparkles className="mr-2 h-4 w-4" />
          {demoBusy ? "Täytetään…" : "Täytä demokilpailulla"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nimi">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Palautusaika ennen finaalia (min)">
          <Input
            type="number"
            value={form.recovery}
            onChange={(e) => setForm({ ...form, recovery: parseInt(e.target.value) || 0 })}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isMultiDay}
          onChange={(e) => {
            const v = e.target.checked;
            setForm({
              ...form,
              isMultiDay: v,
              dayWindows:
                v && form.dayWindows.length === 0
                  ? [{ date: fmtDate(form.starts), start: "09:00", end: "17:00" }]
                  : form.dayWindows,
            });
          }}
        />
        <span className="font-medium">Monipäiväinen tapahtuma</span>
      </label>

      {!form.isMultiDay && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Alkamisaika">
            <Input
              type="datetime-local"
              value={form.starts}
              onChange={(e) => setForm({ ...form, starts: e.target.value })}
            />
          </Field>
          <Field label="Päättymisaika">
            <Input
              type="datetime-local"
              value={form.ends}
              onChange={(e) => setForm({ ...form, ends: e.target.value })}
            />
          </Field>
        </div>
      )}

      {form.isMultiDay && (
        <div className="rounded-md border bg-secondary/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Päivät</span>
            <Button size="sm" variant="ghost" onClick={addDay}>
              <Plus className="mr-1 h-4 w-4" />
              Lisää päivä
            </Button>
          </div>
          <div className="space-y-2">
            {form.dayWindows.map((d, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2 text-xs">
                <Input
                  className="col-span-4"
                  type="date"
                  value={d.date}
                  onChange={(e) => {
                    const next = [...form.dayWindows];
                    next[i] = { ...next[i], date: e.target.value };
                    setForm({ ...form, dayWindows: next });
                  }}
                />
                <Input
                  className="col-span-3"
                  type="time"
                  value={d.start}
                  onChange={(e) => {
                    const next = [...form.dayWindows];
                    next[i] = { ...next[i], start: e.target.value };
                    setForm({ ...form, dayWindows: next });
                  }}
                />
                <Input
                  className="col-span-3"
                  type="time"
                  value={d.end}
                  onChange={(e) => {
                    const next = [...form.dayWindows];
                    next[i] = { ...next[i], end: e.target.value };
                    setForm({ ...form, dayWindows: next });
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="col-span-2"
                  onClick={() =>
                    setForm({
                      ...form,
                      dayWindows: form.dayWindows.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {form.dayWindows.length === 0 && (
              <p className="text-xs text-muted-foreground">Ei vielä päiviä.</p>
            )}
          </div>
        </div>
      )}

      <h3 className="pt-2 text-sm font-semibold text-muted-foreground">
        Aika-asetusten oletukset
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {numField("setupField", "Pituus/kolmiloikka valmistelu (min)", "Askelmerkit yms.")}
        {numField("setupVertical", "Korkeus/seiväs valmistelu (min)", "Lämmittelyhypyt")}
        {numField("hurdleSetup", "Aitojen pystytys (min)")}
        {numField("hurdleTeardown", "Aitojen purku (min)")}
      </div>
      <p className="text-xs text-muted-foreground">
        Juoksulajien kesto lasketaan kaavalla <strong>erien määrä × aika/erä</strong>.
        Aika per erä asetetaan lajikohtaisesti lajilistalla (oletuksena YAG 2022 ‑ohjearvot,
        esim. 60 m = 4 min, 100 m = 5 min, 800 m = 8 min).
      </p>

      <Field label="Muistiinpanot">
        <textarea
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        <Save className="mr-2 h-4 w-4" />
        Tallenna
      </Button>
    </section>
  );
}

// ─── Suorituspaikat ───────────────────────────────────────────────────────
function VenuesTab({
  planId,
  venues,
  onChange,
}: {
  planId: string;
  venues: VenueRow[];
  onChange: () => void;
}) {
  const [defaultsOpen, setDefaultsOpen] = useState(false);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("plan_venues").insert({
        plan_id: planId,
        name: "Uusi suorituspaikka",
        kind: "other" as VenueKind,
        sort_order: venues.length,
      });
      if (error) throw error;
    },
    onSuccess: onChange,
  });
  const update = useMutation({
    mutationFn: async (v: Partial<VenueRow> & { id: string }) => {
      const { error } = await supabase.from("plan_venues").update(v).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plan_venues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Suorituspaikat</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDefaultsOpen(true)}>
            <LayoutGrid className="mr-1 h-4 w-4" />
            YU-kentän oletus
          </Button>
          <Button size="sm" onClick={() => add.mutate()}>
            <Plus className="mr-1 h-4 w-4" />
            Lisää
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Jokainen rivi = yksi rinnakkainen suorituspaikka. Esim. kaksi pituuskuoppaa →
        kaksi riviä "Pituuskuoppa A" ja "Pituuskuoppa B".
      </p>
      <div className="space-y-2">
        {venues.map((v) => (
          <div key={v.id} className="grid grid-cols-12 items-center gap-2">
            <Input
              className="col-span-5"
              value={v.name}
              onChange={(e) => update.mutate({ id: v.id, name: e.target.value })}
            />
            <select
              className="col-span-5 rounded-md border border-input bg-background px-2 py-2 text-sm"
              value={v.kind}
              onChange={(e) => update.mutate({ id: v.id, kind: e.target.value as VenueKind })}
            >
              {(Object.keys(VENUE_KIND_LABEL) as VenueKind[]).map((k) => (
                <option key={k} value={k}>
                  {VENUE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <Button
              size="icon"
              variant="ghost"
              className="col-span-2"
              onClick={() => del.mutate(v.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {venues.length === 0 && (
          <p className="text-sm text-muted-foreground">Ei vielä suorituspaikkoja.</p>
        )}
      </div>

      <DefaultVenuesDialog
        open={defaultsOpen}
        onOpenChange={setDefaultsOpen}
        planId={planId}
        existingCount={venues.length}
        onAdded={onChange}
      />
    </section>
  );
}

function DefaultVenuesDialog({
  open,
  onOpenChange,
  planId,
  existingCount,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planId: string;
  existingCount: number;
  onAdded: () => void;
}) {
  const [selection, setSelection] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const s of DEFAULT_VENUES) init[s.key] = s.suggested;
    return init;
  });
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    try {
      const rows = buildDefaultVenueRows(selection).map((r, i) => ({
        ...r,
        plan_id: planId,
        sort_order: existingCount + i,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("plan_venues").insert(rows);
        if (error) throw error;
      }
      onAdded();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>YU-kentän oletussuorituspaikat</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Valitse kuinka monta kutakin paikkaa käytössänne on. Lisätyt paikat tulevat
            olemassa olevien jatkoksi — voit muokata niitä jälkeenpäin.
          </p>
          {DEFAULT_VENUES.map((s) => (
            <div key={s.key} className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-8 text-sm">{s.label}</label>
              <select
                className="col-span-4 rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={selection[s.key]}
                onChange={(e) =>
                  setSelection({ ...selection, [s.key]: parseInt(e.target.value) })
                }
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Peruuta
          </Button>
          <Button onClick={apply} disabled={busy}>
            Lisää valitut
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lajit ────────────────────────────────────────────────────────────────
function EventsTab({
  plan,
  planId,
  events,
  venues,
  catalog,
  onChange,
}: {
  plan: PlanRow;
  planId: string;
  events: PlanEventRow[];
  venues: VenueRow[];
  catalog: CatalogEntry[];
  onChange: () => void;
}) {
  void venues;
  const [pickerOpen, setPickerOpen] = useState(false);

  const ageClasses = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.age_class))).sort(ageClassSort),
    [catalog],
  );

  const update = useMutation({
    mutationFn: async (e: Partial<PlanEventRow> & { id: string }) => {
      const { error } = await supabase.from("plan_events").update(e).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plan_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });

  const days = plan.is_multi_day ? plan.day_windows ?? [] : [];

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Lajit</h2>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Lisää laji
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Ikäryhmä ja laji valitaan livetuloslistan datasta. Kentälajeissa "Suorituspaikkoja"
        = käytetäänkö samaan aikaan useampaa kuoppaa/kehää, juoksulajeissa "Ratoja".
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 pr-2">Ikäryhmä</th>
              <th className="py-1 pr-2">Laji</th>
              <th className="py-1 pr-2 text-right">Osanottajat</th>
              <th
                className="py-1 pr-2 text-right"
                title="Kentälajeissa rinnakkaisten suorituspaikkojen määrä, juoksulajeissa käytettyjen ratojen lukumäärä"
              >
                Paikkoja/Ratoja
              </th>
              <th className="py-1 pr-2">Finaalit</th>
              <th className="py-1 pr-2 text-right">A-finaalin koko</th>
              <th
                className="py-1 pr-2 text-right"
                title="Ohittaa automaattisen kestoarvion (lasketaan livetuloslistasta)"
              >
                Ohita kesto (min)
              </th>
              <th className="py-1 pr-2 text-right" title="Valmisteluaika ennen lajia (askelmerkit, lämmittely)">
                Valm.
              </th>
              <th className="py-1 pr-2 text-right" title="Juoksuissa: yhden erän kesto (sisältää järjestäytymisen). Lasketaan: erien määrä × aika/erä.">
                Aika/erä
              </th>
              <th className="py-1 pr-2 text-right" title="Aitojen pystytys">
                Aidat+
              </th>
              <th className="py-1 pr-2 text-right" title="Aitojen purku">
                Aidat−
              </th>
              {plan.is_multi_day && <th className="py-1 pr-2">Sallitut päivät</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const isTrack = /\d{2,5}\s*m\b|\d+\s*km|aita|hurdle/i.test(e.event_name);
              return (
                <tr key={e.id} className="border-t border-border/50 align-top">
                  <td className="py-1 pr-2">{e.age_class}</td>
                  <td className="py-1 pr-2">{e.event_name}</td>
                  <td className="py-1 pr-2 text-right">
                    <Input
                      type="number"
                      className="w-20 text-right"
                      value={e.participants}
                      onChange={(ev) =>
                        update.mutate({
                          id: e.id,
                          participants: Math.max(0, parseInt(ev.target.value) || 0),
                        })
                      }
                    />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <Input
                      type="number"
                      className="w-20 text-right"
                      value={e.station_count}
                      onChange={(ev) =>
                        update.mutate({
                          id: e.id,
                          station_count: Math.max(1, parseInt(ev.target.value) || 1),
                        })
                      }
                    />
                    <div className="text-[9px] text-muted-foreground">
                      {isTrack ? "ratoja" : "paikkoja"}
                    </div>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className="rounded border border-input bg-background px-2 py-1 text-xs"
                      value={e.final_format}
                      onChange={(ev) =>
                        update.mutate({
                          id: e.id,
                          final_format: ev.target.value as FinalFormat,
                        })
                      }
                      title={
                        e.final_format === "direct"
                          ? "Suora finaali = ei alkueriä"
                          : "Alkuerät + A- ja B-loppukilpailut"
                      }
                    >
                      <option value="direct">Suora</option>
                      <option value="a_b">A + B</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2 text-right">
                    {e.final_format === "a_b" && (
                      <Input
                        type="number"
                        className="w-16 text-right"
                        value={e.final_cut ?? 8}
                        onChange={(ev) =>
                          update.mutate({
                            id: e.id,
                            final_cut: parseInt(ev.target.value) || null,
                          })
                        }
                      />
                    )}
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <Input
                      type="number"
                      className="w-20 text-right"
                      placeholder="auto"
                      value={e.override_duration_min ?? ""}
                      onChange={(ev) => {
                        const v = ev.target.value;
                        update.mutate({
                          id: e.id,
                          override_duration_min: v === "" ? null : parseInt(v),
                        });
                      }}
                    />
                  </td>
                  {(
                    [
                      "setup_before_min",
                      "between_heats_min",
                      "hurdle_setup_min",
                      "hurdle_teardown_min",
                    ] as const
                  ).map((key) => {
                    const isHurdleField =
                      key === "hurdle_setup_min" || key === "hurdle_teardown_min";
                    const isHurdleEvt = /aita|aidat|hurdle/i.test(e.event_name);
                    const isPerHeatField = key === "between_heats_min";
                    if (isHurdleField && !isHurdleEvt) {
                      return (
                        <td key={key} className="py-1 pr-2 text-right text-muted-foreground">
                          –
                        </td>
                      );
                    }
                    if (isPerHeatField && !isTrack) {
                      return (
                        <td key={key} className="py-1 pr-2 text-right text-muted-foreground">
                          –
                        </td>
                      );
                    }
                    return (
                      <td key={key} className="py-1 pr-2 text-right">
                        <Input
                          type="number"
                          className="w-14 text-right"
                          placeholder="auto"
                          value={e[key] ?? ""}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            update.mutate({
                              id: e.id,
                              [key]: v === "" ? null : parseInt(v),
                            });
                          }}
                        />
                      </td>
                    );
                  })}
                  {plan.is_multi_day && (
                    <td className="py-1 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {days.map((d) => {
                          const checked = (e.allowed_days ?? []).includes(d.date);
                          return (
                            <label
                              key={d.date}
                              className={`cursor-pointer rounded px-1 text-[10px] ${
                                checked
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={checked}
                                onChange={(ev) => {
                                  const cur = new Set(e.allowed_days ?? []);
                                  if (ev.target.checked) cur.add(d.date);
                                  else cur.delete(d.date);
                                  const arr = Array.from(cur);
                                  update.mutate({
                                    id: e.id,
                                    allowed_days: arr.length > 0 ? arr : null,
                                  });
                                }}
                              />
                              {d.date.slice(5)}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  )}
                  <td className="py-1 pr-2">
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {events.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Ei vielä lajeja. Lisää napilla "Lisää laji" tai täytä demolla perustiedoista.
          </p>
        )}
      </div>

      <EventPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        catalog={catalog}
        ageClasses={ageClasses}
        onPick={async (age, name) => {
          await supabase.from("plan_events").insert({
            plan_id: planId,
            age_class: age,
            event_name: name,
            participants: 8,
            station_count: 1,
            final_format: "direct",
            sort_order: events.length,
          });
          onChange();
        }}
      />
    </section>
  );
}

function EventPickerDialog({
  open,
  onOpenChange,
  catalog,
  ageClasses,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalog: CatalogEntry[];
  ageClasses: string[];
  onPick: (ageClass: string, eventName: string) => Promise<void>;
}) {
  const [age, setAge] = useState<string>(ageClasses[0] ?? "");
  const [customMode, setCustomMode] = useState(false);
  const [customAge, setCustomAge] = useState("");
  const [customName, setCustomName] = useState("");

  // Keep `age` in sync once the catalog finishes loading or changes.
  useEffect(() => {
    if (ageClasses.length === 0) return;
    if (!age || !ageClasses.includes(age)) {
      setAge(ageClasses[0]);
    }
  }, [ageClasses, age]);

  const eventOptions = useMemo(
    () =>
      catalog
        .filter((c) => c.age_class === age)
        .sort((a, b) => a.event_name_display.localeCompare(b.event_name_display)),
    [catalog, age],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setCustomMode(false);
          setCustomAge("");
          setCustomName("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lisää laji</DialogTitle>
        </DialogHeader>
        {!customMode ? (
          <div className="space-y-3">
            <Field label="Ikäryhmä">
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              >
                {ageClasses.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Laji">
              <div className="max-h-64 overflow-y-auto rounded-md border">
                {eventOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.event_key}
                    onClick={async () => {
                      await onPick(age, opt.event_name_display);
                      onOpenChange(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-secondary/50"
                  >
                    {opt.event_name_display}
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      ({opt.sample_count} tulosta)
                    </span>
                  </button>
                ))}
                {eventOptions.length === 0 && (
                  <p className="p-2 text-xs text-muted-foreground">Ei lajeja tälle ikäryhmälle.</p>
                )}
              </div>
            </Field>
            <Button variant="link" size="sm" onClick={() => setCustomMode(true)}>
              Lisää oma laji (ei katalogissa)
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Ikäryhmä">
              <Input value={customAge} onChange={(e) => setCustomAge(e.target.value)} />
            </Field>
            <Field label="Laji">
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCustomMode(false)}>
                Takaisin
              </Button>
              <Button
                disabled={!customAge || !customName}
                onClick={async () => {
                  await onPick(customAge, customName);
                  onOpenChange(false);
                }}
              >
                Lisää
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ageClassSort(a: string, b: string): number {
  const order = (s: string) => {
    const ch = s.charAt(0);
    const ord = { T: 0, P: 1, N: 2, M: 3 }[ch] ?? 9;
    const num = parseInt(s.slice(1)) || 99;
    return ord * 100 + num;
  };
  return order(a) - order(b);
}

// ─── Aikataulu ───────────────────────────────────────────────────────────
function ScheduleTab({
  plan,
  venues,
  events,
  schedule,
  onChange,
}: {
  plan: PlanRow;
  venues: VenueRow[];
  events: PlanEventRow[];
  schedule: ScheduleItemRow[];
  onChange: () => void;
}) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (venues.length === 0 || events.length === 0) {
      setWarnings(["Lisää ensin suorituspaikat ja lajit."]);
      return;
    }
    setGenerating(true);
    try {
      const ests = await Promise.all(
        events.map(async (e) => {
          if (e.override_duration_min != null) {
            return {
              estimateMinutes: e.override_duration_min,
              finalAMin: e.final_format === "a_b" ? 8 : null,
              finalBMin:
                e.final_format === "a_b" && e.participants > (e.final_cut ?? 8) ? 8 : null,
            };
          }
          const r = await estimateDuration({
            event_name: e.event_name,
            age_class: e.age_class,
            participants: e.participants,
            sub_category: e.sub_category,
            station_count: e.station_count,
            final_format: e.final_format,
            final_cut: e.final_cut,
          });
          return {
            estimateMinutes: r.estimateMinutes,
            finalAMin: r.finalAMinutes,
            finalBMin: r.finalBMinutes,
          };
        }),
      );
      const enriched = events.map((e, i) => {
        const t = resolveTimings(e, plan);
        const lanes = Math.max(1, e.station_count);
        const heats = t.isTrack ? Math.max(1, Math.ceil(e.participants / lanes)) : 1;
        // Juoksulajeissa kesto = erien lukumäärä × aika per erä (ohittaa estimaatin).
        const trackDuration = t.isTrack ? heats * t.minutesPerHeatMin : null;
        return {
          ...e,
          ...ests[i],
          estimateMinutes: trackDuration ?? ests[i].estimateMinutes,
          setupBeforeMin: t.setupBeforeMin,
          minutesPerHeatMin: t.minutesPerHeatMin,
          hurdleSetupMin: t.hurdleSetupMin,
          hurdleTeardownMin: t.hurdleTeardownMin,
          isHurdles: t.isHurdles,
        };
      });
      const windows = resolveDayWindows(plan);
      const result = solve({
        windows,
        defaultRecoveryMin: plan.default_recovery_min,
        venues,
        events: enriched,
      });

      await supabase
        .from("plan_schedule_items")
        .delete()
        .eq("plan_id", plan.id)
        .eq("auto_generated", true);
      const rows = result.items.flatMap((it) =>
        it.venue_ids.map((venueId) => ({
          plan_id: plan.id,
          plan_event_id: it.plan_event_id,
          venue_id: venueId,
          phase: it.phase,
          starts_at: it.starts_at,
          ends_at: it.ends_at,
          auto_generated: true,
        })),
      );
      if (rows.length > 0) {
        const { error } = await supabase.from("plan_schedule_items").insert(rows);
        if (error) throw error;
      }
      setWarnings(result.warnings);
      onChange();
    } catch (e) {
      setWarnings([(e as Error).message]);
    } finally {
      setGenerating(false);
    }
  };

  const conflicts = useMemo(
    () => detectConflicts(schedule, events, venues, plan.default_recovery_min),
    [schedule, events, venues, plan.default_recovery_min],
  );

  const exportExcel = () => {
    const evMap = new Map(events.map((e) => [e.id, e]));
    const vMap = new Map(venues.map((v) => [v.id, v]));
    const rows = schedule.map((s) => {
      const ev = evMap.get(s.plan_event_id);
      const v = vMap.get(s.venue_id);
      const t = ev ? resolveTimings(ev, plan) : null;
      const startMs = new Date(s.starts_at).getTime();
      const setupStart = t ? new Date(startMs - t.setupBeforeMin * 60000) : null;
      return {
        "Valmistelu alkaa": setupStart ? setupStart.toLocaleString("fi-FI") : "",
        "Kilpailu alkaa": new Date(s.starts_at).toLocaleString("fi-FI"),
        "Kilpailu päättyy": new Date(s.ends_at).toLocaleString("fi-FI"),
        Ikäryhmä: ev?.age_class ?? "",
        Laji: ev?.event_name ?? "",
        Vaihe: s.phase,
        Suorituspaikka: v?.name ?? "",
        Osanottajat: ev?.participants ?? "",
        "Valm. (min)": t?.setupBeforeMin ?? "",
        "Aika/erä (min)": t?.isTrack ? t.minutesPerHeatMin : "",
        "Aitojen setup (min)": t?.isHurdles ? t.hurdleSetupMin : "",
        "Aitojen purku (min)": t?.isHurdles ? t.hurdleTeardownMin : "",
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Aikataulu");
    XLSX.writeFile(wb, `aikataulu-${plan.name.replace(/\s+/g, "_")}.xlsx`);
  };

  const exportPdf = () => {
    const conflictIds = new Set(conflicts.map((c) => c.id));
    downloadPlannerSchedulePdf({ plan, venues, events, schedule, conflictIds });
  };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Aikataulu</h2>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/planner/$planId/gantt" params={{ planId: plan.id }}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Avaa koko näytön aikataulu
            </Link>
          </Button>
          <Button onClick={generate} disabled={generating}>
            <Wand2 className="mr-2 h-4 w-4" />
            {generating ? "Generoidaan…" : "Generoi aikataulu"}
          </Button>
          <Button variant="secondary" onClick={exportExcel} disabled={schedule.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Vie Excel
          </Button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <div className="font-semibold">Generaattorin huomiot:</div>
          <ul className="list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
          <div className="font-semibold">Konfliktit:</div>
          <ul className="list-disc pl-5">
            {conflicts.map((c, i) => (
              <li key={i}>{c.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <PlannerGantt
        plan={plan}
        venues={venues}
        events={events}
        schedule={schedule}
        conflicts={conflicts}
        onChange={onChange}
      />
    </section>
  );
}

function PlannerGantt({
  plan,
  venues,
  events,
  schedule,
  conflicts,
  onChange,
}: {
  plan: PlanRow;
  venues: VenueRow[];
  events: PlanEventRow[];
  schedule: ScheduleItemRow[];
  conflicts: Array<{ id: string; reason: string }>;
  onChange: () => void;
}) {
  const windows = useMemo(() => resolveDayWindows(plan), [plan]);
  const [dayIdx, setDayIdx] = useState(0);
  const evMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const conflictMap = useMemo(
    () => new Map(conflicts.map((c) => [c.id, c.reason])),
    [conflicts],
  );

  const win = windows[Math.min(dayIdx, windows.length - 1)];
  const startMs = win?.startMs ?? 0;
  const endMs = win?.endMs ?? 0;
  const totalMin = Math.max(60, (endMs - startMs) / 60000);
  const pxPerMin = 1.4;
  const totalHeight = totalMin * pxPerMin;

  const dragRef = useRef<{
    id: string;
    startY: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  const updateTime = useMutation({
    mutationFn: async (p: { id: string; starts_at: string; ends_at: string }) => {
      const { error } = await supabase
        .from("plan_schedule_items")
        .update({ starts_at: p.starts_at, ends_at: p.ends_at, auto_generated: false })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });

  const ticks: number[] = [];
  for (let m = 0; m <= totalMin; m += 30) ticks.push(m);

  const colorFor = (ageClass: string): string => {
    let h = 0;
    for (let i = 0; i < ageClass.length; i++) h = (h * 31 + ageClass.charCodeAt(i)) % 360;
    return `hsl(${h} 70% 70% / 0.55)`;
  };

  if (venues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Lisää suorituspaikat välilehdellä "Suorituspaikat" nähdäksesi kalenterin.
      </p>
    );
  }

  const dayItems = schedule.filter((s) => {
    const t = new Date(s.starts_at).getTime();
    return t >= startMs && t < endMs + 12 * 3600 * 1000;
  });

  const onPointerDown = (e: React.PointerEvent, item: ScheduleItemRow) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const orig = new Date(item.starts_at).getTime();
    const origEnd = new Date(item.ends_at).getTime();
    dragRef.current = { id: item.id, startY: e.clientY, origStart: orig, origEnd };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const minutes = Math.round(dy / pxPerMin / 5) * 5;
    const newStart = d.origStart + minutes * 60000;
    const dur = d.origEnd - d.origStart;
    const el = document.getElementById(`gantt-bar-${d.id}`);
    if (el) {
      const off = (newStart - startMs) / 60000;
      el.style.top = `${off * pxPerMin}px`;
      void dur;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const minutes = Math.round(dy / pxPerMin / 5) * 5;
    if (minutes === 0) return;
    const newStart = new Date(d.origStart + minutes * 60000);
    const newEnd = new Date(d.origEnd + minutes * 60000);
    updateTime.mutate({
      id: d.id,
      starts_at: newStart.toISOString(),
      ends_at: newEnd.toISOString(),
    });
  };

  return (
    <div className="space-y-2">
      {windows.length > 1 && (
        <div className="flex gap-1">
          {windows.map((w, i) => (
            <button
              key={w.date}
              onClick={() => setDayIdx(i)}
              className={`rounded-md px-3 py-1 text-xs ${
                i === dayIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {new Date(w.date).toLocaleDateString("fi-FI", {
                weekday: "short",
                day: "numeric",
                month: "numeric",
              })}
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Vihje: vedä palkkia pystysuunnassa siirtääksesi sitä aikajanalla (5 min napsahdus).
      </p>
      <div className="overflow-auto rounded-lg border">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `64px repeat(${venues.length}, minmax(140px, 1fr))`,
            minWidth: 64 + venues.length * 140,
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="sticky top-0 z-10 border-b bg-card px-2 py-1 text-xs font-semibold">
            Aika
          </div>
          {venues.map((v) => (
            <div
              key={v.id}
              className="sticky top-0 z-10 border-b border-l bg-card px-2 py-1 text-xs font-semibold"
            >
              {v.name}
            </div>
          ))}

          <div className="relative border-r" style={{ height: totalHeight }}>
            {ticks.map((m) => (
              <div
                key={m}
                className="absolute left-0 right-0 border-t border-border/40 pl-1 text-[10px] text-muted-foreground"
                style={{ top: m * pxPerMin }}
              >
                {new Date(startMs + m * 60000).toLocaleTimeString("fi-FI", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            ))}
          </div>

          {venues.map((v) => {
            const items = dayItems.filter((s) => s.venue_id === v.id);
            return (
              <div
                key={v.id}
                className="relative border-l"
                style={{ height: totalHeight }}
              >
                {ticks.map((m) => (
                  <div
                    key={m}
                    className="absolute left-0 right-0 border-t border-border/30"
                    style={{ top: m * pxPerMin }}
                  />
                ))}
                {items.map((s) => {
                  const ev = evMap.get(s.plan_event_id);
                  const t = ev ? resolveTimings(ev, plan) : null;
                  const startOff = (new Date(s.starts_at).getTime() - startMs) / 60000;
                  const dur =
                    (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000;
                  const setupMin = t?.setupBeforeMin ?? 0;
                  const isHurdleEvt = !!t?.isHurdles;
                  const conflictReason = conflictMap.get(s.id);
                  return (
                    <div key={s.id}>
                      {setupMin > 0 && (
                        <div
                          className="absolute left-0.5 right-0.5 overflow-hidden rounded-t border border-dashed border-border/50 px-1 text-[9px] italic leading-tight"
                          style={{
                            top: (startOff - setupMin) * pxPerMin,
                            height: setupMin * pxPerMin,
                            background: ev ? colorFor(ev.age_class) : "hsl(0 0% 80% / 0.25)",
                            opacity: 0.35,
                          }}
                          title={`Valmistelu ${setupMin} min`}
                        >
                          Valm. {setupMin}′
                        </div>
                      )}
                      <div
                        id={`gantt-bar-${s.id}`}
                        onPointerDown={(e) => onPointerDown(e, s)}
                        className={`absolute left-0.5 right-0.5 cursor-grab touch-none select-none overflow-hidden rounded border px-1 py-0.5 text-[10px] leading-tight shadow-sm active:cursor-grabbing ${
                          conflictReason ? "border-destructive ring-1 ring-destructive" : "border-border/60"
                        }`}
                        style={{
                          top: startOff * pxPerMin,
                          height: Math.max(16, dur * pxPerMin - 1),
                          background: ev ? colorFor(ev.age_class) : "hsl(0 0% 80% / 0.5)",
                        }}
                        title={
                          conflictReason ??
                          `${ev?.age_class} ${ev?.event_name} (${s.phase})`
                        }
                      >
                        <div className="font-semibold">
                          {isHurdleEvt && <span title="Aitajuoksu">⫼ </span>}
                          {ev?.age_class}
                        </div>
                        <div className="truncate">{ev?.event_name}</div>
                        {s.phase !== "single" && (
                          <div className="text-[9px] text-muted-foreground">{s.phase}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${className}`}>
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
