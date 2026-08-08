import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/toimitsija")({
  head: () => ({
    meta: [
      { title: "Toimitsijat – kenttälajien toimitsijasuunnittelu" },
      {
        name: "description",
        content:
          "Luo toimitsijaprofiili, kiinnitä omat urheilijasi ja rakenna kilpailun kenttälajien toimitsijaluettelo.",
      },
      { property: "og:title", content: "Toimitsijat – kenttälajien toimitsijasuunnittelu" },
      {
        property: "og:description",
        content:
          "Toimitsijaprofiilit, käytettävyysilmoitukset ja automaattiset toimitsijaehdotukset kenttälajeihin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
  return <Outlet />;
}
