// Proxy-reitti tuloslistan /results/{id}/{eventId} -endpointille.
// TTL säädetään dynaamisesti kierrosten statuksen mukaan (resultsTtl).
import { createFileRoute } from "@tanstack/react-router";
import { proxyTuloslista, resultsTtl } from "@/lib/tuloslista-proxy";

export const Route = createFileRoute(
  "/api/public/tuloslista/live/v1/results/$id/$eventId",
)({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        return proxyTuloslista(
          `/live/v1/results/${params.id}/${params.eventId}`,
          resultsTtl,
          request,
        );
      },
    },
  },
});
