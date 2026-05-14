import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/print")({
  component: PrintLayout,
});

function PrintLayout() {
  const { role } = useAuth();
  const { pathname } = useLocation();

  const tabs: Array<{ to: string; label: string; show: boolean }> = [
    { to: "/print", label: "Kisojen lajiaikataulu", show: true },
    { to: "/print/club", label: "Seuran urheilijat", show: true },
    { to: "/print/watched", label: "Omat seurannassa", show: role === "user" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/95 print:hidden">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 py-2">
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
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
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
      <Outlet />
    </div>
  );
}
