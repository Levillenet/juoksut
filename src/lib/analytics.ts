import { supabase } from "@/integrations/supabase/client";

export type AnalyticsEvent =
  | "page_view"
  | "results_view"
  | "athlete_view"
  | "live_view"
  | "scoreboard_view"
  | "announcer_view"
  | "watch_view"
  | "search_view"
  | "season_leaders_view"
  | "calendar_view"
  | "round_view"
  | "print_view"
  | "settings_view"
  | "running_ops_view";

interface TrackOptions {
  metadata?: Record<string, unknown>;
}

export async function trackEvent(event: AnalyticsEvent, opts: TrackOptions = {}) {
  if (typeof window === "undefined") return;
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    const role = user
      ? "user"
      : typeof localStorage !== "undefined" && localStorage.getItem("tuloslista.official") === "1"
        ? "official"
        : "anon";
    await supabase.from("analytics_events").insert({
      event_name: event,
      path: window.location.pathname,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      role,
      metadata: opts.metadata ?? null,
      user_agent: navigator.userAgent.slice(0, 300),
    });
  } catch (err) {
    // analytics must never break UX
    console.debug("analytics insert failed", err);
  }
}
