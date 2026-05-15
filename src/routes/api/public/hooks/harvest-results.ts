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
const REVISIT_LIMIT = 40;    // tuloksettomien kisojen uudelleentarkistus per ajo
const REVISIT_MAX_AGE_DAYS = 14; // kuinka kauan palataan tyhjiin kisoihin
const CONCURRENCY = 5;       // parallel competitions per chunk
const HARD_MAX_ID = 30000;   // safety ceiling
const FLOOR_ID = 16456;      // tuloslista API:n vanhin saatavilla oleva kisa (5.1.2025)

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
): Promise<{ existed: boolean; rowsAdded: number; competitionDate: string | null }> {
  const props = await fetchJson<PropertiesShape>(
    `${API}/competition/${id}/properties`,
  );
  if (!props?.Competition?.Id) return { existed: false, rowsAdded: 0, competitionDate: null };
  const competitionDate = props.Competition?.BeginDate ?? null;
  const byDate = await fetchJson<RoundsByDateShape>(`${API}/competition/${id}`);
  if (!byDate) return { existed: true, rowsAdded: 0, competitionDate };
  // Map EventId → GroupName (age class) from the schedule
  const ageByEvent = new Map<number, string>();
  for (const list of Object.values(byDate)) {
    for (const r of list) {
      if (!ageByEvent.has(r.EventId)) ageByEvent.set(r.EventId, r.GroupName ?? "");
    }
  }
  const eventIds = Array.from(ageByEvent.keys());
  let rowsAdded = 0;
  for (const eid of eventIds) {
    const ev = await fetchJson<EventShape>(`${API}/results/${id}/${eid}`);
    if (!ev) continue;
    const category = ev.EventCategory ?? "";
    const subCategory = ev.EventSubCategory ?? "";
    const ageClass = ageByEvent.get(eid) ?? "";
    // Lajilla voi olla useita kierroksia (alkuerät + finaali) saman event_id:n
    // alla. Pidetään vain paras tulos per urheilija (Track = pienin numeerinen,
    // muut = suurin). Jos numeerista vertailua ei voi tehdä, otetaan
    // myöhemmin nähty kierros (Rounds-järjestys = aikajärjestys), jolloin
    // finaali korvaa alkuerän.
    const bestForEvent = new Map<string, Row>();
    const isTrack = category === "Track";
    for (const r of ev.Rounds ?? []) {
      for (const h of r.Heats ?? []) {
        for (const a of h.Allocations ?? []) {
          if (!a.Surname || !a.Firstname || !a.Result) continue;
          const orgId = a.Organization?.Id ?? null;
          const key = athleteKey(a.Surname, a.Firstname, orgId);
          const row: Row = {
            athlete_key: key,
            surname: a.Surname,
            firstname: a.Firstname,
            organization: a.Organization?.Name ?? "",
            organization_id: orgId,
            competition_id: id,
            competition_name: props.Competition?.Name ?? "",
            competition_date: competitionDate ?? ev.BeginDateTimeWithTZ ?? null,
            location: "",
            event_id: ev.Id,
            event_name: ev.Name,
            sub_category: subCategory,
            event_category: category,
            result_text: a.Result,
            result_numeric: parseResultNumeric(a.Result, category),
            result_rank: a.ResultRank ?? null,
            wind: parseWind(a.Wind),
            age_class: ageClass,
          };
          const prev = bestForEvent.get(key);
          if (!prev) {
            bestForEvent.set(key, row);
            continue;
          }
          const a1 = row.result_numeric;
          const a0 = prev.result_numeric;
          let replace = false;
          if (a1 != null && a0 != null) {
            replace = isTrack ? a1 < a0 : a1 > a0;
          } else if (a1 != null && a0 == null) {
            replace = true;
          } else if (a1 == null && a0 == null) {
            // molemmat ei-numeerisia (DNF, NM, ...): pidetään myöhempi kierros
            replace = true;
          }
          if (replace) bestForEvent.set(key, row);
        }
      }
    }
    for (const row of bestForEvent.values()) {
      pending.push(row);
      rowsAdded++;
    }
  }
  return { existed: true, rowsAdded, competitionDate };
}

function parseWind(w: unknown): number | null {
  if (w === null || w === undefined || w === "") return null;
  if (typeof w === "number") return Number.isFinite(w) ? w : null;
  if (typeof w === "string") {
    const n = Number(w.replace(",", ".").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
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
  let revisited = 0;
  let lastScannedId = ids.length > 0 ? ids[0] - 1 : -1;
  const pending: Row[] = [];
  const touchedCompIds = new Set<number>();
  const scanRecords: Array<{
    competition_id: number;
    competition_date: string | null;
    row_count: number;
    exists_in_source: boolean;
    done: boolean;
    last_scanned_at: string;
  }> = [];

  const cutoffMs = Date.now() - REVISIT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

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
    const nowIso = new Date().toISOString();
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const id = chunk[j];
      scanned++;
      lastScannedId = id;
      if (r.status === "fulfilled") {
        const v = r.value;
        if (v.existed) {
          existed++;
          if (v.rowsAdded > 0) touchedCompIds.add(id);
        }
        // Päätä onko tämä kisa "done" — eli ei tarvitse palata
        const dateMs = v.competitionDate ? Date.parse(v.competitionDate) : NaN;
        const tooOldToRevisit = Number.isFinite(dateMs) && dateMs < cutoffMs;
        const done = !v.existed || v.rowsAdded > 0 || tooOldToRevisit;
        scanRecords.push({
          competition_id: id,
          competition_date: v.competitionDate,
          row_count: v.rowsAdded,
          exists_in_source: v.existed,
          done,
          last_scanned_at: nowIso,
        });
        if (v.existed && v.rowsAdded === 0) revisited++;
      }
      if (r.status === "rejected") console.error("comp", id, r.reason);
    }
    if (pending.length >= 400) await flush(pending.splice(0));
  }
  await flush(pending);

  // Kirjaa skannauskirjanpito (chunked upsert)
  if (scanRecords.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < scanRecords.length; i += CHUNK) {
      const slice = scanRecords.slice(i, i + CHUNK);
      const { error } = await supabaseAdmin
        .from("harvest_competitions")
        .upsert(slice, { onConflict: "competition_id" });
      if (error) console.error("harvest_competitions upsert:", error.message);
    }
  }

  // After all rows are inserted, mark which ones broke the athlete's PB.
  if (touchedCompIds.size > 0) {
    const { error } = await supabaseAdmin.rpc("mark_pbs_for_competitions", {
      comp_ids: Array.from(touchedCompIds),
    });
    if (error) console.error("mark_pbs error:", error.message);
  }

  return { scanned, existed, revisited, lastScannedId };
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
    let nextId = stateRow?.next_id ?? FLOOR_ID;
    let latestId = stateRow?.latest_id ?? FLOOR_ID;

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
      const tailStart = Math.max(FLOOR_ID, latestId - TAIL_RESCAN);
      const probeEnd = Math.min(latestId + BATCH_SIZE, HARD_MAX_ID);
      ids = [];
      for (let i = tailStart; i <= probeEnd; i++) ids.push(i);
      mode = "tail";
    }

    // Lisää uudelleenkäyntiin kisat, jotka olivat aiemmin tuloksettomia
    // mutta saattavat nyt olla valmiina (esim. tämän päivän kisa). Vain
    // backfill/tail-moodissa, ei manuaalisessa toistossa.
    if (mode !== "manual") {
      const { data: revisitRows } = await supabaseAdmin
        .from("harvest_competitions")
        .select("competition_id")
        .eq("done", false)
        .order("last_scanned_at", { ascending: true })
        .limit(REVISIT_LIMIT);
      const existing = new Set(ids);
      for (const r of (revisitRows ?? []) as Array<{ competition_id: number }>) {
        if (!existing.has(r.competition_id)) ids.push(r.competition_id);
      }
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
      revisited: result.revisited,
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
