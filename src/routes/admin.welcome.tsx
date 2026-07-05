import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/welcome")({
  head: () => ({ meta: [{ title: "Admin · Tervehdysviesti" }] }),
  component: Gate,
});

interface WelcomeMessage {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  updated_at: string;
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

function Page() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [enabled, setEnabled] = useState(false);

  const msgQ = useQuery({
    queryKey: ["admin", "welcome-message"],
    queryFn: async (): Promise<WelcomeMessage | null> => {
      const { data, error } = await supabase
        .from("welcome_messages")
        .select("id,title,body,enabled,updated_at")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return (data as WelcomeMessage | null) ?? null;
    },
  });

  useEffect(() => {
    if (!msgQ.data) return;
    setTitle(msgQ.data.title);
    setBody(msgQ.data.body);
    setEnabled(msgQ.data.enabled);
  }, [msgQ.data]);

  const saveM = useMutation({
    mutationFn: async () => {
      if (msgQ.data) {
        const { error } = await supabase
          .from("welcome_messages")
          .update({ title, body, enabled })
          .eq("id", msgQ.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("welcome_messages")
          .insert({ singleton: true, title, body, enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Tervehdysviesti tallennettu");
      qc.invalidateQueries({ queryKey: ["admin", "welcome-message"] });
      qc.invalidateQueries({ queryKey: ["welcome-message"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Tallennus epäonnistui"),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-semibold">Tervehdysviesti</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Kirjoita tervehdys, joka näytetään kirjautuneille käyttäjille
          modaalissa. Jokainen käyttäjä näkee viestin kerran; kun muokkaat sitä,
          käyttäjät näkevät päivitetyn version uudestaan.
        </p>

        <div className="space-y-2">
          <Label htmlFor="wm-title">Otsikko</Label>
          <Input
            id="wm-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Esim. Uutta palvelussa"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wm-body">Viesti</Label>
          <Textarea
            id="wm-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Kirjoita tervehdysviestin sisältö…"
            rows={8}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div>
            <p className="text-sm font-semibold">Näytä käyttäjille</p>
            <p className="text-xs text-muted-foreground">
              Kun päällä, kirjautuneet käyttäjät näkevät viestin kerran.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!msgQ.data) return;
              setTitle(msgQ.data.title);
              setBody(msgQ.data.body);
              setEnabled(msgQ.data.enabled);
            }}
            disabled={!msgQ.data || saveM.isPending}
          >
            Peruuta muutokset
          </Button>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending ? "Tallennetaan…" : "Tallenna"}
          </Button>
        </div>
      </main>
    </div>
  );
}
