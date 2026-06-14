import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { ArrowLeft, Trash2, Plus, Wand2, Save, Download } from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  VENUE_KIND_LABEL,
  type PlanRow,
  type VenueRow,
  type PlanEventRow,
  type ScheduleItemRow,
  type CatalogEntry,
  type VenueKind,
  type FinalFormat,
} from "@/lib/planner-types";
import { estimateDuration } from "@/lib/planner-estimate";
import { solve, detectConflicts } from "@/lib/planner-solver";
import { resolveTimings } from "@/lib/planner-timings";

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
      return data as PlanRow;
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
      return (data ?? []) as PlanEventRow[];
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
    queryKey: ["planner", "catalog"],
    queryFn: async (): Promise<CatalogEntry[]> => {
      const { data, error } = await supabase.rpc("get_event_catalog");
      if (error) throw error;
      return (data ?? []) as CatalogEntry[];
    },
    staleTime: 60 * 60 * 1000,
  });

  const invalidate = (k: string) => qc.invalidateQueries({ queryKey: ["planner", k, planId] });

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
        {tab === "basics" && <BasicsTab plan={plan} onChange={() => invalidate("plan")} />}
        {tab === "venues" && (
          <VenuesTab planId={planId} venues={venues} onChange={() => invalidate("venues")} />
        )}
        {tab === "events" && (
          <EventsTab
            planId={planId}
            events={events}
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
function BasicsTab({ plan, onChange }: { plan: PlanRow; onChange: () => void }) {
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
    notes: plan.notes ?? "",
  });
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
          notes: form.notes,
        })
        .eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });

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
      <h2 className="text-base font-semibold">Perustiedot</h2>
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

      <h3 className="pt-2 text-sm font-semibold text-muted-foreground">
        Aika-asetusten oletukset
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {numField("setupField", "Pituus/kolmiloikka valmistelu (min)", "Askelmerkit yms. ennen lajia")}
        {numField("setupVertical", "Korkeus/seiväs valmistelu (min)", "Lämmittelyhypyt, telineet")}
        {numField("betweenHeats", "Juoksuerien väli (min)", "Järjestäytymisaika erien välissä")}
        {numField("hurdleSetup", "Aitojen pystytys (min)", "Ennen ensimmäistä aitaerää")}
        {numField("hurdleTeardown", "Aitojen purku (min)", "Aitablokin jälkeen")}
      </div>

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
        <Button size="sm" onClick={() => add.mutate()}>
          <Plus className="mr-1 h-4 w-4" />
          Lisää
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Jokainen rivi = yksi rinnakkainen suorituspaikka. Esim. kaksi pituuskuoppaa →
        kaksi riviä "Pituuskuoppa A" ja "Pituuskuoppa B". Lajilomakkeessa voi sitten
        valita käyttääkö yksi laji 1 vai 2 paikkaa rinnakkain.
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
              onChange={(e) =>
                update.mutate({ id: v.id, kind: e.target.value as VenueKind })
              }
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
    </section>
  );
}

// ─── Lajit ────────────────────────────────────────────────────────────────
function EventsTab({
  planId,
  events,
  catalog,
  onChange,
}: {
  planId: string;
  events: PlanEventRow[];
  catalog: CatalogEntry[];
  onChange: () => void;
}) {
  const ageClasses = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.age_class))).sort(),
    [catalog],
  );

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("plan_events").insert({
        plan_id: planId,
        age_class: "T11",
        event_name: "60 m",
        participants: 0,
        station_count: 1,
        final_format: "direct" as FinalFormat,
        sort_order: events.length,
      });
      if (error) throw error;
    },
    onSuccess: onChange,
  });
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

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Lajit</h2>
        <Button size="sm" onClick={() => add.mutate()}>
          <Plus className="mr-1 h-4 w-4" />
          Lisää laji
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Ikäryhmä ja laji haetaan aiempien kisojen perusteella, mutta voit kirjoittaa
        uusiakin. "Asemia rinnakkain" = käytetäänkö lajilla 1 vai esim. 2 suorituspaikkaa
        samanaikaisesti (esim. pituushyppy 2 kuopalla yhdelle ikäryhmälle).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 pr-2">Ikäryhmä</th>
              <th className="py-1 pr-2">Laji</th>
              <th className="py-1 pr-2 text-right">Osanottajat</th>
              <th className="py-1 pr-2 text-right">Asemia rinnakkain</th>
              <th className="py-1 pr-2">Finaalit</th>
              <th className="py-1 pr-2 text-right">A-finaalin koko</th>
              <th className="py-1 pr-2 text-right">Oma kesto (min)</th>
              <th className="py-1 pr-2 text-right" title="Valmisteluaika ennen lajia (askelmerkit yms.)">Valm.</th>
              <th className="py-1 pr-2 text-right" title="Juoksuerien välinen järjestäytymisaika">Eräväli</th>
              <th className="py-1 pr-2 text-right" title="Aitojen pystytys (vain aitalajit)">Aidat+</th>
              <th className="py-1 pr-2 text-right" title="Aitojen purku (vain aitalajit)">Aidat-</th>
              <th></th>

            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const ageEvents = catalog.filter((c) => c.age_class === e.age_class);
              return (
                <tr key={e.id} className="border-t border-border/50 align-top">
                  <td className="py-1 pr-2">
                    <input
                      list={`agecls-${planId}`}
                      className="w-20 rounded border border-input bg-background px-2 py-1 text-xs"
                      value={e.age_class}
                      onChange={(ev) => update.mutate({ id: e.id, age_class: ev.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      list={`evname-${e.id}`}
                      className="w-56 rounded border border-input bg-background px-2 py-1 text-xs"
                      value={e.event_name}
                      onChange={(ev) => update.mutate({ id: e.id, event_name: ev.target.value })}
                    />
                    <datalist id={`evname-${e.id}`}>
                      {ageEvents.map((c) => (
                        <option key={c.event_key} value={c.event_name_display} />
                      ))}
                    </datalist>
                  </td>
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
                  {(["setup_before_min", "between_heats_min", "hurdle_setup_min", "hurdle_teardown_min"] as const).map(
                    (key) => {
                      const isHurdleField = key === "hurdle_setup_min" || key === "hurdle_teardown_min";
                      const isHurdleEvt = /aita|aidat|hurdle/i.test(e.event_name);
                      if (isHurdleField && !isHurdleEvt) {
                        return <td key={key} className="py-1 pr-2 text-right text-muted-foreground">–</td>;
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
                              update.mutate({ id: e.id, [key]: v === "" ? null : parseInt(v) });
                            }}
                          />
                        </td>
                      );
                    },
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
        <datalist id={`agecls-${planId}`}>
          {ageClasses.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>
    </section>
  );
}

// ─── Aikataulu + kalenterinäkymä ──────────────────────────────────────────
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
      // Estimoi kaikkien lajien kesto
      const ests = await Promise.all(
        events.map(async (e) => {
          if (e.override_duration_min != null) {
            return {
              estimateMinutes: e.override_duration_min,
              finalAMin: e.final_format === "a_b" ? 8 : null,
              finalBMin: e.final_format === "a_b" && e.participants > (e.final_cut ?? 8) ? 8 : null,
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
        // Lisää erien välinen aika juoksulajeille arvioon.
        const heats = t.isTrack ? Math.max(1, Math.ceil(e.participants / 8)) : 1;
        const heatGapAdd = t.isTrack ? (heats - 1) * t.betweenHeatsMin : 0;
        return {
          ...e,
          ...ests[i],
          estimateMinutes: ests[i].estimateMinutes + heatGapAdd,
          setupBeforeMin: t.setupBeforeMin,
          betweenHeatsMin: t.betweenHeatsMin,
          hurdleSetupMin: t.hurdleSetupMin,
          hurdleTeardownMin: t.hurdleTeardownMin,
          isHurdles: t.isHurdles,
        };
      });
      const result = solve({
        startISO: plan.starts_at,
        endISO: plan.ends_at,
        defaultRecoveryMin: plan.default_recovery_min,
        venues,
        events: enriched,
      });

      // Tallenna: tyhjennä auto-generated rivit ja korvaa
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
        "Eräväli (min)": t?.isTrack ? t.betweenHeatsMin : "",
        "Aitojen setup (min)": t?.isHurdles ? t.hurdleSetupMin : "",
        "Aitojen purku (min)": t?.isHurdles ? t.hurdleTeardownMin : "",
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Aikataulu");
    XLSX.writeFile(wb, `aikataulu-${plan.name.replace(/\s+/g, "_")}.xlsx`);
  };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Aikataulu</h2>
        <div className="flex gap-2">
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

      <CalendarView plan={plan} venues={venues} events={events} schedule={schedule} />
    </section>
  );
}

function CalendarView({
  plan,
  venues,
  events,
  schedule,
}: {
  plan: PlanRow;
  venues: VenueRow[];
  events: PlanEventRow[];
  schedule: ScheduleItemRow[];
}) {
  const startMs = new Date(plan.starts_at).getTime();
  const endMs = new Date(plan.ends_at).getTime();
  const totalMin = Math.max(60, (endMs - startMs) / 60000);
  const pxPerMin = 1.4;
  const totalHeight = totalMin * pxPerMin;
  const evMap = new Map(events.map((e) => [e.id, e]));

  // Aikamerkit 30 min välein.
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

  return (
    <div className="overflow-auto rounded-lg border">
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: `64px repeat(${venues.length}, minmax(140px, 1fr))`,
          minWidth: 64 + venues.length * 140,
        }}
      >
        {/* Header */}
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

        {/* Aika-sarake */}
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

        {/* Paikat */}
        {venues.map((v) => {
          const items = schedule.filter((s) => s.venue_id === v.id);
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
                const dur = (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000;
                const setupMin = t?.setupBeforeMin ?? 0;
                const isHurdleEvt = !!t?.isHurdles;
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
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded border border-border/60 px-1 py-0.5 text-[10px] leading-tight shadow-sm"
                      style={{
                        top: startOff * pxPerMin,
                        height: Math.max(16, dur * pxPerMin - 1),
                        background: ev ? colorFor(ev.age_class) : "hsl(0 0% 80% / 0.5)",
                      }}
                      title={`${ev?.age_class} ${ev?.event_name} (${s.phase})`}
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
