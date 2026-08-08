import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/toimitsija")({
  head: () => ({
    meta: [
      { title: "Kilpailun järjestelyt, toimitsijat ja talkooväki" },
      {
        name: "description",
        content:
          "Kenttälajien toimitsijasuunnittelu sekä talkoo- ja järjestelytehtävät: ryhmät, ilmoittautumiset ja aikataulut.",
      },
      { property: "og:title", content: "Kilpailun järjestelyt, toimitsijat ja talkooväki" },
      {
        property: "og:description",
        content:
          "Toimitsijaprofiilit, automaattiset toimitsijaehdotukset sekä talkooryhmien kokoaminen kilpailun järjestelytehtäviin.",
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
