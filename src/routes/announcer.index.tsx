import { useEffect, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LayoutGrid, Activity, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/lahden-ahkera-logo.png";

const STORAGE_KEY = "announcer.preferredMode";
type Mode = "combined" | "live" | "planning";

export const Route = createFileRoute("/announcer/")({
  validateSearch: (s: Record<string, unknown>) => ({
    pick: s.pick === 1 || s.pick === "1" ? 1 : undefined,
  }),
  component: AnnouncerPicker,
});

const MODES: {
  id: Mode;
  to: "/announcer/combined" | "/announcer/live" | "/announcer/planning";
  title: string;
  badge: string;
  badgeTone: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "combined",
    to: "/announcer/combined",
    title: "Yhdistetty näkymä",
    badge: "YHDISTETTY",
    badgeTone: "bg-primary/15 text-primary border-primary/40",
    description:
      "Koko kuuluttajan dashboard yhdellä näytöllä. Sopii yhden laitteen käyttöön tai isolle ruudulle.",
    icon: <LayoutGrid className="h-6 w-6" />,
  },
  {
    id: "live",
    to: "/announcer/live",
    title: "Live-näkymä",
    badge: "LIVE",
    badgeTone: "bg-red-500/15 text-red-700 border-red-500/40 dark:text-red-300",
    description:
      "Mitä juuri nyt kuulutan: uudet ennätykset koko leveydellä ja käynnissä olevat lajit avoimina kortteina.",
    icon: <Activity className="h-6 w-6" />,
  },
  {
    id: "planning",
    to: "/announcer/planning",
    title: "Suunnittelu-näkymä",
    badge: "SUUNNITTELU",
    badgeTone: "bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-300",
    description:
      "Mitä valmistelen seuraavaksi: koko päivän tulevat lajit ja jo päättyneet kertaukseen.",
    icon: <Clock className="h-6 w-6" />,
  },
];

function AnnouncerPicker() {
  const { pick } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    if (pick) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Mode | null;
      if (saved && MODES.some((m) => m.id === saved)) {
        const target = MODES.find((m) => m.id === saved)!.to;
        navigate({ to: target, replace: true });
      }
    } catch {
      /* ignore */
    }
  }, [pick, navigate]);

  const choose = (mode: Mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-6 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <img
            src={logo}
            alt="Lahden Ahkera"
            className="h-12 w-12 shrink-0 rounded-lg object-contain"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight">
              Kuuluttajan moodit
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Valitse tämän laitteen näkymä — valinta muistetaan seuraavalle
              käynnille.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          {MODES.map((m) => (
            <Link
              key={m.id}
              to={m.to}
              onClick={() => choose(m.id)}
              className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  {m.icon}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${m.badgeTone}`}
                >
                  {m.badge}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold leading-tight">{m.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>
              </div>
              <span className="mt-auto text-sm font-semibold text-primary group-hover:underline">
                Avaa →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Vinkki: avaa kahdella tabletilla — toinen Live-moodissa, toinen
          Suunnittelu-moodissa.
        </p>
      </main>
    </div>
  );
}
