// Valvoo tuloslista.com -rajapintaa. Tekee kaksi kyselyä joka ajolla:
//   1. lista-endpointti (kaikki kilpailut) — kertoo yleisen tavoitettavuuden
//   2. tulos-endpointti (yhden kilpailun properties) — tämä on se, jota
//      harvesteri tarvitsee. Auto-esto perustuu vain tämän tulokseen.
//
// Kutsut kulkevat nyt sisäisen /api/public/tuloslista -proxyn läpi
// x-force-origin: true -otsikolla, jotta monitori näkee todellisen origin-
// tilanteen, mutta samalla tulos tallentuu jaettuun välimuistiin.
//
// Kun tulos-endpointti epäonnistuu 2 kertaa peräkkäin, harvest_state.blocked
// menee tosi. Kun se onnistuu, laskuri nollataan ja esto puretaan.
//
// Kutsutaan pg_cronin kautta 10 min välein. Voi kutsua myös käsin admin-UI:sta.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isTuloslistaPollingWindow } from "@/lib/helsinki-time";
import {
  competitionListTtl,
  propertiesTtl,
  proxyTuloslista,
} from "@/lib/tuloslista-proxy";

const LIST_PATH = "/live/v1/competition";
const RESULTS_PATH = (id: number) => `/live/v1/competition/${id}/properties`;
const FALLBACK_COMPETITION_ID = 17661; // Tunnettu kilpailu, jolla oli tuloksia 9.7.2026
const LIST_MIN_OK_BYTES = 1000;
const RESULTS_MIN_OK_BYTES = 50; // properties on pieni JSON-objekti
const TIMEOUT_MS = 12_000;
const KEEP_LOG_ROWS = 500;
const FAILURE_THRESHOLD = 2; // peräkkäisten tulos-epäonnistumisten raja

type Endpoint = "list" | "results";

interface Verdict {
  ok: boolean;
  reason: string | null;
}

interface ProbeOutcome extends Verdict {
  status: number;
  durationMs: number;
  bodyBytes: number;
  contentType: string | null;
  bodyPreview: string;
  bodyFull: string;
  url: string;
}


// Fraaseja, joilla tuloslista.com kertoo palvelusta / rajoituksista.
// Uusia lisätään heti kun huomataan.
const API_MESSAGE_PATTERNS: RegExp[] = [
  /lähettää rajapintakutsuja aivan liikaa/i,
  /rajapintakutsuja.*liikaa/i,
  /ole yhteydessä/i,
  /liikaa kutsuja/i,
  /kohtuuton/i,
  /tuloslista\.com/i,
  /please contact/i,
  /rate.?limit/i,
  /too many requests/i,
  /forbidden/i,
];

export function detectApiMessage(body: string): string | null {
  if (!body) return null;
  // Jos vastaus on JSON-taulukko/objekti eikä ole yhtään avainsanaa, ohita.
  const trimmed = body.trimStart();
  const looksJson = trimmed.startsWith("[") || trimmed.startsWith("{");
  for (const re of API_MESSAGE_PATTERNS) {
    if (re.test(body)) {
      // Poimi ympäröivä lause (max 300 merkkiä) luettavuutta varten.
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
  // Jos ei ole JSON eikä patterneja, mutta on lyhyt selväteksti, tallenna se.
  if (!looksJson && body.length > 0 && body.length < 400) {
    const stripped = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (stripped.length >= 10) return stripped;
  }
  return null;
}

function classify(
  status: number,
  contentType: string | null,
  body: string,
  minBytes: number,
): Verdict {
  if (status === 0) return { ok: false, reason: "verkkovirhe (fetch epäonnistui)" };
  if (status === 403 || status === 401)
    return { ok: false, reason: `esto (HTTP ${status})` };
  if (status === 429) return { ok: false, reason: "rate-limit (HTTP 429)" };
  if (status === 404) return { ok: false, reason: "ei löydy (HTTP 404)" };
  if (status >= 500) return { ok: false, reason: `origin-virhe (HTTP ${status})` };
  if (status !== 200) return { ok: false, reason: `odottamaton status (HTTP ${status})` };
  const apiMessage = detectApiMessage(body);
  if (apiMessage) {
    return { ok: false, reason: `tuloslista viesti: ${apiMessage.slice(0, 120)}` };
  }
  const ct = (contentType ?? "").toLowerCase();
  if (!ct.includes("application/json") && !ct.includes("text/json"))
    return { ok: false, reason: `ei-JSON-vastaus (${contentType ?? "?"})` };
  if (body.length < minBytes)
    return { ok: false, reason: `epäilyttävän lyhyt vastaus (${body.length} tavua)` };
  const trimmed = body.trimStart();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{"))
    return { ok: false, reason: "vastaus ei näytä JSON-rakenteelta" };
  return { ok: true, reason: null };
}


async function runProbe(path: string, minBytes: number): Promise<ProbeOutcome> {
  const url = `${ORIGIN}${path}`;
  const started = Date.now();
  let status = 0;
  let contentType: string | null = null;
  let body = "";
  let fetchError: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    status = res.status;
    contentType = res.headers.get("content-type");
    body = await res.text();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
  }

  bumpOriginCall("monitor", path, status);

  const duration = Date.now() - started;
  const verdict: Verdict = fetchError
    ? { ok: false, reason: `verkkovirhe: ${fetchError}` }
    : classify(status, contentType, body, minBytes);

  return {
    ...verdict,
    status,
    durationMs: duration,
    bodyBytes: body.length,
    contentType,
    bodyPreview: body.slice(0, 400),
    bodyFull: body,
    url,
  };
}


async function pickReferenceCompetitionId(): Promise<number> {
  const cutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("harvest_competitions")
    .select("competition_id")
    .eq("exists_in_source", true)
    .gte("competition_date", cutoff)
    .order("competition_date", { ascending: false })
    .limit(1);
  return data?.[0]?.competition_id ?? FALLBACK_COMPETITION_ID;
}

async function logProbe(endpoint: Endpoint, outcome: ProbeOutcome): Promise<void> {
  await supabaseAdmin.from("tuloslista_probe_log").insert({
    ok: outcome.ok,
    status: outcome.status,
    duration_ms: outcome.durationMs,
    content_type: outcome.contentType,
    body_bytes: outcome.bodyBytes,
    body_preview: outcome.bodyPreview,
    reason: outcome.reason,
    user_agent: UA,
    endpoint,
  });
}

async function trimLog(): Promise<void> {
  const { data: cutoffRow } = await supabaseAdmin
    .from("tuloslista_probe_log")
    .select("id")
    .order("id", { ascending: false })
    .range(KEEP_LOG_ROWS, KEEP_LOG_ROWS)
    .maybeSingle();
  if (cutoffRow?.id) {
    await supabaseAdmin
      .from("tuloslista_probe_log")
      .delete()
      .lte("id", cutoffRow.id);
  }
}

export interface MonitorRunResult {
  list: {
    ok: boolean;
    reason: string | null;
    status: number;
    durationMs: number;
    bodyBytes: number;
  };
  results: {
    ok: boolean;
    reason: string | null;
    status: number;
    durationMs: number;
    bodyBytes: number;
    competitionId: number;
  };
  transition: "none" | "blocked" | "unblocked";
  consecutiveResultFailures: number;
  apiMessage: string | null;
  apiMessageEndpoint: "list" | "results" | null;

}

export async function runTuloslistaMonitor(): Promise<MonitorRunResult> {
  if (!isTuloslistaPollingWindow()) {
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("harvest_state")
      .update({
        blocked: true,
        block_reason: "Tuloslistan automaattiset kyselyt ovat yökatkolla klo 21-09.",
        block_checked_at: nowIso,
        block_since: nowIso,
        updated_at: nowIso,
      })
      .eq("id", "singleton");

    return {
      list: { ok: true, reason: "night-window", status: 0, durationMs: 0, bodyBytes: 0 },
      results: {
        ok: true,
        reason: "night-window",
        status: 0,
        durationMs: 0,
        bodyBytes: 0,
        competitionId: 0,
      },
      transition: "blocked",
      consecutiveResultFailures: 0,
      apiMessage: null,
      apiMessageEndpoint: null,
    };
  }

  const [listOutcome, referenceId] = await Promise.all([
    runProbe(LIST_PATH, LIST_MIN_OK_BYTES),
    pickReferenceCompetitionId(),
  ]);
  const resultsOutcome = await runProbe(
    RESULTS_PATH(referenceId),
    RESULTS_MIN_OK_BYTES,
  );

  await logProbe("list", listOutcome);
  await logProbe("results", resultsOutcome);

  const { data: prev } = await supabaseAdmin
    .from("harvest_state")
    .select("blocked, block_since, consecutive_result_failures")
    .eq("id", "singleton")
    .maybeSingle();

  const wasBlocked = prev?.blocked === true;
  const prevSince = prev?.block_since ?? null;
  const prevFailures =
    typeof prev?.consecutive_result_failures === "number"
      ? prev.consecutive_result_failures
      : 0;

  const nextFailures = resultsOutcome.ok ? 0 : prevFailures + 1;
  const shouldBlock = nextFailures >= FAILURE_THRESHOLD;
  const nowIso = new Date().toISOString();

  // Yhdistetty syy: näytä ensisijaisesti tulos-endpointin ongelma.
  const blockReason = shouldBlock
    ? `Tulos-rajapinta ei vastaa: ${resultsOutcome.reason ?? "tuntematon syy"}`
    : null;

  // Etsi mahdollinen tuloslistan viesti kummastakin vastauksesta.
  const listMsg = detectApiMessage(listOutcome.bodyFull);
  const resMsg = detectApiMessage(resultsOutcome.bodyFull);
  const apiMessage = resMsg ?? listMsg;
  const apiMessageEndpoint = resMsg ? "results" : listMsg ? "list" : null;

  const update = {
    blocked: shouldBlock,
    block_reason: blockReason,
    block_checked_at: nowIso,
    block_since: shouldBlock
      ? wasBlocked && prevSince
        ? prevSince
        : nowIso
      : null,
    consecutive_result_failures: nextFailures,
    updated_at: nowIso,
    ...(apiMessage
      ? {
          last_api_message: apiMessage,
          last_api_message_at: nowIso,
          last_api_message_source: "monitor",
          last_api_message_endpoint: apiMessageEndpoint,
        }
      : {}),
  };

  await supabaseAdmin
    .from("harvest_state")
    .update(update)
    .eq("id", "singleton");


  await trimLog();

  const transition: "none" | "blocked" | "unblocked" =
    wasBlocked === shouldBlock ? "none" : shouldBlock ? "blocked" : "unblocked";

  return {
    list: {
      ok: listOutcome.ok,
      reason: listOutcome.reason,
      status: listOutcome.status,
      durationMs: listOutcome.durationMs,
      bodyBytes: listOutcome.bodyBytes,
    },
    results: {
      ok: resultsOutcome.ok,
      reason: resultsOutcome.reason,
      status: resultsOutcome.status,
      durationMs: resultsOutcome.durationMs,
      bodyBytes: resultsOutcome.bodyBytes,
      competitionId: referenceId,
    },
    transition,
    consecutiveResultFailures: nextFailures,
    apiMessage,
    apiMessageEndpoint,
  };
}


export const Route = createFileRoute("/api/public/hooks/monitor-tuloslista")({
  server: {
    handlers: {
      POST: async () => Response.json(await runTuloslistaMonitor()),
      GET: async () => Response.json(await runTuloslistaMonitor()),
    },
  },
});
