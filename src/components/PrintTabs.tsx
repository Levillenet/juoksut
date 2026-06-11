import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useCompetitionId } from "@/lib/competition-store";
import { YAG_COMPETITION_ID } from "@/data/yag-calling";

export function PrintTabs() {
  const { role } = useAuth();
  const { pathname } = useLocation();
  const [competitionId] = useCompetitionId();
  const isYag = competitionId === YAG_COMPETITION_ID;

  const tabs: Array<{ to: string; label: string; show: boolean }> = [
    { to: "/print", label: "Kilpailun aikataulu", show: true },
    { to: "/print/club", label: "Seuran urheilijat", show: true },
    { to: "/print/watched", label: "Omat urheilijat", show: role === "user" },
    { to: "/print/yag-calling", label: "YAG Calling", show: role === "user" || isYag },
  ];

  return (
    <nav className="border-b bg-background/95 print:hidden">
      <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-2.5">
        {tabs
          .filter((t) => t.show)
          .map((t) => {
            const active =
              t.to === "/print"
                ? pathname === "/print" || pathname === "/print/"
                : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
