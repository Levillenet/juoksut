// Valvoo tuloslista.com -rajapintaa harvesterin User-Agentilla. Jos
// vastaus näyttää estolta, asettaa harvest_state.blocked = true ja
// tallentaa syyn. Kun rajapinta palaa normaaliksi, esto puretaan.
//
// Kutsutaan pg_cronin kautta 10 min välein. Voi kutsua myös käsin
// admin-käyttöliittymästä.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PROBE_URL =
  "https://cached-public-api.tuloslista.com/live/v1/competition";
const UA = "juoksut-harvester/1.0 (+https://tulokset.online)";
const MIN_OK_BYTES = 1000; // täysi lista on kymmeniä KB; estoviestit ovat pieniä
const TIMEOUT_MS = 12_000;
const KEEP_LOG_ROWS = 500;

interface Verdict {
  ok: boolean;
  reason: string | null;
}

function classify(
  status: number,
  contentType: string | null,
  body: string,
): Verdict {
  if (status === 0) return { ok: false, reason: "verkkovirhe (fetch epäonnistui)" };
  if (status === 403 || status === 401)
    return { ok: false, reason: `esto (HTTP ${status})` };
  if (status === 429) return { ok: false, reason: "rate-limit (HTTP 429)" };
  if (status >= 500) return { ok: false, reason: `origin-virhe (HTTP ${status})` };
  if (status !== 200) return { ok: false, reason: `odottamaton status (HTTP ${status})` };
  const ct = (contentType ?? "").toLowerCase();
  if (!ct.includes("application/json") && !ct.includes("text/json"))
    return { ok: false, reason: `ei-JSON-vastaus (${contentType ?? "?"})` };
  if (body.length < MIN_OK_BYTES)
    return { ok: false, reason: `epäilyttävän lyhyt vastaus (${body.length} tavua)` };
  const trimmed = body.trimStart();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{"))
    return { ok: false, reason: "vastaus ei näytä JSON-rakenteelta" };
  return { ok: true, reason: null };
}

async function run(): Promise<Response> {
  const started = Date.now();
  let status = 0;
  let contentType: string | null = null;
  let body = "";
  let fetchError: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(PROBE_URL, {
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

  const duration = Date.now() - started;
  const verdict = fetchError
    ? { ok: false, reason: `verkkovirhe: ${fetchError}` }
    : classify(status, contentType, body);

  // Hae aiempi tila jotta tiedämme siirrymmekö block/unblock -tilaan
  const { data: prev } = await supabaseAdmin
    .from("harvest_state")
    .select("blocked, block_since")
    .eq("id", "singleton")
    .maybeSingle();

  const wasBlocked = prev?.blocked === true;
  const nowIso = new Date().toISOString();

  await supabaseAdmin
    .from("harvest_state")
    .update({
      blocked: !verdict.ok,
      block_reason: verdict.ok ? null : verdict.reason,
      block_checked_at: nowIso,
      block_since: verdict.ok
        ? null
        : wasBlocked && prev?.block_since
          ? prev.block_since
          : nowIso,
      updated_at: nowIso,
    })
    .eq("id", "singleton");

  await supabaseAdmin.from("tuloslista_probe_log").insert({
    ok: verdict.ok,
    status,
    duration_ms: duration,
    content_type: contentType,
    body_bytes: body.length,
    body_preview: body.slice(0, 400),
    reason: verdict.reason,
    user_agent: UA,
  });

  // Karsi vanhat lokirivit
  await supabaseAdmin.rpc("noop_placeholder").catch(() => undefined);
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

  return Response.json({
    ok: verdict.ok,
    reason: verdict.reason,
    status,
    durationMs: duration,
    bodyBytes: body.length,
    transition: wasBlocked === !verdict.ok ? "none" : verdict.ok ? "unblocked" : "blocked",
  });
}

export const Route = createFileRoute("/api/public/hooks/monitor-tuloslista")({
  server: {
    handlers: {
      POST: async () => run(),
      GET: async () => run(),
    },
  },
});
