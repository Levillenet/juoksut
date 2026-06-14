import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CalendarDays, Plus, Sparkles, Copy, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PlanRow } from "@/lib/planner-types";
import {
  fillPlanWithDemo,
  fillPlanFromCompetition,
  listTemplateCompetitions,
  type TemplateCompetition,
} from "@/lib/planner-demo";

export const Route = createFileRoute("/planner/")({
  component: PlannerIndex,
});

type CreateMode = "empty" | "demo" | "template";

function PlannerIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const q = useQuery({
    queryKey: ["planner", "plans"],
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await supabase
        .from("competition_plans")
        .select("*")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlanRow[];
    },
  });

  const createPlan = async (mode: CreateMode, competitionId?: number, competitionName?: string) => {
    if (!user) throw new Error("Ei kirjautunut");
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(17, 0, 0, 0);
    const baseName =
      mode === "template" && competitionName
        ? `${competitionName} (kopio)`
        : mode === "demo"
          ? `Demokilpailu ${new Date().toLocaleDateString("fi-FI")}`
          : `Uusi kilpailu ${new Date().toLocaleDateString("fi-FI")}`;
    const { data, error } = await supabase
      .from("competition_plans")
      .insert({
        user_id: user.id,
        name: baseName,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    const planId = data.id as string;
    if (mode === "demo") await fillPlanWithDemo({ planId });
    if (mode === "template" && competitionId) {
      await fillPlanFromCompetition(planId, competitionId);
    }
    return planId;
  };

  const handleCreate = async (mode: CreateMode, competitionId?: number, competitionName?: string) => {
    setCreating(true);
    try {
      const id = await createPlan(mode, competitionId, competitionName);
      qc.invalidateQueries({ queryKey: ["planner", "plans"] });
      setTemplateOpen(false);
      navigate({ to: "/planner/$planId", params: { planId: id } });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <CalendarDays className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Aikataulun suunnittelija</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Luo uusi suunnitelma</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleCreate("empty")} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              Tyhjä pohja
            </Button>
            <Button variant="secondary" onClick={() => handleCreate("demo")} disabled={creating}>
              <Sparkles className="mr-2 h-4 w-4" />
              Demokilpailu (täydet lajit)
            </Button>
            <Button variant="outline" onClick={() => setTemplateOpen(true)} disabled={creating}>
              <Copy className="mr-2 h-4 w-4" />
              Aiempi kilpailu pohjaksi…
            </Button>
            {creating && <Loader2 className="ml-2 h-4 w-4 animate-spin self-center" />}
          </div>
        </section>

        {q.isLoading && <p className="text-sm text-muted-foreground">Ladataan…</p>}
        {q.error && (
          <p className="text-sm text-destructive">Virhe: {(q.error as Error).message}</p>
        )}
        {q.data && q.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Ei vielä suunnitelmia.</p>
        )}
        <ul className="space-y-2">
          {(q.data ?? []).map((p) => (
            <li key={p.id} className="rounded-lg border bg-card p-3 hover:bg-secondary/40">
              <Link
                to="/planner/$planId"
                params={{ planId: p.id }}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.starts_at).toLocaleString("fi-FI")} –{" "}
                    {new Date(p.ends_at).toLocaleString("fi-FI")}
                    {p.is_multi_day ? " · monipäiväinen" : ""}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <TemplatePickerDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        onPick={(c) => handleCreate("template", c.competition_id, c.competition_name)}
        busy={creating}
      />
    </div>
  );
}

function TemplatePickerDialog({
  open,
  onOpenChange,
  onPick,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (c: TemplateCompetition) => void;
  busy: boolean;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const q = useQuery({
    queryKey: ["planner", "template-competitions", year],
    queryFn: () => listTemplateCompetitions(year),
    enabled: open,
  });
  const list = q.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Valitse aiempi kilpailu pohjaksi</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">Vuosi</label>
            <select
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
            >
              {[0, 1, 2, 3, 4].map((d) => {
                const y = new Date().getFullYear() - d;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
            {q.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-[400px] overflow-y-auto rounded-md border">
            {list.length === 0 && !q.isLoading && (
              <p className="p-3 text-sm text-muted-foreground">
                Ei kilpailuita vuodelta {year}.
              </p>
            )}
            <ul className="divide-y">
              {list.map((c) => (
                <li key={c.competition_id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPick(c)}
                    className="block w-full px-3 py-2 text-left hover:bg-secondary/40 disabled:opacity-50"
                  >
                    <div className="font-medium">{c.competition_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.competition_date).toLocaleDateString("fi-FI")} ·{" "}
                      {c.location ?? "—"} · {c.event_count} lajia · {c.age_class_count} sarjaa ·{" "}
                      {c.result_count} tulosta
                      {c.duration_days > 1 ? ` · ${c.duration_days} pv` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Sulje
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
