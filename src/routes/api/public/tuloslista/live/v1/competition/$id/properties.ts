// Proxy-reitti tuloslistan /competition/{id}/properties -endpointille.
import { createFileRoute } from "@tanstack/react-router";
import { proxyTuloslista, propertiesTtl } from "@/lib/tuloslista-proxy";

export const Route = createFileRoute(
  "/api/public/tuloslista/live/v1/competition/$id/properties",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        return proxyTuloslista(
          `/live/v1/competition/${params.id}/properties`,
          propertiesTtl,
        );
      },
    },
  },
});
