// Proxy-reitti tuloslistan /competition -endpointille (kisalista).
import { createFileRoute } from "@tanstack/react-router";
import { proxyTuloslista, competitionListTtl } from "@/lib/tuloslista-proxy";

export const Route = createFileRoute("/api/public/tuloslista/live/v1/competition/")({
  server: {
    handlers: {
      GET: async () => {
        return proxyTuloslista(`/live/v1/competition`, competitionListTtl);
      },
    },
  },
});
