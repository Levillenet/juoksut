// Proxy-reitti tuloslistan /competition/{id} -endpointille (aikataulu).
import { createFileRoute } from "@tanstack/react-router";
import { proxyTuloslista, scheduleTtl } from "@/lib/tuloslista-proxy";

export const Route = createFileRoute("/api/public/tuloslista/live/v1/competition/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        return proxyTuloslista(`/live/v1/competition/${params.id}`, scheduleTtl);
      },
    },
  },
});
