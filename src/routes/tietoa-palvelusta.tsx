import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AboutServiceContent } from "@/components/AboutServiceContent";

export const Route = createFileRoute("/tietoa-palvelusta")({
  head: () => ({
    meta: [
      { title: "Tärkeää tietoa palvelusta – Lahden Ahkera" },
      {
        name: "description",
        content:
          "Mitä varten tulosseurantapalvelu on tehty ja millä periaatteilla sitä käytetään.",
      },
      { property: "og:title", content: "Tärkeää tietoa palvelusta" },
      {
        property: "og:description",
        content:
          "Mitä varten tulosseurantapalvelu on tehty ja millä periaatteilla sitä käytetään.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Etusivulle
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold">Tärkeää tietoa palvelusta</h1>
        <AboutServiceContent />
      </main>
    </div>
  );
}
