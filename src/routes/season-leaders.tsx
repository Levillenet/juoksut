import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/season-leaders")({
  head: () => ({
    meta: [
      { title: "Kauden kärki – Lahden Ahkera" },
      {
        name: "description",
        content: "Kauden kärki -palvelu ei ole vielä käytössä.",
      },
    ],
  }),
  component: SeasonLeadersDisabled,
});

function SeasonLeadersDisabled() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary"
            aria-label="Takaisin"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold leading-tight">Kauden kärki</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-12">
        <div className="rounded-lg border bg-card px-6 py-10 text-center">
          <p className="text-base font-semibold">Palvelu ei käytössä vielä</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Kauden kärki -näkymä on tilapäisesti pois käytöstä.
          </p>
        </div>
      </main>
    </div>
  );
}
