## Diagnoosi

Ruudulla lukee "Ei kisoja tällä aikavälillä" — eli `fetchCompetitionList()` palautti tyhjän listan. `src/lib/competition-list.ts` hakee kisalistan **suoraan selaimesta** osoitteesta `https://cached-public-api.tuloslista.com/live/v1/competition`. Tämä kutsu epäonnistuu tällä laitteella (CORS/verkko), jolloin listasta tulee tyhjä ja valikossa näkyy vain nykyinen "Kisa #19963" fallback‑rivi.

Muut päätepisteet (`/competition/{id}`, `/competition/{id}/properties`, `/results/…`) menevät jo sisäisen proxyn läpi (`/api/public/tuloslista/live/v1/…`) — vain kisalistan haku unohtui proxyn taakse.

## Korjaus

1. **Uusi server-reitti** `src/routes/api/public/tuloslista/live/v1/competition/index.ts` — proxaa `/live/v1/competition` `proxyTuloslista`-funktion läpi. TTL: käytetään uutta lyhyttä TTL:ää (esim. `edgeTtl: 60, swrWindow: 300`), koska lista muuttuu harvakseltaan mutta uudet kisat pitää saada näkyviin nopeasti.
2. **`src/lib/tuloslista-proxy.ts`** — lisää `competitionListTtl`.
3. **`src/lib/competition-list.ts`** — vaihda `fetchCompetitionList` käyttämään `/api/public/tuloslista/live/v1/competition` -osoitetta suoran upstream-URL:n sijaan.

## Vaikutus

- Kisavalitsin (myös urheilijaseurannan yläosassa jatkossa) toimii kaikilla selaimilla/laitteilla ilman CORS-ongelmia.
- Tämän päivän ja huomisen kisat näkyvät heti valikossa.
- Cloudflare-reunacache pienentää upstream-kuormaa.

## Tiedostot

- `src/routes/api/public/tuloslista/live/v1/competition/index.ts` (uusi)
- `src/lib/tuloslista-proxy.ts` (lisää TTL)
- `src/lib/competition-list.ts` (vaihda URL)