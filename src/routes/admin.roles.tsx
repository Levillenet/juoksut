import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/admin/roles")({
  head: () => ({ meta: [{ title: "Admin · Käyttöoikeudet" }] }),
  component: Gate,
});

type AppRole = "admin" | "planner" | "official";

interface RoleRow {
  user_id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

function Gate() {
  const { loading, isAdmin, user } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;
  return <Page />;
}

interface AuthUserRow {
  user_id: string;
  email: string;
  last_sign_in_at: string | null;
}

function Page() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("planner");
  const [error, setError] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.rpc("list_role_members");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const usersQ = useQuery({
    queryKey: ["admin", "auth_users"],
    queryFn: async (): Promise<AuthUserRow[]> => {
      const { data, error } = await supabase.rpc("list_auth_users");
      if (error) throw error;
      return (data ?? []) as AuthUserRow[];
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      const trimmed = email.trim();
      if (!trimmed) throw new Error("Valitse käyttäjä");
      const { error } = await supabase.rpc("grant_role_by_email", {
        _email: trimmed,
        _role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setEmail("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (row: RoleRow) => {
      const { error } = await supabase.rpc("revoke_role", {
        _user_id: row.user_id,
        _role: row.role,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });

  const fmtLast = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("fi-FI") : "ei kirjautumista";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/">
            <Button variant="ghost" size="icon" aria-label="Takaisin">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-base font-semibold">Käyttöoikeudet</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Myönnä rooli
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              disabled={usersQ.isLoading}
            >
              <option value="">
                {usersQ.isLoading ? "Ladataan käyttäjiä…" : "— valitse käyttäjä —"}
              </option>
              {(usersQ.data ?? []).map((u) => (
                <option key={u.user_id} value={u.email}>
                  {u.email} · {fmtLast(u.last_sign_in_at)}
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "planner" | "admin")}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="planner">planner</option>
              <option value="admin">admin</option>
            </select>
            <Button
              onClick={() => grant.mutate()}
              disabled={grant.isPending || !email}
            >
              Myönnä
            </Button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          )}
          {usersQ.error && (
            <p className="mt-2 text-xs text-destructive">
              Käyttäjälistan lataus epäonnistui: {(usersQ.error as Error).message}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Lista sisältää kaikki kirjautuneet käyttäjät. Jos uusi käyttäjä ei näy, pyydä häntä kirjautumaan kerran (Google tai sähköposti) ja päivitä sivu.
          </p>
        </section>


        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Nykyiset roolit
          </p>
          {listQ.isLoading && (
            <p className="text-sm text-muted-foreground">Ladataan…</p>
          )}
          {listQ.error && (
            <p className="text-sm text-destructive">
              {(listQ.error as Error).message}
            </p>
          )}
          {listQ.data && listQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Ei rooleja vielä.</p>
          )}
          {listQ.data && listQ.data.length > 0 && (
            <ul className="divide-y">
              {listQ.data.map((r) => (
                <li
                  key={`${r.user_id}-${r.role}`}
                  className="flex items-center justify-between py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.email}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.role}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Poistetaanko rooli "${r.role}" käyttäjältä ${r.email}?`)) {
                        revoke.mutate(r);
                      }
                    }}
                    aria-label="Poista"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
