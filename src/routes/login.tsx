import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, Lock, ShieldCheck, LogIn, KeyRound } from "lucide-react";
import { toast } from "sonner";

import logo from "@/assets/lahden-ahkera-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Kirjaudu – Live tuloslista seuranta" },
      {
        name: "description",
        content: "Kirjaudu Lahden Ahkeran live tuloslista seurantapalveluun.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (role) return <Navigate to="/" />;
  return <LoginForm />;
}

function LoginForm() {
  const navigate = useNavigate();
  const { signInOfficial } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [officialPw, setOfficialPw] = useState("");

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      if (password !== password2) {
        toast.error("Salasanat eivät täsmää");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        // auto-confirm on → try to sign in immediately
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          toast.success("Tili luotu. Voit nyt kirjautua sisään.");
          setMode("signin");
        } else {
          toast.success("Tervetuloa!");
          navigate({ to: "/" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kirjautuminen epäonnistui");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!email) {
      toast.error("Anna ensin sähköpostiosoitteesi");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Salasanan palautuslinkki lähetetty sähköpostiisi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Palautus epäonnistui");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google-kirjautuminen epäonnistui");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  };

  const handleOfficial = (e: FormEvent) => {
    e.preventDefault();
    if (signInOfficial(officialPw)) {
      toast.success("Tervetuloa, toimitsija");
      navigate({ to: "/" });
    } else {
      toast.error("Väärä toimitsijasalasana");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center px-4 py-8">
        <img src={logo} alt="Lahden Ahkera" className="mb-4 h-20 w-20 object-contain" />
        <h1 className="text-center text-2xl font-bold leading-tight">
          Live tuloslista seurantapalvelu
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Lahden Ahkera · yleisurheilun kisaseuranta
        </p>

        {/* Personal user section */}
        <section className="mt-8 w-full rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold">Kisan seuraajalle</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Kirjaudu Googlella tai luo tunnus sähköpostilla. Voit kiinnittää omia
            kilpailijoita seurantaan.
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={busy}
          >
            <LogIn className="mr-2 h-4 w-4" />
            Jatka Google-tilillä
          </Button>

          <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            tai sähköpostilla
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <Label htmlFor="email">Sähköposti</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Salasana</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="password2">Vahvista salasana</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={6}
                    className="pl-9"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signup" ? "Luo tunnus" : "Kirjaudu sisään"}
            </Button>
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="text-muted-foreground hover:text-foreground"
              >
                {mode === "signup"
                  ? "Onko sinulla jo tunnus? Kirjaudu sisään"
                  : "Ei tunnusta? Luo uusi sähköpostilla"}
              </button>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <KeyRound className="h-3 w-3" />
                  Unohditko salasanan?
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Toimitsija section */}
        <section className="mt-6 w-full rounded-2xl border-2 border-primary/40 bg-card p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Toimitsijakirjautuminen</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Toimitsijoille jaettu yhteinen salasana. Avaa kuuluttajanäkymän ja muut
            toimitsijatyökalut.
          </p>
          <form onSubmit={handleOfficial} className="space-y-3">
            <div>
              <Label htmlFor="official-pw">Toimitsijasalasana</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="official-pw"
                  type="password"
                  required
                  className="pl-9"
                  value={officialPw}
                  onChange={(e) => setOfficialPw(e.target.value)}
                  placeholder="Yhteinen salasana"
                />
              </div>
            </div>
            <Button type="submit" variant="secondary" className="w-full">
              Kirjaudu toimitsijana
            </Button>
          </form>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com
        </p>
      </div>
    </div>
  );
}
