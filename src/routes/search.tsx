import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/lahden-ahkera-logo.png";

import { fetchProperties } from "@/lib/tuloslista";
import { useCompetitionId } from "@/lib/competition-store";
import { Button } from "@/components/ui/button";
import { AthleteSearch } from "@/components/AthleteSearch";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Hae nimellä – kisahaku" },
      {
        name: "description",
        content: "Hae osallistujaa sukunimellä ja näe lajit, juoksuerät ja aikataulu.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [competitionId] = useCompetitionId();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    fetchProperties(competitionId)
      .then((p) => setName(p?.Competition?.Name ?? ""))
      .catch(() => undefined);
  }, [competitionId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <img
            src={logo}
            alt="Lahden Ahkera"
            className="h-10 w-10 shrink-0 rounded-md object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              {name || `Kisa #${competitionId}`}
            </h1>
            <p className="truncate text-xs text-muted-foreground">Hae sukunimellä</p>
          </div>
          <h2 className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-3xl font-black uppercase tracking-widest text-primary lg:block">
            Hae osallistujaa
          </h2>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <AthleteSearch competitionId={competitionId} autoFocus />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lähde: live.tuloslista.com
        </p>
      </main>
    </div>
  );
}
