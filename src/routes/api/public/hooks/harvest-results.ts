// Background harvester for tuloslista.com.
//
// ID-lähde: TULOSLISTAN OMA KISALISTA (/live/v1/competition). Emme enää
// arvaa/probaa ID:tä sekventiaalisesti — se aiheutti 404-virheitä joista
// tuloslistan ylläpito valitti. Kukin listalta löytyvä uusi ID skannataan
// kerran, tallennetaan tulokset ja merkitään harvest_competitions.done=true.
// Emme myöskään palaa jo skannattuihin kisoihin taustatyössä.
//
// Käynnissä olevat kisat päivittyvät hot cyclen kautta (?ids=…), joka
// pyörii omalla 15 s syklillä competition_plans-aikataulun mukaan.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseResult } from "@/lib/result-parse";
import { bumpOriginCall, type CounterSource } from "@/lib/origin-call-counter";

const API = "https://cached-public-api.tuloslista.com/live/v1";
const UA = "juoksut-harvester/1.1 (+https://tulokset.online)";

// Ajon aikana asetettu source ("harvester" tai "hot_cycle") — käytetään
// kirjattaessa jokainen tuloslistan origin-kutsu laskuriin.
let currentSource: CounterSource = "harvester";
const BATCH_SIZE = 60;      // uusia kisoja per taustatyön ajo (worker-budjetti)
const CONCURRENCY = 5;      // rinnakkaiset kisat per chunk

// Rate-limit-signaali jaetaan koko ajon kesken. Jos tuloslista alkaa
// palauttaa 429/503 tai välittää viestin ("liikaa kutsuja"), pysäytämme
// ajon ja jätämme loput ID:t seuraavaan ajoon.
let rateLimited = false;
let lastApiMessage: string | null = null;

const API_MESSAGE_PATTERNS: RegExp[] = [
  /lähettää rajapintakutsuja aivan liikaa/i,
  /rajapintakutsuja.*liikaa/i,
  /ole yhteydessä/i,
  /liikaa kutsuja/i,
  /kohtuuton/i,
  /please contact/i,
  /rate.?limit/i,
  /too many requests/i,
];

function detectApiMessage(body: string): string | null {
  if (!body) return null;
  for (const re of API_MESSAGE_PATTERNS) {
    if (re.test(body)) {
      const idx = body.search(re);
      const start = Math.max(0, idx - 80);
      const end = Math.min(body.length, idx + 220);
      return body
        .slice(start, end)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  return null;
}

interface RelayAthlete {
  Id?: number;
  Index?: number;
  Firstname?: string;
  Surname?: string;
  Organization?: { Id?: number; Name?: string } | null;
}

interface Allocation {
  Id?: number;
  Surname?: string;
  Firstname?: string;
  Organization?: { Id?: number; Name?: string } | null;
  Result?: string | null;
  ResultRank?: number | null;
  Wind?: number | null;
  AthleteOrders?: { Index?: number; Athlete?: RelayAthlete }[];
  Athletes?: RelayAthlete[];
}

type RelayLegRow = {
  competition_id: number;
  event_id: number;
  team_alloc_id: number;
  leg_index: number;
  athlete_id: number | null;
  firstname: string;
  surname: string;
  organization: string;
  organization_id: number | null;
  athlete_key: string;
  team_athlete_key: string;
  age_class: string;
  event_name: string;
};

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
  Rounds: { Name?: string; Heats: { Allocations: Allocation[] }[] }[];
}

interface RoundsByDateShape {
  [date: string]: { EventId: number; GroupName?: string }[];
}

interface CompetitionListEntry {
  Id?: number;
  Name?: string;
  Date?: string;
}

function parseResultNumeric(
  text: string,
  category: string,
  subCategory: string,
  eventName: string,
): number | null {
  return parseResult(text, { category, subCategory, eventName });
}

async function fetchJson<T>(url: string): Promise<T | null> {
  // Erota tuloslistan polku URL:sta laskuria varten (`/live/v1/...`).
  const pathForCounter = url.startsWith(API)
    ? "/live/v1" + url.slice(API.length)
    : url;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, accept: "application/json" },
    });
    bumpOriginCall(currentSource, pathForCounter, r.status);
    if (r.status === 429 || r.status === 503) {
      rateLimited = true;
      return null;
    }
    if (!r.ok) return null;
    const contentType = (r.headers.get("content-type") ?? "").toLowerCase();
    const text = await r.text();
    const msg = detectApiMessage(text);
    if (msg) {
      lastApiMessage = msg;
      rateLimited = true;
      return null;
    }
    if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    bumpOriginCall(currentSource, pathForCounter, 0);
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
  result_round_name: string;
};

async function processCompetition(
  id: number,
  pending: Row[],
  pendingLegs: RelayLegRow[],
  competitionDateHint: string | null,
): Promise<{ existed: boolean; rowsAdded: number; competitionDate: string | null }> {
  const props = await fetchJson<PropertiesShape>(
    `${API}/competition/${id}/properties`,
  );
  if (!props?.Competition?.Id) return { existed: false, rowsAdded: 0, competitionDate: competitionDateHint };
  const competitionDate = props.Competition?.BeginDate ?? competitionDateHint;
  const byDate = await fetchJson<RoundsByDateShape>(`${API}/competition/${id}`);
  if (!byDate) return { existed: true, rowsAdded: 0, competitionDate };
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
    const isTrack = category === "Track";
    type Tracked = {
      latest: Row;
      latestRoundIdx: number;
      best: Row | null;
      bestRoundIdx: number;
      bestRoundName: string;
    };
    const tracked = new Map<string, Tracked>();
    const rounds = ev.Rounds ?? [];
    for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
      const r = rounds[rIdx];
      const roundName = r.Name ?? "";
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
            result_numeric: parseResultNumeric(a.Result, category, subCategory, ev.Name),
            result_rank: a.ResultRank ?? null,
            wind: parseWind(a.Wind),
            age_class: ageClass,
            result_round_name: "",
          };
          const prev = tracked.get(key);
          if (!prev) {
            tracked.set(key, {
              latest: row,
              latestRoundIdx: rIdx,
              best: row.result_numeric != null ? row : null,
              bestRoundIdx: row.result_numeric != null ? rIdx : -1,
              bestRoundName: row.result_numeric != null ? roundName : "",
            });
            continue;
          }
          if (rIdx >= prev.latestRoundIdx) {
            prev.latest = row;
            prev.latestRoundIdx = rIdx;
          }
          if (row.result_numeric != null) {
            const cur = prev.best?.result_numeric ?? null;
            let better = false;
            if (cur == null) better = true;
            else if (isTrack) better = row.result_numeric < cur;
            else better = row.result_numeric > cur;
            if (better) {
              prev.best = row;
              prev.bestRoundIdx = rIdx;
              prev.bestRoundName = roundName;
            }
          }
        }
      }
    }
    for (const t of tracked.values()) {
      let out: Row;
      if (isTrack) {
        if (t.latest.result_numeric != null) {
          out = { ...t.latest, result_round_name: "" };
        } else if (t.best) {
          out = { ...t.best, result_round_name: t.bestRoundName };
        } else {
          out = { ...t.latest, result_round_name: "" };
        }
      } else if (t.best) {
        out = { ...t.best, result_round_name: "" };
      } else {
        out = { ...t.latest, result_round_name: "" };
      }
      pending.push(out);
      rowsAdded++;
    }

    if (category === "Relay") {
      for (let rIdx = rounds.length - 1; rIdx >= 0; rIdx--) {
        const r = rounds[rIdx];
        let foundAnyOrders = false;
        for (const h of r.Heats ?? []) {
          for (const a of h.Allocations ?? []) {
            const teamAllocId = a.Id;
            if (teamAllocId == null) continue;
            if (!a.Surname || !a.Firstname) continue;
            const teamOrgId = a.Organization?.Id ?? null;
            const teamKey = athleteKey(a.Surname, a.Firstname, teamOrgId);
            const orders = (a.AthleteOrders ?? [])
              .map((o) => ({
                idx: o.Index ?? o.Athlete?.Index ?? null,
                ath: o.Athlete,
              }))
              .filter((x): x is { idx: number; ath: RelayAthlete } => x.idx != null && !!x.ath);
            const source =
              orders.length > 0
                ? orders
                : (a.Athletes ?? [])
                    .map((ath) => ({ idx: ath.Index ?? null, ath }))
                    .filter((x): x is { idx: number; ath: RelayAthlete } => x.idx != null);
            if (source.length === 0) continue;
            foundAnyOrders = true;
            for (const { idx, ath } of source) {
              const fn = ath.Firstname ?? "";
              const sn = ath.Surname ?? "";
              if (!fn || !sn) continue;
              const legOrgId = ath.Organization?.Id ?? null;
              pendingLegs.push({
                competition_id: id,
                event_id: ev.Id,
                team_alloc_id: teamAllocId,
                leg_index: idx,
                athlete_id: ath.Id ?? null,
                firstname: fn,
                surname: sn,
                organization: ath.Organization?.Name ?? "",
                organization_id: legOrgId,
                athlete_key: athleteKey(sn, fn, legOrgId),
                team_athlete_key: teamKey,
                age_class: ageClass,
                event_name: ev.Name,
              });
            }
          }
        }
        if (foundAnyOrders) break;
      }
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
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("athlete_results")
      .upsert(slice, {
        onConflict: "athlete_key,competition_id,event_id",
        ignoreDuplicates: false,
      });
    if (error) console.error("upsert error:", error.message);
  }
}

async function flushLegs(rows: RelayLegRow[]) {
  if (rows.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("relay_legs")
      .upsert(slice, {
        onConflict: "competition_id,event_id,team_alloc_id,leg_index",
        ignoreDuplicates: false,
      });
    if (error) console.error("relay_legs upsert error:", error.message);
  }
}

async function harvestIds(
  entries: Array<{ id: number; date: string | null }>,
): Promise<{ scanned: number; existed: number; touchedCompIds: Set<number> }> {
  let scanned = 0;
  let existed = 0;
  const pending: Row[] = [];
  const pendingLegs: RelayLegRow[] = [];
  const touchedCompIds = new Set<number>();
  const scanRecords: Array<{
    competition_id: number;
    competition_date: string | null;
    row_count: number;
    exists_in_source: boolean;
    done: boolean;
    last_scanned_at: string;
    first_scanned_at: string;
  }> = [];

  // Lataa aiemmat first_scanned_at -arvot upsertia varten.
  const firstSeenMap = new Map<number, string>();
  if (entries.length > 0) {
    const ids = entries.map((e) => e.id);
    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data } = await supabaseAdmin
        .from("harvest_competitions")
        .select("competition_id, first_scanned_at")
        .in("competition_id", slice);
      for (const r of data ?? []) {
        if (r.first_scanned_at) firstSeenMap.set(r.competition_id, r.first_scanned_at);
      }
    }
  }

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    if (rateLimited) break;
    const chunk = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (e) => {
        await jitter();
        return processCompetition(e.id, pending, pendingLegs, e.date);
      }),
    );
    const nowIso = new Date().toISOString();
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const e = chunk[j];
      scanned++;
      if (r.status === "fulfilled") {
        const v = r.value;
        if (v.existed) {
          existed++;
          if (v.rowsAdded > 0) touchedCompIds.add(e.id);
        }
        // Merkitään aina done=true — ei revisit-kierroksia. Käynnissä olevat
        // kisat päivittyvät hot cyclen (?ids=…) kautta, ei tätä reittiä.
        scanRecords.push({
          competition_id: e.id,
          competition_date: v.competitionDate ?? e.date ?? null,
          row_count: v.rowsAdded,
          exists_in_source: v.existed,
          done: true,
          last_scanned_at: nowIso,
          first_scanned_at: firstSeenMap.get(e.id) ?? nowIso,
        });
      }
      if (r.status === "rejected") console.error("comp", e.id, r.reason);
    }
    if (pending.length >= 400) await flush(pending.splice(0));
    if (pendingLegs.length >= 400) await flushLegs(pendingLegs.splice(0));
  }
  await flush(pending);
  await flushLegs(pendingLegs);

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

  if (touchedCompIds.size > 0) {
    const ids = Array.from(touchedCompIds);
    let ok = 0;
    let failed = 0;
    for (const cid of ids) {
      const { error } = await supabaseAdmin.rpc("mark_pbs_for_competitions", {
        comp_ids: [cid],
      });
      if (error) {
        failed++;
        console.error(`mark_pbs error comp=${cid}: ${error.message}`);
      } else {
        ok++;
      }
    }
    if (failed > 0) {
      console.error(`mark_pbs summary: ok=${ok} failed=${failed} of ${ids.length}`);
    }
  }

  return { scanned, existed, touchedCompIds };
}

async function persistApiMessageIfAny(): Promise<void> {
  if (!lastApiMessage) return;
  await supabaseAdmin
    .from("harvest_state")
    .update({
      last_api_message: lastApiMessage,
      last_api_message_at: new Date().toISOString(),
      last_api_message_source: "harvester",
      last_api_message_endpoint: null,
    })
    .eq("id", "singleton");
}

async function run(request: Request): Promise<Response> {
  rateLimited = false;
  lastApiMessage = null;

  const url = new URL(request.url);

  // Hotlist-tila: käynnissä olevien kisojen 15 s sykli. Ei kosketa
  // harvest_competitions.done-merkintää, jotta hot cycle voi käydä
  // samassa kisassa monta kertaa päivän aikana.
  const idsParam = url.searchParams.get("ids");
  if (idsParam) {
    currentSource = "hot_cycle";
    const hotIds = Array.from(
      new Set(
        idsParam
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );
    if (hotIds.length === 0) {
      return Response.json({ ok: true, skipped: "no-ids" });
    }
    const { data: stateRow } = await supabaseAdmin
      .from("harvest_state")
      .select("blocked, block_reason")
      .eq("id", "singleton")
      .maybeSingle();
    if (stateRow?.blocked === true) {
      return Response.json({
        ok: true,
        skipped: "blocked",
        reason: stateRow.block_reason ?? null,
      });
    }
    const pending: Row[] = [];
    const pendingLegs: RelayLegRow[] = [];
    const touched = new Set<number>();
    let scanned = 0;
    let existed = 0;
    for (let i = 0; i < hotIds.length; i += CONCURRENCY) {
      if (rateLimited) break;
      const chunk = hotIds.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (id) => {
          await jitter();
          return processCompetition(id, pending, pendingLegs, null);
        }),
      );
      for (let j = 0; j < results.length; j++) {
        scanned++;
        const r = results[j];
        if (r.status === "fulfilled" && r.value.existed) {
          existed++;
          if (r.value.rowsAdded > 0) touched.add(chunk[j]);
        }
      }
    }
    await flush(pending);
    await flushLegs(pendingLegs);
    for (const cid of touched) {
      await supabaseAdmin.rpc("mark_pbs_for_competitions", { comp_ids: [cid] });
    }
    await persistApiMessageIfAny();
    return Response.json({
      ok: true,
      mode: "hotlist",
      scanned,
      existed,
      rateLimited,
      apiMessage: lastApiMessage,
      ids: hotIds,
    });
  }

  // Taustatyö: hae kisalista ja poimi uudet ID:t joita ei vielä ole
  // skannattu (done=false tai puuttuu kokonaan). Ei arvauksia, ei
  // revisit-kierroksia.
  currentSource = "harvester";
  const { data: lockData } = await supabaseAdmin.rpc("harvest_try_lock");
  if (lockData !== true) {
    return Response.json({ ok: true, skipped: "locked" });
  }

  try {
    const { data: stateRow } = await supabaseAdmin
      .from("harvest_state")
      .select("blocked, block_reason")
      .eq("id", "singleton")
      .maybeSingle();
    if (stateRow?.blocked === true) {
      return Response.json({
        ok: true,
        skipped: "blocked",
        reason: stateRow.block_reason ?? null,
      });
    }

    const compList = await fetchJson<CompetitionListEntry[]>(`${API}/competition`);
    if (!Array.isArray(compList)) {
      return Response.json({
        ok: false,
        error: "competition-list-unavailable",
        rateLimited,
        apiMessage: lastApiMessage,
      });
    }

    // Kaikki listalta löytyvät kelvolliset ID:t (uusimmat ensin).
    const listed = compList
      .filter((c): c is { Id: number; Date?: string } => typeof c.Id === "number")
      .map((c) => ({ id: c.Id, date: c.Date ?? null }))
      .sort((a, b) => b.id - a.id);

    // Jo valmiiksi merkityt ID:t → jätetään pois.
    const listedIds = listed.map((e) => e.id);
    const doneSet = new Set<number>();
    const CHUNK = 500;
    for (let i = 0; i < listedIds.length; i += CHUNK) {
      const slice = listedIds.slice(i, i + CHUNK);
      const { data } = await supabaseAdmin
        .from("harvest_competitions")
        .select("competition_id")
        .eq("done", true)
        .in("competition_id", slice);
      for (const r of data ?? []) doneSet.add(r.competition_id);
    }

    const pending = listed.filter((e) => !doneSet.has(e.id));
    const batch = pending.slice(0, BATCH_SIZE);

    if (batch.length === 0) {
      await supabaseAdmin
        .from("harvest_state")
        .update({
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", "singleton");
      return Response.json({
        ok: true,
        mode: "idle",
        listed: listed.length,
        pending: 0,
      });
    }

    const result = await harvestIds(batch);

    const latestId = listed.length > 0 ? listed[0].id : null;
    await supabaseAdmin
      .from("harvest_state")
      .update({
        latest_id: latestId ?? undefined,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton");

    return Response.json({
      ok: true,
      mode: "list",
      listed: listed.length,
      pending: pending.length,
      scanned: result.scanned,
      existed: result.existed,
      rateLimited,
    });
  } finally {
    await persistApiMessageIfAny();
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
