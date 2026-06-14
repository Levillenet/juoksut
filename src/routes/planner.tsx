import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

const ADMIN_EMAIL = "samiaavikko@gmail.com";

export const Route = createFileRoute("/planner")({
  head: () => ({ meta: [{ title: "Aikataulun suunnittelija" }] }),
  component: Gate,
});

function Gate() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  if ((user.email ?? "").toLowerCase() !== ADMIN_EMAIL) return <Navigate to="/" />;
  return <Outlet />;
}
