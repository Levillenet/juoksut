import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/print")({
  component: PrintLayout,
});

function PrintLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
