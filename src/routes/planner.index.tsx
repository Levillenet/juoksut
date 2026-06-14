import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CalendarDays, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import type { PlanRow } from "@/lib/planner-types";

export const Route = createFileRoute("/planner/")({
  component: PlannerIndex,
});

function PlannerIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["planner", "plans"],
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await supabase
        .from("competition_plans")
        .select("*")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Ei kirjautunut");
      const start = new Date();
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(17, 0, 0, 0);
      const { data, error } = await supabase
        .from("competition_plans")
        .insert({
          user_id: user.id,
          name: `Uusi kilpailu ${new Date().toLocaleDateString("fi-FI")}`,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["planner", "plans"] });
      navigate({ to: "/planner/$planId", params: { planId: id } });
    },
    onSettled: () => setCreating(false),
  });

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
          <Button
            onClick={() => {
              setCreating(true);
              create.mutate();
            }}
            disabled={creating}
          >
            <Plus className="mr-2 h-4 w-4" />
            Uusi suunnitelma
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-3 px-4 py-6">
        {q.isLoading && <p className="text-sm text-muted-foreground">Ladataan…</p>}
        {q.error && (
          <p className="text-sm text-destructive">Virhe: {(q.error as Error).message}</p>
        )}
        {q.data && q.data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ei vielä suunnitelmia. Luo ensimmäinen "Uusi suunnitelma" -napilla.
          </p>
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
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
