import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Building2, MapPin, Plus, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/stadiums/")({
  component: StadiumsIndex,
});

interface StadiumRow {
  id: string;
  name: string;
  location: string | null;
  notes: string | null;
  updated_at: string;
}

function StadiumsIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["stadiums", "list"],
    queryFn: async (): Promise<StadiumRow[]> => {
      const { data, error } = await supabase
        .from("stadiums")
        .select("id, name, location, notes, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StadiumRow[];
    },
  });

  const create = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("stadiums")
        .insert({ user_id: user.id, name: "Uusi stadion" })
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["stadiums", "list"] });
      navigate({ to: "/stadiums/$stadiumId", params: { stadiumId: data.id } });
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">
        Kirjaudu sisään käyttääksesi stadion-hallintaa.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Stadionit</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <section className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Tallenna kentät ja niiden suorituspaikat — käytä samaa stadionia monessa
            kilpailusuunnitelmassa. Integrointi planneriin tulee myöhemmin.
          </p>
          <Button onClick={create} disabled={creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Luo uusi stadion
          </Button>
        </section>

        {q.isLoading && <p className="text-sm text-muted-foreground">Ladataan…</p>}
        {q.error && <p className="text-sm text-destructive">Virhe: {(q.error as Error).message}</p>}
        {q.data && q.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Ei vielä stadioneja.</p>
        )}
        <ul className="space-y-2">
          {(q.data ?? []).map((s) => (
            <li key={s.id} className="rounded-lg border bg-card hover:bg-secondary/40">
              <Link
                to="/stadiums/$stadiumId"
                params={{ stadiumId: s.id }}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{s.name}</div>
                  {s.location && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {s.location}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.updated_at).toLocaleDateString("fi-FI")}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
