// Admin-työkalu: yksi suora kutsu live.tuloslista.com originiin, ohittaa
// reunavälimuistin. Käytetään sen tarkistamiseen palauttaako origin
// nyt normaalin datan vai eston.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ORIGIN = "https://cached-public-api.tuloslista.com";
const ADMIN_EMAIL = "samiaavikko@gmail.com";

const UA_PRESETS: Record<string, string> = {
  harvester: "juoksut-harvester/1.0 (+https://tulokset.online)",
  proxy: "juoksut-proxy/1.0 (+https://tulokset.online)",
  browser:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

export interface ProbeResult {
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  contentType: string | null;
  bodyPreview: string;
  bodyBytes: number;
  headers: Record<string, string>;
  userAgentUsed: string;
  error?: string;
}

async function assertAdmin(context: { supabase: { auth: { getUser: () => Promise<{ data: { user: { email?: string | null } | null } }> } } }): Promise<void> {
  const { data: userData } = await context.supabase.auth.getUser();
  const email = (userData.user?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Forbidden");
}

export const probeTuloslista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string; uaPreset?: string; customUa?: string }) => input)
  .handler(async ({ data, context }): Promise<ProbeResult> => {
    await assertAdmin(context);

    let path = data.path.trim();
    if (!path.startsWith("/")) path = "/" + path;
    const url = `${ORIGIN}${path}`;
    const ua =
      (data.customUa && data.customUa.trim()) ||
      UA_PRESETS[data.uaPreset ?? "harvester"] ||
      UA_PRESETS.harvester;

    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(url, {
        headers: { "user-agent": ua, accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      return {
        url,
        status: res.status,
        statusText: res.statusText,
        durationMs: Date.now() - started,
        contentType: res.headers.get("content-type"),
        bodyPreview: text.slice(0, 4000),
        bodyBytes: text.length,
        headers,
        userAgentUsed: ua,
      };
    } catch (e) {
      return {
        url,
        status: 0,
        statusText: "fetch-failed",
        durationMs: Date.now() - started,
        contentType: null,
        bodyPreview: "",
        bodyBytes: 0,
        headers: {},
        userAgentUsed: ua,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

export interface EndpointStatus {
  ok: boolean;
  status: number;
  durationMs: number;
  bodyBytes: number;
  contentType: string | null;
  reason: string | null;
  checkedAt: string | null;
}

export interface MonitorSnapshot {
  blocked: boolean;
  blockReason: string | null;
  blockCheckedAt: string | null;
  blockSince: string | null;
  lastHarvestRunAt: string | null;
  consecutiveResultFailures: number;
  lastApiMessage: string | null;
  lastApiMessageAt: string | null;
  lastApiMessageSource: string | null;
  lastApiMessageEndpoint: string | null;
  list: EndpointStatus | null;
  results: EndpointStatus | null;
  recent: Array<{
    id: number;
    checkedAt: string;
    endpoint: "list" | "results";
    ok: boolean;
    status: number;
    durationMs: number;
    bodyBytes: number;
    contentType: string | null;
    reason: string | null;
  }>;
}


export const getMonitorSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MonitorSnapshot> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: state }, { data: log }, { data: latestList }, { data: latestResults }] =
      await Promise.all([
        supabaseAdmin
          .from("harvest_state")
          .select(
            "blocked, block_reason, block_checked_at, block_since, last_run_at, consecutive_result_failures, last_api_message, last_api_message_at, last_api_message_source, last_api_message_endpoint",
          )

          .eq("id", "singleton")
          .maybeSingle(),
        supabaseAdmin
          .from("tuloslista_probe_log")
          .select("id, checked_at, endpoint, ok, status, duration_ms, body_bytes, content_type, reason")
          .order("id", { ascending: false })
          .limit(60),
        supabaseAdmin
          .from("tuloslista_probe_log")
          .select("checked_at, ok, status, duration_ms, body_bytes, content_type, reason")
          .eq("endpoint", "list")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("tuloslista_probe_log")
          .select("checked_at, ok, status, duration_ms, body_bytes, content_type, reason")
          .eq("endpoint", "results")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const toStatus = (
      row:
        | {
            checked_at: string | null;
            ok: boolean | null;
            status: number | null;
            duration_ms: number | null;
            body_bytes: number | null;
            content_type: string | null;
            reason: string | null;
          }
        | null,
    ): EndpointStatus | null =>
      row
        ? {
            ok: row.ok === true,
            status: row.status ?? 0,
            durationMs: row.duration_ms ?? 0,
            bodyBytes: row.body_bytes ?? 0,
            contentType: row.content_type ?? null,
            reason: row.reason ?? null,
            checkedAt: row.checked_at ?? null,
          }
        : null;

    return {
      blocked: state?.blocked === true,
      blockReason: state?.block_reason ?? null,
      blockCheckedAt: state?.block_checked_at ?? null,
      blockSince: state?.block_since ?? null,
      lastHarvestRunAt: state?.last_run_at ?? null,
      consecutiveResultFailures:
        typeof state?.consecutive_result_failures === "number"
          ? state.consecutive_result_failures
          : 0,
      lastApiMessage: (state as { last_api_message?: string | null } | null)?.last_api_message ?? null,
      lastApiMessageAt: (state as { last_api_message_at?: string | null } | null)?.last_api_message_at ?? null,
      lastApiMessageSource: (state as { last_api_message_source?: string | null } | null)?.last_api_message_source ?? null,
      lastApiMessageEndpoint: (state as { last_api_message_endpoint?: string | null } | null)?.last_api_message_endpoint ?? null,
      list: toStatus(latestList as never),

      results: toStatus(latestResults as never),
      recent: (log ?? []).map((r) => ({
        id: r.id as number,
        checkedAt: r.checked_at as string,
        endpoint: ((r as { endpoint?: string }).endpoint === "results"
          ? "results"
          : "list") as "list" | "results",
        ok: r.ok as boolean,
        status: r.status as number,
        durationMs: r.duration_ms as number,
        bodyBytes: r.body_bytes as number,
        contentType: (r.content_type as string | null) ?? null,
        reason: (r.reason as string | null) ?? null,
      })),
    };
  });

export const runMonitorNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runTuloslistaMonitor } = await import(
      "@/routes/api/public/hooks/monitor-tuloslista"
    );
    return runTuloslistaMonitor();
  });


export const setHarvesterBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { blocked: boolean; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("harvest_state")
      .update({
        blocked: data.blocked,
        block_reason: data.blocked ? (data.reason ?? "manuaalisesti asetettu") : null,
        block_checked_at: nowIso,
        block_since: data.blocked ? nowIso : null,
        updated_at: nowIso,
      })
      .eq("id", "singleton");
    return { ok: true };
  });
