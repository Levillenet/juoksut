// Edge Function: compute-duration-stats
// Aggregates athlete_results.captured_at into per-(event_name, group_name) duration stats.
// Auth: requires authenticated caller with admin role (is_admin_user RPC).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Row {
  competition_id: number;
  event_id: number;
  event_name: string;
  age_class: string;
  sub_category: string;
  event_category: string;
  captured_at: string;
  athlete_key: string;
}

interface RunAgg {
  min: number;
  max: number;
  athletes: Set<string>;
  event_name: string;
  age_class: string;
  sub_category: string;
  event_category: string;
}

interface StatAgg {
  durations: number[];
  participants: number[];
  subCounts: Map<string, number>;
  catCounts: Map<string, number>;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function dominant(map: Map<string, number>): string {
  let best = "";
  let bestN = -1;
  for (const [k, v] of map) {
    if (v > bestN) { bestN = v; best = k; }
  }
  return best;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const t0 = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin_user");
  if (adminErr || !isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden", detail: adminErr?.message }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const runs = new Map<string, RunAgg>();
  const PAGE = 1000; // Supabase Data API caps SELECT at 1000 rows per request
  let from = 0;
  let rowsProcessed = 0;

  while (true) {
    const { data, error } = await admin
      .from("athlete_results")
      .select("competition_id,event_id,event_name,age_class,sub_category,event_category,captured_at,athlete_key")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      return new Response(JSON.stringify({ error: "Read failed", detail: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data || data.length === 0) break;
    rowsProcessed += data.length;

    for (const r of data as Row[]) {
      if (!r.captured_at || !r.event_name || !r.age_class) continue;
      const ts = Date.parse(r.captured_at);
      if (!Number.isFinite(ts)) continue;
      const day = r.captured_at.slice(0, 10);
      const key = `${r.competition_id}|${r.event_id}|${day}`;
      let agg = runs.get(key);
      if (!agg) {
        agg = {
          min: ts, max: ts, athletes: new Set(),
          event_name: r.event_name, age_class: r.age_class,
          sub_category: r.sub_category ?? "", event_category: r.event_category ?? "",
        };
        runs.set(key, agg);
      } else {
        if (ts < agg.min) agg.min = ts;
        if (ts > agg.max) agg.max = ts;
      }
      if (r.athlete_key) agg.athletes.add(r.athlete_key);
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  const runsConsidered = runs.size;
  const stats = new Map<string, StatAgg>();
  let runsAccepted = 0;

  for (const agg of runs.values()) {
    const durationMin = (agg.max - agg.min) / 60000;
    const participants = agg.athletes.size;
    if (durationMin < 1 || durationMin > 600) continue;
    if (participants < 2) continue;
    runsAccepted++;

    const key = `${agg.event_name}|${agg.age_class}`;
    let s = stats.get(key);
    if (!s) {
      s = { durations: [], participants: [], subCounts: new Map(), catCounts: new Map() };
      stats.set(key, s);
    }
    s.durations.push(durationMin);
    s.participants.push(participants);
    s.subCounts.set(agg.sub_category, (s.subCounts.get(agg.sub_category) ?? 0) + 1);
    s.catCounts.set(agg.event_category, (s.catCounts.get(agg.event_category) ?? 0) + 1);
  }

  const upsertRows: Array<Record<string, unknown>> = [];
  let skippedLowN = 0;

  for (const [key, s] of stats) {
    if (s.durations.length < 3) { skippedLowN++; continue; }
    const sortedD = [...s.durations].sort((a, b) => a - b);
    const sortedP = [...s.participants].sort((a, b) => a - b);
    const [event_name, group_name] = key.split("|");
    upsertRows.push({
      event_name,
      group_name,
      category: dominant(s.catCounts),
      sub_category: dominant(s.subCounts),
      n_samples: s.durations.length,
      median_duration_min: percentile(sortedD, 0.5),
      p10_duration_min: percentile(sortedD, 0.10),
      p90_duration_min: percentile(sortedD, 0.90),
      median_participants: percentile(sortedP, 0.5),
      max_participants: Math.max(...s.participants),
      last_updated: new Date().toISOString(),
    });
  }

  const runStartIso = new Date(t0).toISOString();
  const CHUNK = 500;
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const chunk = upsertRows.slice(i, i + CHUNK);
    const { error } = await admin
      .from("event_duration_stats")
      .upsert(chunk, { onConflict: "event_name,group_name" });
    if (error) {
      return new Response(JSON.stringify({ error: "Upsert failed", detail: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { count: deletedCount, error: delErr } = await admin
    .from("event_duration_stats")
    .delete({ count: "exact" })
    .lt("last_updated", runStartIso);

  const sample = [...upsertRows]
    .sort((a, b) => (b.n_samples as number) - (a.n_samples as number))
    .slice(0, 10)
    .map((r) => ({
      event_name: r.event_name,
      group_name: r.group_name,
      n_samples: r.n_samples,
      median_duration_min: Number((r.median_duration_min as number).toFixed(1)),
      p10_duration_min: Number((r.p10_duration_min as number).toFixed(1)),
      p90_duration_min: Number((r.p90_duration_min as number).toFixed(1)),
      median_participants: Number((r.median_participants as number).toFixed(1)),
      max_participants: r.max_participants,
    }));

  return new Response(JSON.stringify({
    ok: true,
    rows_processed: rowsProcessed,
    runs_considered: runsConsidered,
    runs_accepted: runsAccepted,
    stats_upserted: upsertRows.length,
    stats_skipped_low_n: skippedLowN,
    stats_deleted_stale: deletedCount ?? 0,
    stats_delete_error: delErr?.message ?? null,
    duration_ms: Date.now() - t0,
    sample_results: sample,
  }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
