# Korjaa 502-virheet tuloslista-proxyn aikataulukutsuissa

## Oireet (lokeista)
- Edge palauttaa `502` polulle `GET /api/public/tuloslista/live/v1/competition/19401`.
- Cloudflare-virhe: *"The Workers runtime canceled this request because it detected that your Worker's code had hung"*.
- Tapahtuu toistuvasti samalle kisalle (19401) → upstream `cached-public-api.tuloslista.com` palauttaa hyvin hitaasti tai jää roikkumaan.

## Juurisyy
`src/lib/tuloslista-proxy.ts` → `fetchFromOrigin` tekee `fetch(originUrl, …)` ilman `AbortController`-aikakatkaisua. Hidas/jumittunut upstream pitää koko Worker-isolaatin odotuksessa, ja CF tappaa pyynnön ~30 s kohdalla → 502. Circuit breaker reagoi vain statuksiin 429/503, ei timeoutiin, joten breaker ei avaudu ja seuraavat pyynnöt päätyvät samaan jumiin.

## Muutos
Yksi tiedosto: `src/lib/tuloslista-proxy.ts`.

1. Lisää `UPSTREAM_TIMEOUT_MS = 8000` (selvästi alle CF:n hang-katkaisun).
2. `fetchFromOrigin`:
   - Luo `AbortController`, käynnistä `setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)`.
   - Välitä `signal` `fetch`-kutsuun, siivoa timer `finally`-lohkossa.
   - `catch`-haarassa: jos virhe on `AbortError` tai verkko-/fetch-virhe, kirjaa varoitus ja **avaa circuit breakeriin** `circuitOpenUntil.set(path, Date.now() + CIRCUIT_OPEN_MS)`, palauta `null`. Näin seuraavat pyynnöt 60 s ajan palauttavat stalen heti eivätkä jää odottamaan.
3. Pidä nykyiset 429/503-haarat ennallaan.

## Toiminta korjauksen jälkeen
- Hidas upstream → keskeytetään 8 s kohdalla.
- Jos cachessa on stale, käyttäjä saa sen (`x-tl-cache: stale-error`).
- Jos ei stalea, vastaus on `503 Upstream unavailable` (ei enää CF-502 SSR-hangia).
- Circuit pysyy auki 60 s, joten Worker ei polta resursseja saman jumittavan upstreamin uudelleenyrityksiin.

## Mitä ei muuteta
- TTL-konfiguraatioita ei kosketa.
- Reittitiedostoja (`src/routes/api/public/tuloslista/...`) ei muuteta.
- Front-endin React Query -logiikkaa ei muuteta — proxy-vastausten muoto pysyy samana.
