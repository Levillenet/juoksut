import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/planner")({
  head: () => ({ meta: [{ title: "Aikataulun suunnittelija" }] }),
  component: Gate,
});

function Gate() {
  const { user, loading, isPlanner } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  if (!isPlanner) return <Navigate to="/" />;
  return <Outlet />;
}
