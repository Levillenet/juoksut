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
import { isTuloslistaPollingWindow } from "@/lib/helsinki-time";

const API = "https://cached-public-api.tuloslista.com/live/v1";
const UA = "juoksut-harvester/1.1 (+https://tulokset.online)";

const BATCH_SIZE = 20;      // uusia kisoja per taustatyön ajo (worker-budjetti)
const CONCURRENCY = 2;      // rinnakkaiset kisat per chunk
const HOT_BATCH_SIZE = 8;
const BACKGROUND_LOOKBACK_DAYS = 14;
const HOT_EVENT_PAST_WINDOW_MS = 4 * 60 * 60 * 1000;
const HOT_EVENT_FUTURE_WINDOW_MS = 20 * 60 * 1000;
const HOT_MAX_EVENTS_PER_COMPETITION = 30;

type RunState = {
  source: CounterSource;
  rateLimited: boolean;
  lastApiMessage: string | null;
  proxyOrigin: string | null;
};

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
  [date: string]: {
    EventId: number;
    GroupName?: string;
    BeginDateTimeWithTZ?: string;
    Status?: string;
  }[];
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

async function fetchJson<T>(url: string, state: RunState): Promise<T | null> {
  // Erota tuloslistan polku URL:sta laskuria varten (`/live/v1/...`).
  const pathForCounter = url.startsWith(API)
    ? "/live/v1" + url.slice(API.length)
    : url;
  const requestUrl = state.proxyOrigin
    ? `${state.proxyOrigin}/api/public/tuloslista${pathForCounter}`
    : url;
  try {
    const headers: Record<string, string> = {
      "User-Agent": UA,
      accept: "application/json",
    };
    // Kun kutsu menee sisäisen proxyn läpi, kerro proxylle todellinen lähde
    // jotta origin_call_daily-taulussa harvester ja hot_cycle näkyvät
    // omilla lähteillään eivätkä sekoitu käyttäjien selainpyyntöihin.
    if (state.proxyOrigin) {
      headers["x-origin-source"] = state.source;
    }
    const r = await fetch(requestUrl, { headers });
    if (!state.proxyOrigin) bumpOriginCall(state.source, pathForCounter, r.status);
    if (r.status === 429 || r.status === 503) {
      state.rateLimited = true;
      return null;
    }
    if (!r.ok) return null;
    const contentType = (r.headers.get("content-type") ?? "").toLowerCase();
    const text = await r.text();
    const msg = detectApiMessage(text);
    if (msg) {
      state.lastApiMessage = msg;
      state.rateLimited = true;
      return null;
    }
    if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    if (!state.proxyOrigin) bumpOriginCall(state.source, pathForCounter, 0);
    return null;
  }
}


function jitter() {
  return new Promise((res) => setTimeout(res, 50 + Math.random() * 100));
}

function athleteKey(surname: string, firstname: string, orgId: number | null) {
  return `${surname}|${firstname}|${orgId ?? ""}`;
}

function parseCompetitionDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const native = new Date(trimmed);
  if (!Number.isNaN(native.getTime())) return native;

  const finnish = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (finnish) {
    const day = Number(finnish[1]);
    const month = Number(finnish[2]);
    let year = Number(finnish[3]);
    if (year < 100) year += 2000;
    const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function isRecentCompetitionDate(value: string | null | undefined): boolean {
  const parsed = parseCompetitionDate(value);
  if (!parsed) return true;
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - BACKGROUND_LOOKBACK_DAYS);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 2);
  end.setUTCHours(23, 59, 59, 999);
  return parsed >= start && parsed <= end;
}

function roundTimeMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function selectHotEventIds(rounds: RoundsByDateShape[string]): Set<number> {
  const now = Date.now();
  const selected = rounds
    .filter((r) => {
      const status = r.Status ?? "";
      if (status === "Progress") return true;
      const startsAt = roundTimeMs(r.BeginDateTimeWithTZ);
      if (startsAt == null) return status === "Allocated";
      if (startsAt > now + HOT_EVENT_FUTURE_WINDOW_MS) return false;
      if (status === "Official") return startsAt >= now - 90 * 60 * 1000;
      return startsAt >= now - HOT_EVENT_PAST_WINDOW_MS;
    })
    .sort((a, b) => {
      const aProgress = a.Status === "Progress" ? 0 : 1;
      const bProgress = b.Status === "Progress" ? 0 : 1;
      if (aProgress !== bProgress) return aProgress - bProgress;
      const at = roundTimeMs(a.BeginDateTimeWithTZ) ?? 0;
      const bt = roundTimeMs(b.BeginDateTimeWithTZ) ?? 0;
      return Math.abs(at - now) - Math.abs(bt - now);
    })
    .map((r) => r.EventId);

  return new Set(Array.from(new Set(selected)).slice(0, HOT_MAX_EVENTS_PER_COMPETITION));
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

function helsinkiDateISO(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return null;
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(t);
  return parts; // YYYY-MM-DD
}

async function processCompetition(
  id: number,
  pending: Row[],
  pendingLegs: RelayLegRow[],
  competitionDateHint: string | null,
  state: RunState,
  options: { hotEventsOnly?: boolean } = {},
): Promise<{ existed: boolean; rowsAdded: number; competitionDate: string | null; lastEventDate: string | null }> {
  const props = await fetchJson<PropertiesShape>(
    `${API}/competition/${id}/properties`,
    state,
  );
  if (!props?.Competition?.Id) return { existed: false, rowsAdded: 0, competitionDate: competitionDateHint, lastEventDate: null };
  const competitionDate = props.Competition?.BeginDate ?? competitionDateHint;
  const byDate = await fetchJson<RoundsByDateShape>(`${API}/competition/${id}`, state);
  if (!byDate) return { existed: true, rowsAdded: 0, competitionDate, lastEventDate: null };
  const scheduleRounds = Object.values(byDate).flat();
  // Viimeisen erän Helsinki-päivä — monipäiväisten kisojen tunnistus.
  let lastEventDate: string | null = null;
  for (const r of scheduleRounds) {
    const d = helsinkiDateISO(r.BeginDateTimeWithTZ);
    if (d && (!lastEventDate || d > lastEventDate)) lastEventDate = d;
  }
  const ageByEvent = new Map<number, string>();
  for (const r of scheduleRounds) {
      if (!ageByEvent.has(r.EventId)) ageByEvent.set(r.EventId, r.GroupName ?? "");
  }
  const hotEventIds = options.hotEventsOnly ? selectHotEventIds(scheduleRounds) : null;
  const eventIds = Array.from(ageByEvent.keys()).filter((eventId) =>
    hotEventIds ? hotEventIds.has(eventId) : true,
  );
  if (options.hotEventsOnly && eventIds.length === 0) {
    return { existed: true, rowsAdded: 0, competitionDate, lastEventDate };
  }

  let rowsAdded = 0;
  for (const eid of eventIds) {
    const ev = await fetchJson<EventShape>(`${API}/results/${id}/${eid}`, state);
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
  return { existed: true, rowsAdded, competitionDate, lastEventDate };
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
  state: RunState,
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
    last_event_date?: string | null;
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
    if (state.rateLimited) break;
    const chunk = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (e) => {
        await jitter();
        return processCompetition(e.id, pending, pendingLegs, e.date, state);
      }),
    );
    const nowIso = new Date().toISOString();
    const hkiToday = helsinkiDateISO(nowIso);
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
        // Monipäiväiset kisat: älä merkitse done=true niin kauan kuin
        // viimeinen tapahtumapäivä on tänään tai tulevaisuudessa Helsinki-
        // ajassa. Muuten myöhemmin päivän aikana ajetut lajit (esim. 800m,
        // finaalit) eivät koskaan päivity, koska done=true suodattaa kisan
        // ulos rescan-listalta.
        const lastEv = v.lastEventDate ?? e.date ?? null;
        const stillOngoing =
          hkiToday != null && lastEv != null && lastEv >= hkiToday;
        scanRecords.push({
          competition_id: e.id,
          competition_date: v.competitionDate ?? e.date ?? null,
          row_count: v.rowsAdded,
          exists_in_source: v.existed,
          done: !stillOngoing,
          last_scanned_at: nowIso,
          first_scanned_at: firstSeenMap.get(e.id) ?? nowIso,
          last_event_date: v.lastEventDate ?? null,
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

async function persistApiMessageIfAny(state: RunState): Promise<void> {
  if (!state.lastApiMessage) return;
  await supabaseAdmin
    .from("harvest_state")
    .update({
      last_api_message: state.lastApiMessage,
      last_api_message_at: new Date().toISOString(),
      last_api_message_source: state.source,
      last_api_message_endpoint: null,
    })
    .eq("id", "singleton");
}

async function run(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!isTuloslistaPollingWindow()) {
    return Response.json({ ok: true, skipped: "night-window" });
  }

  // Hotlist-tila: käynnissä olevien kisojen sykli. Ei kosketa
  // harvest_competitions.done-merkintää, jotta hot cycle voi käydä
  // samassa kuluvan päivän kisassa monta kertaa päivän aikana.
  const idsParam = url.searchParams.get("ids");
  const isHotMode = url.searchParams.get("mode") === "hot" || idsParam != null;
  if (isHotMode) {
    const state: RunState = {
      source: "hot_cycle",
      rateLimited: false,
      lastApiMessage: null,
      proxyOrigin: url.origin,
    };
    let hotIds: number[] = [];
    if (idsParam) {
      hotIds = Array.from(
        new Set(
          idsParam
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      ).slice(0, HOT_BATCH_SIZE);
    } else {
      const { data, error } = await supabaseAdmin.rpc("get_hot_competition_ids");
      if (error) {
        console.error("get_hot_competition_ids error:", error.message);
      }
      hotIds = Array.from(
        new Set(
          ((data ?? []) as Array<number | { get_hot_competition_ids?: number }>)
            .map((row) => (typeof row === "number" ? row : row.get_hot_competition_ids))
            .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0),
        ),
      ).slice(0, HOT_BATCH_SIZE);
    }
    if (hotIds.length === 0) {
      return Response.json({ ok: true, skipped: "no-hot-ids", mode: "hotlist" });
    }

    const { data: lockData } = await supabaseAdmin.rpc("harvest_try_lock");
    if (lockData !== true) {
      return Response.json({ ok: true, skipped: "locked", mode: "hotlist" });
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
    const pending: Row[] = [];
    const pendingLegs: RelayLegRow[] = [];
    const touched = new Set<number>();
    let scanned = 0;
    let existed = 0;
    for (let i = 0; i < hotIds.length; i += CONCURRENCY) {
      if (state.rateLimited) break;
      const chunk = hotIds.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (id) => {
          await jitter();
          return processCompetition(id, pending, pendingLegs, null, state, {
            hotEventsOnly: true,
          });
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
    await persistApiMessageIfAny(state);
    return Response.json({
      ok: true,
      mode: "hotlist",
      scanned,
      existed,
      rateLimited: state.rateLimited,
      apiMessage: state.lastApiMessage,
      ids: hotIds,
    });
    } finally {
      await supabaseAdmin.rpc("harvest_unlock");
    }
  }

  // Taustatyö: hae kisalista ja poimi uudet ID:t joita ei vielä ole
  // skannattu (done=false tai puuttuu kokonaan). Ei arvauksia, ei
  // revisit-kierroksia.
  const state: RunState = {
    source: "harvester",
    rateLimited: false,
    lastApiMessage: null,
    proxyOrigin: url.origin,
  };
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

    const compList = await fetchJson<CompetitionListEntry[]>(`${API}/competition`, state);
    if (!Array.isArray(compList)) {
      return Response.json({
        ok: false,
        error: "competition-list-unavailable",
        rateLimited: state.rateLimited,
        apiMessage: state.lastApiMessage,
      });
    }

    // Kaikki listalta löytyvät kelvolliset ID:t (uusimmat ensin).
    const listed = compList
      .filter((c): c is { Id: number; Date?: string } => typeof c.Id === "number")
      .map((c) => ({ id: c.Id, date: c.Date ?? null }))
      .filter((c) => isRecentCompetitionDate(c.date))
      .sort((a, b) => b.id - a.id);

    // Jo valmiiksi merkityt ID:t → jätetään pois. Poikkeus: viimeisen
    // kolmen päivän kisat rescanataan aina, jotta monipäiväiset kisat
    // päivittyvät (uusi last_event_date + uudet tulokset saadaan mukaan).
    const hkiTodayIso = helsinkiDateISO(new Date().toISOString());
    const rescanCutoff = hkiTodayIso
      ? new Date(new Date(hkiTodayIso).getTime() - 2 * 86400_000).toISOString().slice(0, 10)
      : null;
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

    const pending = listed.filter((e) => {
      if (!doneSet.has(e.id)) return true;
      // Rescanataan viimeisen 3 päivän listalla olevat kisat.
      if (rescanCutoff && e.date && e.date >= rescanCutoff) return true;
      return false;
    });

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

    const result = await harvestIds(batch, state);

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
      rateLimited: state.rateLimited,
    });
  } finally {
    await persistApiMessageIfAny(state);
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
