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

interface CachedEnvelope {
  body: string;
  cachedAt: number;
}

export async function proxyTuloslista(
  path: string,
  ttlOf: (body: string) => TtlConfig,
): Promise<Response> {
  const originUrl = `${ORIGIN}${path}`;
  // Cache API vaatii Request-objektin avaimeksi. Käytetään stabiilia
  // synteettistä URL:ää, joka on uniikki per origin-path.
  const cacheKey = new Request(`https://tl-proxy.local${path}`, { method: "GET" });
  const cache =
    typeof caches !== "undefined" && "default" in caches
      ? (caches as unknown as { default: Cache }).default
      : null;

  // 1) Cache-osuma?
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => undefined);
    if (hit) {
      const env = await readEnvelope(hit);
      if (env) {
        const ttl = ttlOf(env.body);
        const ageSec = (Date.now() - env.cachedAt) / 1000;
        if (ageSec < ttl.edgeTtl) {
          return jsonResponse(env.body, "hit", ageSec);
        }
        if (ageSec < ttl.edgeTtl + ttl.swrWindow) {
          // SWR: palauta stale heti, päivitä taustalla.
          kickRefresh(originUrl, cacheKey, cache, ttlOf, path);
          return jsonResponse(env.body, "stale", ageSec);
        }
        // Liian vanha — käsitellään cache-missinä mutta pidetään stale
        // varakopiona jos origin feilaa.
      }
    }
  }

  // 2) Circuit auki? -> yritä antaa viimeisin stale
  const openUntil = circuitOpenUntil.get(path);
  if (openUntil && Date.now() < openUntil && cache) {
    const hit = await cache.match(cacheKey).catch(() => undefined);
    if (hit) {
      const env = await readEnvelope(hit);
      if (env) return jsonResponse(env.body, "circuit", (Date.now() - env.cachedAt) / 1000);
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
      if (env)
        return jsonResponse(env.body, "stale-error", (Date.now() - env.cachedAt) / 1000);
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
  try {
    const res = await fetch(originUrl, {
      headers: {
        "user-agent": "juoksut-proxy/1.0 (+https://tulokset.online)",
        accept: "application/json",
      },
    });
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
    console.error(`[tl-proxy] fetch error ${path}`, e);
    return null;
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
