import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/announcer")({
  head: () => ({
    meta: [
      { title: "Kuuluttajan dashboard" },
      {
        name: "description",
        content:
          "Kuuluttajan työpöytä: yhdistetty-, live- ja tulosmoodi, sopiva myös kahdelle tabletille rinnan.",
      },
    ],
  }),
  component: () => <Outlet />,
});
