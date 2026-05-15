import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import logo from "@/assets/lahden-ahkera-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Aseta uusi salasana" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) {
      toast.error("Salasanat eivät täsmää");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Salasana päivitetty");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Päivitys epäonnistui");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center px-4 py-8">
        <img src={logo} alt="Lahden Ahkera" className="mb-4 h-20 w-20 object-contain" />
        <h1 className="text-center text-2xl font-bold">Aseta uusi salasana</h1>

        {!hasSession ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Avaa sähköpostiisi tullut palautuslinkki tällä laitteella avataksesi tämän sivun.
            <br />
            <Link to="/login" className="mt-3 inline-flex items-center gap-1 text-primary">
              <ArrowLeft className="h-3 w-3" /> Takaisin kirjautumiseen
            </Link>
          </p>
        ) : (
          <form onSubmit={submit} className="mt-8 w-full space-y-4 rounded-2xl border bg-card p-5">
            <div>
              <Label htmlFor="pw">Uusi salasana</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pw"
                  type="password"
                  required
                  minLength={6}
                  className="pl-9"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pw2">Vahvista uusi salasana</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pw2"
                  type="password"
                  required
                  minLength={6}
                  className="pl-9"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Tallenna salasana
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
