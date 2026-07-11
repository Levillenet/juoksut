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

export const probeTuloslista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string; uaPreset?: string; customUa?: string }) => input)
  .handler(async ({ data, context }): Promise<ProbeResult> => {
    const { data: userData } = await context.supabase.auth.getUser();
    const email = (userData.user?.email ?? "").toLowerCase();
    if (email !== ADMIN_EMAIL) throw new Error("Forbidden");

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
