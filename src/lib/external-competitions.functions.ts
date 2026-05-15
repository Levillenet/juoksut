import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ExternalCompetitionRow {
  source_id: number;
  name: string;
  location: string;
  classification: string;
  start_date: string;
  end_date: string | null;
  registration_deadline: string;
  url: string;
}

export interface ExternalHarvestStateRow {
  last_run_at: string | null;
  last_status: string;
  scanned_count: number;
  upserted_count: number;
}

export const getExternalCompetitions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date();
    const startKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const [list, state] = await Promise.all([
      supabase
        .from("external_competitions")
        .select(
          "source_id, name, location, classification, start_date, end_date, registration_deadline, url",
        )
        .gte("start_date", startKey)
        .order("start_date", { ascending: true })
        .limit(1000),
      supabase
        .from("external_harvest_state")
        .select("last_run_at, last_status, scanned_count, upserted_count")
        .eq("id", "kilpailukalenteri")
        .maybeSingle(),
    ]);

    if (list.error) throw new Error(list.error.message);

    return {
      rows: (list.data ?? []) as ExternalCompetitionRow[],
      state: (state.data ?? null) as ExternalHarvestStateRow | null,
    };
  });
