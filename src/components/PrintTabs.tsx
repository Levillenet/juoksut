import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useCompetitionId } from "@/lib/competition-store";
import { YAG_COMPETITION_ID } from "@/data/yag-calling";

export function PrintTabs() {
  const { role } = useAuth();
  const { pathname } = useLocation();
  const [competitionId] = useCompetitionId();
  const isYag = competitionId === YAG_COMPETITION_ID;

  const tabs: Array<{
    to: string;
    label: string;
    shortLabel: string;
    show: boolean;
  }> = [
    { to: "/print", label: "Kilpailun aikataulu", shortLabel: "Aikataulu", show: true },
    { to: "/print/club", label: "Seuran urheilijat", shortLabel: "Seura", show: true },
    { to: "/print/club-report", label: "Seuran kisaraportti", shortLabel: "Raportti", show: true },
    { to: "/print/club-team-report", label: "Joukkuekisa (kentät)", shortLabel: "Joukkue", show: true },
    { to: "/print/watched", label: "Omat urheilijat", shortLabel: "Omat", show: role === "user" },
    { to: "/print/yag-calling", label: "YAG Calling", shortLabel: "YAG", show: role === "user" || isYag },
  ];

  const visible = tabs.filter((t) => t.show);

  return (
    <nav className="border-b bg-background/95 print:hidden">
      <div
        className="mx-auto grid max-w-3xl gap-1.5 px-3 py-2.5 sm:flex sm:gap-2 sm:overflow-x-auto sm:px-4"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0,1fr))` }}
      >
        {visible.map((t) => {
          const active =
            t.to === "/print"
              ? pathname === "/print" || pathname === "/print/"
              : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`truncate rounded-full px-2 py-1.5 text-center text-[12px] font-semibold transition-colors sm:shrink-0 sm:px-4 sm:py-2 sm:text-sm ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              <span className="sm:hidden">{t.shortLabel}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
