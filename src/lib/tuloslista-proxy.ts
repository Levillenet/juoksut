// Välikerros tuloslista.com:n live-API:lle.
//
// Sijoittuu selaimen ja origin-API:n väliin Cloudflare Worker -reunalla.
// Tavoite: pitää origin-pyyntöjen määrä alhaisena vaikka katsojia olisi
// satoja yhtäaikaa, ja antaa vakaita vasteaikoja kun cache on lämmin.
//
// Kerrokset:
//  1) Cloudflare Cache API   — per-URL reverse-proxy, ~5-20 ms vasteaika
//  2) In-memory single-flight — koalisoi rinnakkaiset cache-miss-pyynnöt
//  3) Stale-while-revalidate  — palautetaan hieman vanhentunut data heti,
//                                taustalla pyyntö freshille versiolle
//  4) Circuit breaker         — kun origin antaa 429/503, palautetaan stale
//                                eikä yritetä originia 60 sekuntiin
//
// KV/Durable Objects ei käytössä v1:ssä — Cache API riittää.
// Jos haluamme jakaa cachea edgejen välillä, lisätään KV myöhemmin.

import { bumpOriginCall } from "@/lib/origin-call-counter";

const ORIGIN = "https://cached-public-api.tuloslista.com";

export interface TtlConfig {
  /** Sekunteja jonka jälkeen cache on stale-but-servable (SWR aktivoituu). */
  edgeTtl: number;
  /** Lisäsekunteja edgeTtl:n päälle, jonka aikana stale-vastaus kelpaa. */
  swrWindow: number;
}

// Isolaatin sisäinen single-flight: koalisoi rinnakkaiset upstream-kutsut
// samalle URL:lle yhdeksi pyynnöksi.
const inflight = new Map<string, Promise<string | null>>();

// In-memory circuit-breaker. Avain = path, arvo = milloin auki saa sulkeutua.
const circuitOpenUntil = new Map<string, number>();
const CIRCUIT_OPEN_MS = 60_000;

// Upstream-fetchin aikakatkaisu. Pidetään selvästi alle Cloudflare Workersin
// hang-detectionin (~30 s), jotta CF ei tapa pyyntöä 502:lla.
const UPSTREAM_TIMEOUT_MS = 8_000;

interface CachedEnvelope {
  body: string;
  cachedAt: number;
}

// Isolate-scope memory cache — halvin ja luotettavin tier ennen Cloudflare
// Cache API:a. Ei jaeta isolatien välillä, mutta lämmin isolate ehtii
// palvella useita samaan URLiin osuvia pyyntöjä yhdellä origin-käynnillä.
// Rajattu koko + LRU-tyyppinen karsinta, ettei muisti kasva rajattomasti.
const MEMORY_MAX_ENTRIES = 500;
const memoryCache = new Map<string, CachedEnvelope>();

function memoryGet(path: string): CachedEnvelope | undefined {
  const env = memoryCache.get(path);
  if (!env) return undefined;
  // touch for LRU
  memoryCache.delete(path);
  memoryCache.set(path, env);
  return env;
}
function memoryPut(path: string, env: CachedEnvelope) {
  memoryCache.set(path, env);
  if (memoryCache.size > MEMORY_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
}


export async function proxyTuloslista(
  path: string,
  ttlOf: (body: string) => TtlConfig,
  request?: Request,
): Promise<Response> {
  const originUrl = `${ORIGIN}${path}`;
  // Cloudflare Cache API vaatii, että avaimen host on samalla zonella kuin
  // Worker itse — mielivaltainen `https://tl-proxy.local` hyväksytään put:ssa
  // hiljaisesti mutta match ei koskaan löydä sitä. Käytetään pyynnön omaa
  // hostia ja synteettistä polkua, jotta preview, custom domain ja julkaistu
  // lovable.app saavat omat toimivat cache-avaimensa.
  const cacheOrigin = request ? new URL(request.url).origin : "https://tulokset.online";
  const cacheKey = new Request(`${cacheOrigin}/__tl-proxy${path}`, { method: "GET" });
  const cache =
    typeof caches !== "undefined" && "default" in caches
      ? (caches as unknown as { default: Cache }).default
      : null;


  // 1a) Isolate-muistista?
  const mem = memoryGet(path);
  if (mem) {
    const ttl = ttlOf(mem.body);
    const ageSec = (Date.now() - mem.cachedAt) / 1000;
    if (ageSec < ttl.edgeTtl) {
      bumpOriginCall("proxy_cache", path, "hit");
      return jsonResponse(mem.body, "hit", ageSec);
    }
    if (ageSec < ttl.edgeTtl + ttl.swrWindow) {
      bumpOriginCall("proxy_cache", path, "stale");
      if (cache) kickRefresh(originUrl, cacheKey, cache, ttlOf, path);
      else void getOrFetch(originUrl, cacheKey, cache, ttlOf, path);
      return jsonResponse(mem.body, "stale", ageSec);
    }

  }

  // 1b) Cloudflare Cache API osuma?
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => undefined);
    if (hit) {
      const env = await readEnvelope(hit);
      if (env) {
        memoryPut(path, env);
        const ttl = ttlOf(env.body);
        const ageSec = (Date.now() - env.cachedAt) / 1000;
        if (ageSec < ttl.edgeTtl) {
          bumpOriginCall("proxy_cache", path, "hit");
          return jsonResponse(env.body, "hit", ageSec);
        }
        if (ageSec < ttl.edgeTtl + ttl.swrWindow) {
          // SWR: palauta stale heti, päivitä taustalla.
          bumpOriginCall("proxy_cache", path, "stale");
          kickRefresh(originUrl, cacheKey, cache, ttlOf, path);
          return jsonResponse(env.body, "stale", ageSec);
        }
        // Liian vanha — käsitellään cache-missinä mutta pidetään stale
        // varakopiona jos origin feilaa.
      }
    }
  }

  // 2) Circuit auki? -> yritä antaa viimeisin stale muistista tai cachesta
  const openUntil = circuitOpenUntil.get(path);
  if (openUntil && Date.now() < openUntil) {
    if (mem) {
      bumpOriginCall("proxy_cache", path, "circuit");
      return jsonResponse(mem.body, "circuit", (Date.now() - mem.cachedAt) / 1000);
    }
    if (cache) {
      const hit = await cache.match(cacheKey).catch(() => undefined);
      if (hit) {
        const env = await readEnvelope(hit);
        if (env) {
          memoryPut(path, env);
          bumpOriginCall("proxy_cache", path, "circuit");
          return jsonResponse(env.body, "circuit", (Date.now() - env.cachedAt) / 1000);
        }
      }
    }
  }


  // 3) Single-flight upstream-fetch
  const body = await getOrFetch(originUrl, cacheKey, cache, ttlOf, path);
  if (body) return jsonResponse(body, "miss", 0);

  // 4) Origin feilasi — viimeinen yritys: anna mikä tahansa cache-kopio
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => undefined);
    if (hit) {
      const env = await readEnvelope(hit);
      if (env) {
        bumpOriginCall("proxy_cache", path, "stale-error");
        return jsonResponse(env.body, "stale-error", (Date.now() - env.cachedAt) / 1000);
      }
    }
  }
  return new Response(JSON.stringify({ error: "Upstream unavailable" }), {
    status: 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "retry-after": "30",
    },
  });
}

async function getOrFetch(
  originUrl: string,
  cacheKey: Request,
  cache: Cache | null,
  ttlOf: (body: string) => TtlConfig,
  path: string,
): Promise<string | null> {
  let p = inflight.get(path);
  if (!p) {
    p = fetchFromOrigin(originUrl, cacheKey, cache, ttlOf, path);
    inflight.set(path, p);
    p.finally(() => {
      // Pidetään promise hetki memorymapissa että uusi pyyntö ei riko
      // dedupea — mutta poistetaan välittömästi.
      inflight.delete(path);
    });
  }
  return p;
}

async function fetchFromOrigin(
  originUrl: string,
  cacheKey: Request,
  cache: Cache | null,
  ttlOf: (body: string) => TtlConfig,
  path: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(originUrl, {
      headers: {
        "user-agent": "juoksut-proxy/1.0 (+https://tulokset.online)",
        accept: "application/json",
      },
      signal: controller.signal,
    });
    bumpOriginCall("proxy_origin", path, res.status);
    if (res.status === 429 || res.status === 503) {
      console.warn(`[tl-proxy] origin ${res.status} ${path} — circuit open ${CIRCUIT_OPEN_MS}ms`);
      circuitOpenUntil.set(path, Date.now() + CIRCUIT_OPEN_MS);
      return null;
    }
    if (!res.ok) {
      console.warn(`[tl-proxy] origin ${res.status} ${path}`);
      return null;
    }
    const body = await res.text();
    // Circuit voi sulkeutua jos onnistunut vastaus saadaan.
    circuitOpenUntil.delete(path);

    // Isolate-muisti aina: takaa cache-osumat vaikka Cache API ei olisi
    // käytettävissä tai epäonnistuisi hiljaa.
    memoryPut(path, { body, cachedAt: Date.now() });

    if (cache) {
      const ttl = ttlOf(body);
      const totalTtl = ttl.edgeTtl + ttl.swrWindow;
      const envelope = new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-tl-cached-at": String(Date.now()),
          // Cache APIn omat säännöt: pidä kopio totalTtl ajan.
          "cache-control": `public, max-age=${totalTtl}`,
        },
      });
      await cache.put(cacheKey, envelope).catch((e) => {
        console.warn(`[tl-proxy] cache.put failed ${path}`, e);
      });
    }

    return body;
  } catch (e) {
    const aborted =
      (e instanceof Error && e.name === "AbortError") ||
      controller.signal.aborted;
    if (aborted) {
      console.warn(
        `[tl-proxy] origin timeout ${UPSTREAM_TIMEOUT_MS}ms ${path} — circuit open ${CIRCUIT_OPEN_MS}ms`,
      );
    } else {
      console.error(`[tl-proxy] fetch error ${path}`, e);
    }
    bumpOriginCall("proxy_origin", path, 0);
    // Avaa breaker myös timeoutille ja verkkovirheille, jottei Worker jää
    // jumiin samaan hitaaseen upstreamiin.
    circuitOpenUntil.set(path, Date.now() + CIRCUIT_OPEN_MS);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function kickRefresh(
  originUrl: string,
  cacheKey: Request,
  cache: Cache,
  ttlOf: (body: string) => TtlConfig,
  path: string,
) {
  if (inflight.has(path)) return;
  // Fire-and-forget. Worker-runtime usein pitää isolaatin elossa muiden
  // pyyntöjen ansiosta, ja seuraava lukija saa freshin vastauksen.
  const p = fetchFromOrigin(originUrl, cacheKey, cache, ttlOf, path);
  inflight.set(path, p);
  p.finally(() => inflight.delete(path));
}

async function readEnvelope(res: Response): Promise<CachedEnvelope | null> {
  try {
    const cachedAt = parseInt(res.headers.get("x-tl-cached-at") ?? "0", 10);
    if (!cachedAt) return null;
    const body = await res.text();
    return { body, cachedAt };
  } catch {
    return null;
  }
}

function jsonResponse(body: string, cacheStatus: string, ageSec: number): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-tl-cache": cacheStatus,
      "x-tl-age": ageSec.toFixed(1),
      // Selain ei saa cachettaa proxyn vastausta — React Query hoitaa.
      "cache-control": "no-store",
    },
  });
}

// --- TTL-strategiat per endpoint-tyyppi ---

/** Aikataulu (`/competition/{id}`) — muuttuu hitaasti. */
export const scheduleTtl = (): TtlConfig => ({ edgeTtl: 30, swrWindow: 30 });

/** Kisan properties — muuttuu erittäin harvoin. */
export const propertiesTtl = (): TtlConfig => ({ edgeTtl: 300, swrWindow: 600 });

/** Kisalista (`/competition`) — uusia kisoja tulee harvakseltaan. */
export const competitionListTtl = (): TtlConfig => ({ edgeTtl: 60, swrWindow: 300 });

interface EventBody {
  Rounds?: { Status?: string }[];
}

/**
 * Lajin tulokset (`/results/{id}/{eventId}`) — TTL johdetaan kierrosten
 * statuksista: käynnissä = tiukka, virallinen = pitkä.
 */
export function resultsTtl(body: string): TtlConfig {
  try {
    const parsed = JSON.parse(body) as EventBody;
    const statuses = (parsed.Rounds ?? []).map((r) => r.Status ?? "");
    if (statuses.includes("Progress")) {
      // Käynnissä — alkuperäinen on yleisin polling-kohde
      return { edgeTtl: 8, swrWindow: 15 };
    }
    if (statuses.length > 0 && statuses.every((s) => s === "Official")) {
      // Virallistunut, ei muutu enää
      return { edgeTtl: 300, swrWindow: 3600 };
    }
    // Allocated / Unallocated / sekoitus
    return { edgeTtl: 30, swrWindow: 30 };
  } catch {
    return { edgeTtl: 15, swrWindow: 30 };
  }
}
