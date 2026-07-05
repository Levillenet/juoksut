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
import { parseResult } from "@/lib/result-parse";

const API = "https://cached-public-api.tuloslista.com/live/v1";
const BATCH_SIZE = 100;      // competition IDs scanned per invocation
const TAIL_RESCAN = 30;      // IDs to re-scan when caught up
const REVISIT_LIMIT = 120;   // tuloksellisten/tuloksettomien kisojen uudelleentarkistus per ajo
const FRESH_REVISIT_LIMIT = 80;   // näistä budjetoidaan tämän päivän + eilisen kisoille
const FRESH_REVISIT_WINDOW_DAYS = 2;
const REVISIT_MAX_AGE_DAYS = 365; // kuinka kauan palataan kisoihin (alkuerä→finaali voi täydentyä myöhemmin)
// Kun haravoidaan ID joka ei vielä ole tuloslista.com:ssa, sitä saatetaan
// julkaista myöhemmin (esim. tämän päivän kisa, jolle ID on jo varattu mutta
// tuloksia ei ole vielä syötetty). Pidetään tällaiset revisit-tilassa kunnes
// ID jää selvästi taakse uusimmasta nähdystä ID:stä.
const NONEXIST_PERMANENT_GAP = 300; // jos id < latest_id - tämä, merkitään lopullisesti done
const NONEXIST_REVISIT_LIMIT = 120; // tuoreiden ei-olemassaolevien ID:iden uudelleenprobeja per ajo
const RECENT_NONEXIST_LIMIT = 60; // uusimmat varatut mutta ei-olemassaolevat ID:t (competition_id DESC)
const NONEXIST_NEAR_TODAY_LIMIT = 20; // priorisoitu probe lähellä tämän päivän olemassa olevia ID:itä
const NONEXIST_NEAR_TODAY_RADIUS = 100; // ±ID-säde tämän päivän olemassa olevien kisojen ympärillä
const CONCURRENCY = 5;       // parallel competitions per chunk
const HARD_MAX_ID = 30000;   // safety ceiling
const FLOOR_ID = 16456;      // tuloslista API:n vanhin saatavilla oleva kisa (5.1.2025)

// Soft rate-limit signal shared across the run. If tuloslista.com starts
// returning 429/503 we stop advancing so the cursor can retry these IDs
// on a later run instead of skipping them.
let rateLimited = false;

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

function parseResultNumeric(
  text: string,
  category: string,
  subCategory: string,
  eventName: string,
): number | null {
  return parseResult(text, { category, subCategory, eventName });
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
  result_round_name: string;
};

async function processCompetition(
  id: number,
  pending: Row[],
  pendingLegs: RelayLegRow[],
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
    // Lajilla voi olla useita kierroksia (alkuerät + loppukilpailu/A-/B-finaali)
    // saman event_id:n alla. API palauttaa Rounds-listan kronologisesti.
    //
    // Track: pidetään urheilijan PARAS numeerinen aika kaikista kierroksista.
    // Jos paras tuli muusta kierroksesta kuin viimeisestä (esim. alkuerä,
    // kun loppukilpailussa DNS), talletetaan kierroksen nimi
    // (result_round_name) jotta UI voi näyttää sen.
    // Jos kellään ei ollut numeerista tulosta missään kierroksessa, käytetään
    // viimeisen kierroksen riviä (esim. DNS).
    //
    // Muut kategoriat (Field, Throw, Combined…): pidetään paras numeerinen
    // (vanha logiikka), result_round_name jää tyhjäksi.
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
          // latest = viimeisin kierros
          if (rIdx >= prev.latestRoundIdx) {
            prev.latest = row;
            prev.latestRoundIdx = rIdx;
          }
          // best = paras numeerinen (Track: pienin aika; muut: suurin tulos)
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
        // Track: suosi viimeisintä kierrosta (loppukilpailu on virallinen
        // sijoitus). Vain jos viimeinen on ei-numeerinen (DNS/DNF/DQ),
        // pudottaudu parhaaseen aiempaan kierrokseen ja näytä sen nimi.
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

    // Relay-lajeille: kerätään viestin juoksijat vaihtojärjestyksessä.
    // Käytetään viimeisintä kierrosta, jonka allokaatiossa on AthleteOrders
    // (loppukilpailun joukkuekokoonpano voittaa alkuerän).
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
  // Chunk to keep request bodies small.
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

async function harvestRange(ids: number[], latestIdHint: number) {
  let scanned = 0;
  let existed = 0;
  let revisited = 0;
  let lastScannedId = ids.length > 0 ? ids[0] - 1 : -1;
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

  const cutoffMs = Date.now() - REVISIT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const NONEXIST_FRESH_MS = 30 * 24 * 60 * 60 * 1000;
  // Päivitä latestId-arvio jo skannauksen aikana, jotta uusin nähty ID
  // huomioidaan permanent-gap-päätöksessä saman ajon sisällä.
  let runningLatestId = latestIdHint;
  for (const id of ids) {
    if (id > runningLatestId) runningLatestId = id;
  }

  // Lataa aiemmat first_scanned_at -arvot, jotta ne säilyvät upsertissa ja
  // niitä voidaan käyttää done-päättelyssä.
  const firstSeenMap = new Map<number, string>();
  if (ids.length > 0) {
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

  // Process IDs in chunks of CONCURRENCY in source order, so that if we
  // bail out on rate-limit we know exactly which IDs were attempted.
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    if (rateLimited) break;
    const chunk = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (id) => {
        await jitter();
        return processCompetition(id, pending, pendingLegs);
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
          if (id > runningLatestId) runningLatestId = id;
        }
        // Päätä onko tämä kisa "done" — eli ei tarvitse palata.
        // Pidetään revisit-tilassa myös jo tuloksellisia kisoja, koska
        // alkuerien jälkeen voi tulla finaali (tai uusia kierroksia), ja
        // upsert valitsee parhaan tuloksen per urheilija/laji uudelleen.
        //
        // Ei-olemassaolevat ID:t merkitään done=true VAIN jos ne ovat
        // selvästi taakse jääneitä (id < latest - NONEXIST_PERMANENT_GAP).
        // Tuoreille ei-olemassaoleville pidetään done=false, jotta ne
        // probetaan uudelleen kun kisan tulokset ehkä julkaistaan.
        const dateMs = v.competitionDate ? Date.parse(v.competitionDate) : NaN;
        const tooOldToRevisit = Number.isFinite(dateMs) && dateMs < cutoffMs;
        const firstSeenAt = firstSeenMap.get(id) ?? nowIso;
        const firstSeenMs = Date.parse(firstSeenAt);
        const isFreshUnknown =
          !v.existed &&
          Number.isFinite(firstSeenMs) &&
          firstSeenMs > Date.now() - NONEXIST_FRESH_MS;
        const isPermanentGap =
          !v.existed && id < runningLatestId - NONEXIST_PERMANENT_GAP;
        const done = (isPermanentGap && !isFreshUnknown) || tooOldToRevisit;
        scanRecords.push({
          competition_id: id,
          competition_date: v.competitionDate,
          row_count: v.rowsAdded,
          exists_in_source: v.existed,
          done,
          last_scanned_at: nowIso,
          first_scanned_at: firstSeenAt,
        });
        if (v.existed && v.rowsAdded === 0) revisited++;
      }
      if (r.status === "rejected") console.error("comp", id, r.reason);
    }
    if (pending.length >= 400) await flush(pending.splice(0));
    if (pendingLegs.length >= 400) await flushLegs(pendingLegs.splice(0));
  }
  await flush(pending);
  await flushLegs(pendingLegs);


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
  // Ajetaan yksi kilpailu kerrallaan — funktio JOINaa koko urheilijan
  // historian, joten iso batch aikakatkaisee statement_timeoutiin.
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
      const freshCutoff = new Date(
        Date.now() - FRESH_REVISIT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const staleLimit = Math.max(0, REVISIT_LIMIT - FRESH_REVISIT_LIMIT);
      // Tuoreet ei-olemassaolevat ID:t: kisa-ID on jo varattu mutta tuloksia
      // ei ole vielä julkaistu. Probetaan uudestaan jos ID on lähellä uusinta
      // nähtyä (eli ei selvästi taakse jäänyt aukko).
      const nonexistFloor = Math.max(FLOOR_ID, latestId - NONEXIST_PERMANENT_GAP);
      // Priorisoitu probe: ID:t jotka ovat ±NONEXIST_NEAR_TODAY_RADIUS päässä
      // viime ~2 vrk:n aikana skannattujen, OLEMASSA OLEVIEN kisojen ID:istä.
      // Näin tämän päivän "puuttuvat" ID:t (kuten Hyvän Tuulen Kisat 19355,
      // jonka ympärillä oli 19394–19427 olemassa) skannataan joka ajossa.
      const todayCutoff = new Date(
        Date.now() - 2 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: nearTodayAnchors } = await supabaseAdmin
        .from("harvest_competitions")
        .select("competition_id")
        .eq("exists_in_source", true)
        .gte("last_scanned_at", todayCutoff)
        .order("competition_id", { ascending: false })
        .limit(20);
      let nearTodayMin = Number.POSITIVE_INFINITY;
      let nearTodayMax = Number.NEGATIVE_INFINITY;
      for (const a of (nearTodayAnchors ?? []) as Array<{ competition_id: number }>) {
        if (a.competition_id < nearTodayMin) nearTodayMin = a.competition_id;
        if (a.competition_id > nearTodayMax) nearTodayMax = a.competition_id;
      }
      const hasNearToday = Number.isFinite(nearTodayMin) && Number.isFinite(nearTodayMax);
      const nearTodayLo = hasNearToday
        ? Math.max(FLOOR_ID, nearTodayMin - NONEXIST_NEAR_TODAY_RADIUS)
        : 0;
      const nearTodayHi = hasNearToday
        ? nearTodayMax + NONEXIST_NEAR_TODAY_RADIUS
        : 0;
      const [freshRes, staleRes, nonexistRes, recentNonexistRes, nearTodayRes] = await Promise.all([
        supabaseAdmin
          .from("harvest_competitions")
          .select("competition_id")
          .eq("done", false)
          .eq("exists_in_source", true)
          .gte("competition_date", freshCutoff)
          .order("last_scanned_at", { ascending: true })
          .limit(FRESH_REVISIT_LIMIT),
        staleLimit > 0
          ? supabaseAdmin
              .from("harvest_competitions")
              .select("competition_id")
              .eq("done", false)
              .eq("exists_in_source", true)
              .lt("competition_date", freshCutoff)
              .order("last_scanned_at", { ascending: true })
              .limit(staleLimit)
          : Promise.resolve({ data: [] as Array<{ competition_id: number }> }),
        supabaseAdmin
          .from("harvest_competitions")
          .select("competition_id")
          .eq("exists_in_source", false)
          .eq("done", false)
          .gte("competition_id", Math.max(FLOOR_ID, latestId - NONEXIST_PERMANENT_GAP * 4))
          .order("last_scanned_at", { ascending: true })
          .limit(Math.max(0, NONEXIST_REVISIT_LIMIT - RECENT_NONEXIST_LIMIT)),
        supabaseAdmin
          .from("harvest_competitions")
          .select("competition_id")
          .eq("exists_in_source", false)
          .eq("done", false)
          .gte("competition_id", Math.max(FLOOR_ID, latestId - NONEXIST_PERMANENT_GAP))
          .order("competition_id", { ascending: false })
          .limit(RECENT_NONEXIST_LIMIT),
        hasNearToday
          ? supabaseAdmin
              .from("harvest_competitions")
              .select("competition_id")
              .eq("exists_in_source", false)
              .gte("competition_id", nearTodayLo)
              .lte("competition_id", nearTodayHi)
              .order("last_scanned_at", { ascending: true })
              .limit(NONEXIST_NEAR_TODAY_LIMIT)
          : Promise.resolve({ data: [] as Array<{ competition_id: number }> }),
      ]);
      const existing = new Set(ids);
      const revisitRows = [
        ...((freshRes.data ?? []) as Array<{ competition_id: number }>),
        ...((staleRes.data ?? []) as Array<{ competition_id: number }>),
        ...((recentNonexistRes.data ?? []) as Array<{ competition_id: number }>),
        ...((nonexistRes.data ?? []) as Array<{ competition_id: number }>),
        ...((nearTodayRes.data ?? []) as Array<{ competition_id: number }>),
      ];
      for (const r of revisitRows) {
        if (!existing.has(r.competition_id)) {
          existing.add(r.competition_id);
          ids.push(r.competition_id);
        }
      }
    }

    const result = await harvestRange(ids, latestId);

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
