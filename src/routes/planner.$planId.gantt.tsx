import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  type PlanRow,
  type VenueRow,
  type PlanEventRow,
  type ScheduleItemRow,
} from "@/lib/planner-types";
import { detectConflicts } from "@/lib/planner-solver";
import { PlannerFullGantt } from "@/components/planner/PlannerFullGantt";

export const Route = createFileRoute("/planner/$planId/gantt")({
  component: PlannerFullGanttPage,
});

function PlannerFullGanttPage() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate({ to: "/planner/$planId", params: { planId } });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, planId]);

  const planQ = useQuery({
    queryKey: ["planner", "plan", planId],
    queryFn: async (): Promise<PlanRow> => {
      const { data, error } = await supabase
        .from("competition_plans")
        .select("*")
        .eq("id", planId)
        .single();
      if (error) throw error;
      return data as unknown as PlanRow;
    },
  });
  const venuesQ = useQuery({
    queryKey: ["planner", "venues", planId],
    queryFn: async (): Promise<VenueRow[]> => {
      const { data, error } = await supabase
        .from("plan_venues")
        .select("*")
        .eq("plan_id", planId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as VenueRow[];
    },
  });
  const eventsQ = useQuery({
    queryKey: ["planner", "events", planId],
    queryFn: async (): Promise<PlanEventRow[]> => {
      const { data, error } = await supabase
        .from("plan_events")
        .select("*")
        .eq("plan_id", planId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as PlanEventRow[];
    },
  });
  const scheduleQ = useQuery({
    queryKey: ["planner", "schedule", planId],
    queryFn: async (): Promise<ScheduleItemRow[]> => {
      const { data, error } = await supabase
        .from("plan_schedule_items")
        .select("*")
        .eq("plan_id", planId)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as ScheduleItemRow[];
    },
  });

  const plan = planQ.data;
  const venues = venuesQ.data ?? [];
  const events = eventsQ.data ?? [];
  const schedule = scheduleQ.data ?? [];

  const conflicts = useMemo(
    () =>
      plan ? detectConflicts(schedule, events, venues, plan.default_recovery_min) : [],
    [schedule, events, venues, plan],
  );

  if (planQ.isLoading || !plan) {
    return <div className="p-8 text-sm">Ladataan…</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-2">
        <Link
          to="/planner/$planId"
          params={{ planId }}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="flex-1 truncate text-sm font-semibold">{plan.name} — graafinen aikataulu</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <PlannerFullGantt
          plan={plan}
          venues={venues}
          events={events}
          schedule={schedule}
          conflicts={conflicts}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ["planner", "schedule", planId] });
            qc.invalidateQueries({ queryKey: ["planner", "events", planId] });
          }}
        />
      </div>
    </div>
  );
}
