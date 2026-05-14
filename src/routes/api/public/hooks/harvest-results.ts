// Background harvester for tuloslista.com.
//
// Stores results for ALL athletes in every competition (not just watched),
// so the user-facing dashboard can read history without ever triggering a
// fetch. The job is driven by pg_cron and walks a singleton cursor stored
// in `harvest_state`:
//
//   - On each run it scans BATCH_SIZE competition IDs starting at next_id.
//   - The cursor advances by the number of IDs scanned.
//   - When the cursor catches up with `latest_id` (the most recently
//     observed real competition), the job switches to "tail" mode and
//     re-scans the most recent ~30 IDs so updated/late-uploaded results
//     get refreshed.
//
// Each run is bounded so we stay well within Cloudflare Worker limits.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const API = "https://cached-public-api.tuloslista.com/live/v1";
const BATCH_SIZE = 100;      // competition IDs scanned per invocation
const TAIL_RESCAN = 30;      // IDs to re-scan when caught up
const CONCURRENCY = 5;       // parallel competitions per chunk
const HARD_MAX_ID = 30000;   // safety ceiling

// Soft rate-limit signal shared across the run. If tuloslista.com starts
// returning 429/503 we stop advancing so the cursor can retry these IDs
// on a later run instead of skipping them.
let rateLimited = false;

interface Allocation {
  Surname?: string;
  Firstname?: string;
  Organization?: { Id?: number; Name?: string } | null;
  Result?: string | null;
  ResultRank?: number | null;
  Wind?: number | null;
}

interface PropertiesShape {
  Competition?: {
    Id: number;
    Name?: string;
    BeginDate?: string;
    Organization?: string;
  };
}

interface EventShape {
  Id: number;
  Name: string;
  EventCategory?: string;
  EventSubCategory?: string;
  BeginDateTimeWithTZ?: string;
  Rounds: { Heats: { Allocations: Allocation[] }[] }[];
}

interface RoundsByDateShape {
  [date: string]: { EventId: number; GroupName?: string }[];
}

function parseResultNumeric(text: string, category: string): number | null {
  if (!text) return null;
  const t = text.trim();
  if (!t || /^(DNF|DNS|DQ|NM|FAIL)$/i.test(t)) return null;
  const cleaned = t.replace(",", ".").replace(/[a-zA-Z]/g, "").trim();
  if (!cleaned) return null;
  if (category === "Track") {
    const parts = cleaned.split(":").map((p) => parseFloat(p));
    if (parts.some((n) => Number.isNaN(n))) return null;
    let s = 0;
    for (const p of parts) s = s * 60 + p;
    return s;
  }
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "juoksut-harvester/1.0" },
    });
    if (r.status === 429 || r.status === 503) {
      rateLimited = true;
      return null;
    }
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function jitter() {
  return new Promise((res) => setTimeout(res, 50 + Math.random() * 100));
}

function athleteKey(surname: string, firstname: string, orgId: number | null) {
  return `${surname}|${firstname}|${orgId ?? ""}`;
}

type Row = {
  athlete_key: string;
  surname: string;
  firstname: string;
  organization: string;
  organization_id: number | null;
  competition_id: number;
  competition_name: string;
  competition_date: string | null;
  location: string;
  event_id: number;
  event_name: string;
  sub_category: string;
  event_category: string;
  result_text: string;
  result_numeric: number | null;
  result_rank: number | null;
  wind: number | null;
  age_class: string;
};

async function processCompetition(
  id: number,
  pending: Row[],
): Promise<{ existed: boolean }> {
  const props = await fetchJson<PropertiesShape>(
    `${API}/competition/${id}/properties`,
  );
  if (!props?.Competition?.Id) return { existed: false };
  const byDate = await fetchJson<RoundsByDateShape>(`${API}/competition/${id}`);
  if (!byDate) return { existed: true };
  // Map EventId → GroupName (age class) from the schedule
  const ageByEvent = new Map<number, string>();
  for (const list of Object.values(byDate)) {
    for (const r of list) {
      if (!ageByEvent.has(r.EventId)) ageByEvent.set(r.EventId, r.GroupName ?? "");
    }
  }
  const eventIds = Array.from(ageByEvent.keys());
  for (const eid of eventIds) {
    const ev = await fetchJson<EventShape>(`${API}/results/${id}/${eid}`);
    if (!ev) continue;
    const category = ev.EventCategory ?? "";
    const subCategory = ev.EventSubCategory ?? "";
    const ageClass = ageByEvent.get(eid) ?? "";
    for (const r of ev.Rounds ?? []) {
      for (const h of r.Heats ?? []) {
        for (const a of h.Allocations ?? []) {
          if (!a.Surname || !a.Firstname || !a.Result) continue;
          const orgId = a.Organization?.Id ?? null;
          pending.push({
            athlete_key: athleteKey(a.Surname, a.Firstname, orgId),
            surname: a.Surname,
            firstname: a.Firstname,
            organization: a.Organization?.Name ?? "",
            organization_id: orgId,
            competition_id: id,
            competition_name: props.Competition?.Name ?? "",
            competition_date:
              props.Competition?.BeginDate ?? ev.BeginDateTimeWithTZ ?? null,
            location: "",
            event_id: ev.Id,
            event_name: ev.Name,
            sub_category: subCategory,
            event_category: category,
            result_text: a.Result,
            result_numeric: parseResultNumeric(a.Result, category),
            result_rank: a.ResultRank ?? null,
            wind: a.Wind ?? null,
            age_class: ageClass,
          });

        }
      }
    }
  }
  return { existed: true };
}

async function flush(rows: Row[]) {
  if (rows.length === 0) return;
  // Chunk to keep request bodies small.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("athlete_results")
      .upsert(slice, {
        onConflict: "athlete_key,competition_id,event_id",
        ignoreDuplicates: true,
      });
    if (error) console.error("upsert error:", error.message);
  }
}

async function harvestRange(ids: number[]) {
  let scanned = 0;
  let existed = 0;
  let lastScannedId = ids.length > 0 ? ids[0] - 1 : -1;
  const pending: Row[] = [];
  const touchedCompIds = new Set<number>();

  // Process IDs in chunks of CONCURRENCY in source order, so that if we
  // bail out on rate-limit we know exactly which IDs were attempted.
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    if (rateLimited) break;
    const chunk = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (id) => {
        await jitter();
        return processCompetition(id, pending);
      }),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      scanned++;
      lastScannedId = chunk[j];
      if (r.status === "fulfilled" && r.value.existed) {
        existed++;
        touchedCompIds.add(chunk[j]);
      }
      if (r.status === "rejected") console.error("comp", chunk[j], r.reason);
    }
    if (pending.length >= 400) await flush(pending.splice(0));
  }
  await flush(pending);

  // After all rows are inserted, mark which ones broke the athlete's PB.
  if (touchedCompIds.size > 0) {
    const { error } = await supabaseAdmin.rpc("mark_pbs_for_competitions", {
      comp_ids: Array.from(touchedCompIds),
    });
    if (error) console.error("mark_pbs error:", error.message);
  }

  return { scanned, existed, lastScannedId };
}

async function run(request: Request): Promise<Response> {
  rateLimited = false;
  const url = new URL(request.url);

  // Acquire advisory lock so overlapping cron runs don't double-process.
  const { data: lockData } = await supabaseAdmin.rpc("harvest_try_lock");
  if (lockData !== true) {
    return Response.json({ ok: true, skipped: "locked" });
  }

  try {
    const fromOverride = Number(url.searchParams.get("fromId"));
    const toOverride = Number(url.searchParams.get("toId"));

    const { data: stateRow } = await supabaseAdmin
      .from("harvest_state")
      .select("next_id, latest_id")
      .eq("id", "singleton")
      .maybeSingle();
    let nextId = stateRow?.next_id ?? 17000;
    let latestId = stateRow?.latest_id ?? 17000;

    let ids: number[];
    let mode: "manual" | "backfill" | "tail";

    if (fromOverride && toOverride) {
      ids = [];
      for (let i = fromOverride; i <= Math.min(toOverride, HARD_MAX_ID); i++) ids.push(i);
      mode = "manual";
    } else if (nextId <= latestId + BATCH_SIZE) {
      const start = nextId;
      const end = Math.min(start + BATCH_SIZE - 1, HARD_MAX_ID);
      ids = [];
      for (let i = start; i <= end; i++) ids.push(i);
      mode = "backfill";
    } else {
      const tailStart = Math.max(17000, latestId - TAIL_RESCAN);
      const probeEnd = Math.min(latestId + BATCH_SIZE, HARD_MAX_ID);
      ids = [];
      for (let i = tailStart; i <= probeEnd; i++) ids.push(i);
      mode = "tail";
    }

    const result = await harvestRange(ids);

    // Advance cursor only as far as we actually attempted (so a rate-limit
    // bailout retries the unprocessed IDs on the next run).
    const advancedTo = result.lastScannedId;
    if (mode === "backfill" && advancedTo >= nextId) {
      nextId = advancedTo + 1;
      if (result.existed > 0) latestId = Math.max(latestId, advancedTo);
    } else if (mode === "tail") {
      if (result.existed > 0) {
        latestId = Math.max(latestId, advancedTo);
        nextId = Math.max(nextId, latestId + 1);
      }
    }

    await supabaseAdmin
      .from("harvest_state")
      .update({
        next_id: nextId,
        latest_id: latestId,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton");

    return Response.json({
      ok: true,
      mode,
      scanned: result.scanned,
      existed: result.existed,
      rateLimited,
      fromId: ids[0] ?? null,
      toId: ids[ids.length - 1] ?? null,
      advancedTo,
      nextId,
      latestId,
    });
  } finally {
    await supabaseAdmin.rpc("harvest_unlock");
  }
}

export const Route = createFileRoute("/api/public/hooks/harvest-results")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
