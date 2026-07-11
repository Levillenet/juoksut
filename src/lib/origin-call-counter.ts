// Kevyt "fire-and-forget" laskuri tuloslistan rajapintakutsuille.
//
// Sinne mihin tuloslistalle todella lähtee pyyntö (harvester, hot cycle,
// monitor, reunavälimuistin miss) kutsutaan bumpOriginCall. Reunavälimuistin
// hit/stale-vastaukset kirjataan omalla source-arvolla, jotta admin näkee,
// kuinka moni käyttäjän pyyntö palveltiin omalta reunapalvelimelta.
//
// Kirjoitus ei saa hidastaa vastausta eikä feilata upstream-kutsua — kaikki
// virheet niellään ja logitetaan console.warn:iin.

export type CounterSource =
  | "harvester"
  | "hot_cycle"
  | "monitor"
  | "proxy_origin"
  | "proxy_cache"
  | "admin_probe";

export type PathKind =
  | "list"
  | "schedule"
  | "properties"
  | "results"
  | "other";

/** Poimii tuloslistan URL-polusta karkean tyypin analytiikkaan. */
export function classifyPath(path: string): PathKind {
  // Normalisoi: hyväksy sekä `/live/v1/...` että `/...` -alkuinen polku.
  const p = path.replace(/^\/live\/v1/, "");
  if (p === "/competition" || p === "/competition/") return "list";
  if (/^\/competition\/\d+\/properties\/?$/.test(p)) return "properties";
  if (/^\/competition\/\d+\/?$/.test(p)) return "schedule";
  if (/^\/results\/\d+\/\d+\/?$/.test(p)) return "results";
  return "other";
}

/** Ryhmittelee HTTP-vastauksen karkeaan bucketiin. */
export function statusBucket(status: number): string {
  if (status === 0) return "error";
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return `${status}`; // 401/403/404/429 näkyvät tarkasti
  if (status >= 500 && status < 600) return `${status}`;
  return `${status}`;
}

/**
 * Kirjaa yhden kutsun laskuriin. Kutsutaan fire-and-forget — palauttaa
 * välittömästi, kirjoitus tehdään taustalla.
 */
export function bumpOriginCall(
  source: CounterSource,
  pathOrKind: string,
  status: number | string,
  delta = 1,
): void {
  const kind = pathOrKind.startsWith("/") ? classifyPath(pathOrKind) : (pathOrKind as PathKind);
  const bucket = typeof status === "number" ? statusBucket(status) : status;
  // Käynnistä taustatyö ilman awaitia — halvin mahdollinen kutsu upstream-polulla.
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.rpc("bump_origin_call", {
        _source: source,
        _path_kind: kind,
        _status_bucket: bucket,
        _delta: delta,
      });
      if (error) console.warn("[origin-call-counter] rpc error", error.message);
    } catch (e) {
      console.warn("[origin-call-counter] failed", e);
    }
  })();
}
