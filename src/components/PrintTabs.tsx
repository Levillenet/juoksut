import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function PrintTabs() {
  const { role } = useAuth();
  const { pathname } = useLocation();

  const tabs: Array<{ to: string; label: string; show: boolean }> = [
    { to: "/print", label: "Kilpailun aikataulu", show: true },
    { to: "/print/club", label: "Seuran urheilijat", show: true },
    { to: "/print/club-report", label: "Seuran kisaraportti", show: true },
    { to: "/print/club-team-report", label: "Joukkuekisa", show: true },
    { to: "/print/watched", label: "Omat urheilijat", show: role === "user" },
  ];

  const visible = tabs.filter((t) => t.show);

  return (
    <nav className="border-b bg-background/95 print:hidden">
      <div className="mx-auto flex max-w-3xl flex-wrap gap-1.5 px-3 py-2.5 sm:gap-2 sm:overflow-x-auto sm:px-4">
        {visible.map((t) => {
          const active =
            t.to === "/print"
              ? pathname === "/print" || pathname === "/print/"
              : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-center text-[12px] font-semibold transition-colors sm:shrink-0 sm:px-4 sm:py-2 sm:text-sm ${
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
