// Välikerros tuloslista.com:n live-API:lle.
//
// Sijoittuu selaimen ja origin-API:n väliin Cloudflare Worker -reunalla.
// Tavoite: pitää origin-pyyntöjen määrä alhaisena vaikka katsojia olisi
// satoja yhtäaikaa, ja antaa vakaita vasteaikoja kun cache on lämmin.
//
// Periaate: jokainen tulos haetaan originilta vain kerran (single-flight)
// ja jaetaan kaikille käyttäjille sekä Worker-isolaateille tietokanta-
// välimuistin kautta. Kuuluttajanäkymän hakema tulos on siis sama, jonka
// muut käyttäjät näkevät.
//
// Kerrokset:
//  1) In-memory single-flight — koalisoi rinnakkaiset cache-miss-pyynnöt
//     saman isolaatin sisällä heti.
//  2) Postgres DB cache — jaettu kaikkien isolaattien, domainien ja
//     taustatyöjen kesken. Tämä on ensisijainen yhteinen totuus.
//  3) Cloudflare Cache API — per-URL reverse-proxy, ~5-20 ms vasteaika
//     (varatier, domainkohtainen avain).
//  4) Stale-while-revalidate — palautetaan hieman vanhentunut data heti,
//     taustalla pyyntö freshille versiolle.
//  5) Circuit breaker — kun origin antaa 429/503, palautetaan stale
//     eikä yritetä originia 60 sekuntiin.
//  6) Cross-isolate single-flight — DB-pohjainen lukko estää useita
//     isolaatteja tekemästä samaa origin-kutsua yhtä aikaa.

import { bumpOriginCall, type CounterSource } from "@/lib/origin-call-counter";

const ALLOWED_SOURCES: CounterSource[] = [
  "harvester",
  "hot_cycle",
  "monitor",
  "proxy_origin",
  "proxy_cache",
  "admin_probe",
];

export interface ProxyOptions {
  /** Pakota kutsu originille ohittaen kaikki välimuistit. Käytä vain
   *  health-check-tyyppisissä taustatarkistuksissa. */
  forceOrigin?: boolean;
}

function resolveSources(request?: Request): {
  originSource: CounterSource;
  cacheSource: CounterSource;
} {
  const raw = request?.headers.get("x-origin-source")?.toLowerCase() ?? null;
  if (raw && (ALLOWED_SOURCES as string[]).includes(raw)) {
    const s = raw as CounterSource;
    // Sisäiset taustatyöt kirjautuvat omalla lähteellään sekä miss- että
    // hit-tapauksessa, jotta admin näkee harvesterin ja hot_cyclen työn
    // erillään loppukäyttäjien selainpyynnöistä.
    return { originSource: s, cacheSource: s };
  }
  return { originSource: "proxy_origin", cacheSource: "proxy_cache" };
}

function isForceOrigin(request?: Request): boolean {
  return request?.headers.get("x-force-origin") === "true";
}

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

// Kuinka kauan odotamme, että toinen isolaatti täyttää DB-cachen, kun emme
// itse saaneet lukkoa.
const LOCK_WAIT_MAX_MS = 10_000;
const LOCK_POLL_MS = 50;

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
let edgeCacheDisabled = false;

function getEdgeCache(): Cache | null {
  if (edgeCacheDisabled) return null;
  return typeof caches !== "undefined" && "default" in caches
    ? (caches as unknown as { default: Cache }).default
    : null;
}

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

async function dbGet(path: string): Promise<CachedEnvelope | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_tuloslista_proxy_cache", {
      _path: path,
    });
    if (error) {
      console.warn(`[tl-proxy] db cache read failed ${path}`, error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.body || !row.cached_at) return null;
    const cachedAt = new Date(row.cached_at).getTime();
    if (!Number.isFinite(cachedAt)) return null;
    return { body: row.body, cachedAt };
  } catch (e) {
    console.warn(`[tl-proxy] db cache read failed ${path}`, e);
    return null;
  }
}

async function dbPut(path: string, body: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("set_tuloslista_proxy_cache", {
      _path: path,
      _body: body,
    });
    if (error) console.warn(`[tl-proxy] db cache write failed ${path}`, error.message);
  } catch (e) {
    console.warn(`[tl-proxy] db cache write failed ${path}`, e);
  }
}

async function dbTryLock(path: string, ttlSeconds: number): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("try_tuloslista_proxy_lock", {
      _path: path,
      _ttl_seconds: ttlSeconds,
    });
    if (error) {
      console.warn(`[tl-proxy] db lock try failed ${path}`, error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.warn(`[tl-proxy] db lock try failed ${path}`, e);
    return false;
  }
}

async function dbReleaseLock(path: string, body: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("release_tuloslista_proxy_lock", {
      _path: path,
      _body: body,
    });
    if (error) console.warn(`[tl-proxy] db lock release failed ${path}`, error.message);
  } catch (e) {
    console.warn(`[tl-proxy] db lock release failed ${path}`, e);
  }
}

async function dbReleaseLockEmpty(path: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("release_tuloslista_proxy_lock_empty", {
      _path: path,
    });
    if (error) console.warn(`[tl-proxy] db lock empty release failed ${path}`, error.message);
  } catch (e) {
    console.warn(`[tl-proxy] db lock empty release failed ${path}`, e);
  }
}

async function dbLockHeld(path: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tuloslista_proxy_fetch_locks")
      .select("path")
      .eq("path", path)
      .maybeSingle();
    if (error) {
      console.warn(`[tl-proxy] db lock check failed ${path}`, error.message);
      return false;
    }
    return data != null;
  } catch (e) {
    console.warn(`[tl-proxy] db lock check failed ${path}`, e);
    return false;
  }
}

function envelopeFreshness(
  env: CachedEnvelope,
  ttlOf: (body: string) => TtlConfig,
): "fresh" | "stale" | "expired" {
  const ttl = ttlOf(env.body);
  const ageSec = (Date.now() - env.cachedAt) / 1000;
  if (ageSec < ttl.edgeTtl) return "fresh";
  if (ageSec < ttl.edgeTtl + ttl.swrWindow) return "stale";
  return "expired";
}

export async function proxyTuloslista(
  path: string,
  ttlOf: (body: string) => TtlConfig,
  request?: Request,
): Promise<Response> {
  const { originSource, cacheSource } = resolveSources(request);
  const forceOrigin = isForceOrigin(request);

  const originUrl = `${ORIGIN}${path}`;
  // Käytetään aina kanonista cache-avainta riippumatta pyynnön origin-domainista.
  // Näin preview-, dev- ja tuotantopyynnöt jakavat saman Cloudflare-cachen.
  const cacheOrigin = "https://tulokset.online";
  const cacheKey = new Request(`${cacheOrigin}/__tl-proxy${path}`, { method: "GET" });
  const cache = getEdgeCache();

  // Pakotettu origin-kutsu: health-check (monitor) haluaa todellisen
  // origin-vasteen. Ohitetaan kaikki välimuistit, mutta kirjoitetaan
  // tulos takaisin cacheen muiden käyttäjien hyödyksi.
  if (forceOrigin) {
    const body = await getOrFetch(originUrl, cacheKey, cache, ttlOf, path, originSource);
    if (body) return jsonResponse(body, "force-origin", 0);
    return new Response(JSON.stringify({ error: "Upstream unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // 1) Isolaatin muisti — nopein polku.
  const mem = memoryGet(path);
  if (mem) {
    const fresh = envelopeFreshness(mem, ttlOf);
    if (fresh === "fresh") {
      bumpOriginCall(cacheSource, path, "hit");
      return jsonResponse(mem.body, "hit", (Date.now() - mem.cachedAt) / 1000);
    }
    if (fresh === "stale") {
      bumpOriginCall(cacheSource, path, "stale");
      if (cache) kickRefresh(originUrl, cacheKey, cache, ttlOf, path, originSource);
      else void getOrFetch(originUrl, cacheKey, cache, ttlOf, path, originSource);
      return jsonResponse(mem.body, "stale", (Date.now() - mem.cachedAt) / 1000);
    }
  }

  // 2) Postgres DB cache — jaettu totuus kaikkien isolaattien ja domainien kesken.
  const dbEnv = await dbGet(path);
  if (dbEnv) {
    memoryPut(path, dbEnv);
    const fresh = envelopeFreshness(dbEnv, ttlOf);
    if (fresh === "fresh") {
      bumpOriginCall(cacheSource, path, "hit");
      return jsonResponse(dbEnv.body, "hit", (Date.now() - dbEnv.cachedAt) / 1000);
    }
    if (fresh === "stale") {
      // Stale-vastaus palautetaan heti; taustalla yritetään päivittää.
      bumpOriginCall(cacheSource, path, "stale");
      if (cache) kickRefresh(originUrl, cacheKey, cache, ttlOf, path, originSource);
      else void getOrFetch(originUrl, cacheKey, cache, ttlOf, path, originSource);
      return jsonResponse(dbEnv.body, "stale", (Date.now() - dbEnv.cachedAt) / 1000);
    }
  }

  // 3) Cloudflare Cache API — varatier, domainkohtainen avain.
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => undefined);
    if (hit) {
      const env = await readEnvelope(hit);
      if (env) {
        memoryPut(path, env);
        const fresh = envelopeFreshness(env, ttlOf);
        if (fresh === "fresh") {
          bumpOriginCall(cacheSource, path, "hit");
          return jsonResponse(env.body, "hit", (Date.now() - env.cachedAt) / 1000);
        }
        if (fresh === "stale") {
          bumpOriginCall(cacheSource, path, "stale");
          kickRefresh(originUrl, cacheKey, cache, ttlOf, path, originSource);
          return jsonResponse(env.body, "stale", (Date.now() - env.cachedAt) / 1000);
        }
      }
    }
  }

  const staleFallback = mem ?? dbEnv ?? null;

  // 4) Circuit auki? -> yritä antaa viimeisin stale muistista tai cachesta
  const openUntil = circuitOpenUntil.get(path);
  if (openUntil && Date.now() < openUntil) {
    if (staleFallback) {
      bumpOriginCall(cacheSource, path, "circuit");
      return jsonResponse(staleFallback.body, "circuit", (Date.now() - staleFallback.cachedAt) / 1000);
    }
    if (cache) {
      const hit = await cache.match(cacheKey).catch(() => undefined);
      if (hit) {
        const env = await readEnvelope(hit);
        if (env) {
          memoryPut(path, env);
          bumpOriginCall(cacheSource, path, "circuit");
          return jsonResponse(env.body, "circuit", (Date.now() - env.cachedAt) / 1000);
        }
      }
    }
  }

  // 5) Cross-isolate single-flight: yritä ottaa DB-lukko.
  //    Jos saamme lukon, teemme origin-kutsun ja kirjoitamme tuloksen DB:hen.
  //    Jos emme, odotamme että toinen isolaatti täyttää cachen ja palautamme sen.
  const locked = await dbTryLock(path, 10);
  if (locked) {
    try {
      // Varmistetaan vielä, ettei joku muu täyttänyt cachea juuri ennen lukkoa.
      const reCheck = await dbGet(path);
      if (reCheck && envelopeFreshness(reCheck, ttlOf) !== "expired") {
        memoryPut(path, reCheck);
        bumpOriginCall(cacheSource, path, "hit");
        return jsonResponse(reCheck.body, "hit", (Date.now() - reCheck.cachedAt) / 1000);
      }

      const body = await getOrFetch(originUrl, cacheKey, cache, ttlOf, path, originSource);
      if (body) {
        await dbReleaseLock(path, body);
        return jsonResponse(body, "miss", 0);
      }
      await dbReleaseLockEmpty(path);
    } catch (e) {
      await dbReleaseLockEmpty(path);
      throw e;
    }
  } else {
    // Odotetaan, että lukko vapautuu ja toinen isolaatti on kirjoittanut cachen.
    const started = Date.now();
    while (Date.now() - started < LOCK_WAIT_MAX_MS) {
      await new Promise((res) => setTimeout(res, LOCK_POLL_MS));
      const waitedEnv = await dbGet(path);
      if (waitedEnv) {
        memoryPut(path, waitedEnv);
        const fresh = envelopeFreshness(waitedEnv, ttlOf);
        bumpOriginCall(cacheSource, path, fresh === "fresh" ? "hit" : "stale");
        return jsonResponse(
          waitedEnv.body,
          fresh === "fresh" ? "hit" : "stale",
          (Date.now() - waitedEnv.cachedAt) / 1000,
        );
      }
      const stillLocked = await dbLockHeld(path);
      if (!stillLocked) break; // Lukko poistui, mutta dataa ei tullut -> yritä itse
    }
    // Jos odotuksen jälkeenkään ei dataa, yritetään ottaa lukko uudelleen.
    const retried = await dbTryLock(path, 10);
    if (retried) {
      try {
        const body = await getOrFetch(originUrl, cacheKey, cache, ttlOf, path, originSource);
        if (body) {
          await dbReleaseLock(path, body);
          return jsonResponse(body, "miss", 0);
        }
        await dbReleaseLockEmpty(path);
      } catch (e) {
        await dbReleaseLockEmpty(path);
        throw e;
      }
    }
  }

  if (staleFallback) {
    bumpOriginCall(cacheSource, path, "stale-error");
    return jsonResponse(staleFallback.body, "stale-error", (Date.now() - staleFallback.cachedAt) / 1000);
  }

  // 6) Origin feilasi — viimeinen yritys: anna mikä tahansa cache-kopio
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => undefined);
    if (hit) {
      const env = await readEnvelope(hit);
      if (env) {
        memoryPut(path, env);
        bumpOriginCall(cacheSource, path, "stale-error");
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
  originSource: CounterSource,
): Promise<string | null> {
  let p = inflight.get(path);
  if (!p) {
    p = fetchFromOrigin(originUrl, cacheKey, cache, ttlOf, path, originSource);
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
  originSource: CounterSource,
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
    bumpOriginCall(originSource, path, res.status);
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

    const now = Date.now();
    // Isolate-muisti aina: takaa cache-osumat vaikka Cache API ei olisi
    // käytettävissä tai epäonnistuisi hiljaa.
    memoryPut(path, { body, cachedAt: now });
    // DB-kirjoitus tehdään lukon vapautuksen yhteydessä pääpolussa.
    // Kirjoitetaan myös täällä varmuuden vuoksi, jos tätä kutsutaan
    // kickRefreshin kautta ilman erillistä lukkoa.
    void dbPut(path, body);

    if (cache) {
      const ttl = ttlOf(body);
      const totalTtl = ttl.edgeTtl + ttl.swrWindow;
      const envelope = new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-tl-cached-at": String(now),
          // Cache APIn omat säännöt: pidä kopio totalTtl ajan.
          "cache-control": `public, max-age=${totalTtl}`,
        },
      });
      await cache.put(cacheKey, envelope).catch((e) => {
        edgeCacheDisabled = true;
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
    bumpOriginCall(originSource, path, 0);
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
  originSource: CounterSource,
) {
  if (inflight.has(path)) return;
  // Fire-and-forget. Worker-runtime usein pitää isolaatin elossa muiden
  // pyyntöjen ansiosta, ja seuraava lukija saa freshin vastauksen.
  const p = fetchFromOrigin(originUrl, cacheKey, cache, ttlOf, path, originSource);
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
      // Käynnissä — alkuperäinen on yleisin polling-kohde, mutta suorituspaikan
      // livenäytön viive halutaan pieneksi. Proxy koalisoi rinnakkaiset kutsut,
      // joten yleisömäärän kasvu ei kerrannaista origin-kuormaa.
      return { edgeTtl: 3, swrWindow: 7 };
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
