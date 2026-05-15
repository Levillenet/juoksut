import { useEffect } from "react";
import { trackEvent, type AnalyticsEvent } from "@/lib/analytics";

export function useTrackView(event: AnalyticsEvent, metadata?: Record<string, unknown>) {
  useEffect(() => {
    trackEvent(event, { metadata });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
