// Daily cron endpoint that scrapes kilpailukalenteri.fi and upserts the
// athletics competition list into `external_competitions`.
//
// Called by pg_cron over HTTPS. No signature secret; auth is the Supabase
// publishable key in the `apikey` header (same convention as other harvest jobs).

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { scrapeKilpailukalenteri } from "@/lib/external-competitions.server";

async function run(): Promise<Response> {
  const startedAt = new Date().toISOString();
  try {
    const rows = await scrapeKilpailukalenteri(8);
    const nowIso = new Date().toISOString();
    let upserted = 0;
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK).map((r) => ({
        source: "kilpailukalenteri",
        source_id: r.source_id,
        name: r.name,
        location: r.location,
        classification: r.classification,
        start_date: r.start_date,
        end_date: r.end_date,
        registration_deadline: r.registration_deadline,
        organizer: "",
        url: r.url,
        raw: r.raw,
        last_seen_at: nowIso,
      }));
      const { error } = await supabaseAdmin
        .from("external_competitions")
        .upsert(slice, { onConflict: "source,source_id" });
      if (error) {
        console.error("upsert error", error.message);
      } else {
        upserted += slice.length;
      }
    }

    await supabaseAdmin
      .from("external_harvest_state")
      .update({
        last_run_at: nowIso,
        last_status: "ok",
        scanned_count: rows.length,
        upserted_count: upserted,
        updated_at: nowIso,
      })
      .eq("id", "kilpailukalenteri");

    return Response.json({ ok: true, scanned: rows.length, upserted, startedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("harvest-kilpailukalenteri failed", message);
    await supabaseAdmin
      .from("external_harvest_state")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: `error: ${message}`.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", "kilpailukalenteri");
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/harvest-kilpailukalenteri")({
  server: {
    handlers: {
      GET: async () => run(),
      POST: async () => run(),
    },
  },
});
