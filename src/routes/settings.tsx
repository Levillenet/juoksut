import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft, Settings as SettingsIcon, MapPin, Database, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  REFRESH_OPTIONS,
  useRefreshIntervalSec,
} from "@/lib/settings-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Asetukset – Lahden Ahkera" },
      {
        name: "description",
        content: "Sovelluksen asetukset: päivitystiheys ja seurojen sijainnit.",
      },
    ],
  }),
  component: SettingsGate,
});

function SettingsGate() {
  const { role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (!role) return <Navigate to="/login" />;
  return <SettingsPage />;
}

function SettingsPage() {
  const [refreshSec, setRefreshSec] = useRefreshIntervalSec();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h1 className="flex-1 text-base font-semibold">Asetukset</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold">Päivitystiheys</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Kuinka usein etusivun lajit ja tulokset haetaan automaattisesti.
          </p>
          <div className="flex flex-wrap gap-2">
            {REFRESH_OPTIONS.map((opt) => {
              const on = opt === refreshSec;
              return (
                <button
                  key={opt}
                  onClick={() => setRefreshSec(opt)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  {opt < 60 ? `${opt} s` : `${opt / 60} min`}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold">Seurojen sijainnit</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Hallinnoi seurojen kotipaikkoja ja koordinaatteja kauden tilastoja
            varten.
          </p>
          <Link
            to="/admin/club-locations"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            <MapPin className="h-4 w-4" />
            Avaa seurojen sijainnit
          </Link>
        </section>
      </main>
    </div>
  );
}
