## Mitä mittaukset kertovat

Tarkistin `origin_call_daily`-taulun ja välimuistitaulut. Rajapinta itse toimii (kisalista vastaa nyt paikallisesti `x-tl-cache: hit`), mutta kutsujakauma on pahasti vinossa:

| Päivä | proxy_origin (käyttäjät) | harvester | proxy_cache (osumat) |
|---|---|---|---|
| 25.7. | 5 213 tulokset + 2 084 aikataulut | 4 663 | ~55 |
| 24.7. | 457 + 1 012 | 177 | ~45 |

Eli kutsut menevät lähes aina originille, ei siksi että välimuisti olisi rikki, vaan koska **jokainen kysely osuu välimuistiin vasta sen umpeuduttua**. Kolme vahvistettua syytä:

1. **Aikataulukyselyiden ryöppy kisavalinnassa.** `filterRunningToday` (src/lib/competition-list.ts) hakee jokaiselle viimeisen 6 päivän kilpailulle erikseen `/live/v1/competition/{id}` -aikataulun selaimesta. Näin tekee sekä etusivun `TodayStatsSection` (uudelleen 60 s välein) että `LiveCompetitionsSection`. Kymmeniä rinnakkaisia kutsuja per kävijä. Lukkotaulussa oli tarkastushetkellä juuri 10 samanaikaista aikataulukutsun lukkoa.
2. **Kisavalinta jumittuu tämän takia.** Proxyn cross-isolate-lukko odottaa jopa 10 sekuntia (`LOCK_WAIT_MAX_MS`) per polku, kun toinen isolaatti hakee samaa. Kun avattavan valikon lista odottaa kymmeniä tällaisia kutsuja, valikko ei ehdi täyttyä, eikä avaudu.
3. **TTL on lyhyempi kuin pollausväli.** Käynnissä olevan lajin TTL on 3 s fresh + 7 s stale = 10 s, mutta kuuluttaja- ja livenäyttö pollaavat 15 s välein → joka pollaus on origin-kutsu. Lisäksi `refetchIntervalInBackground: true` pitää auki jääneet välilehdet pollaamassa vuorokauden ympäri (4 kutsua/min = ~5 700 kutsua/vrk per unohtunut välilehti). Tämä selittää eilisen piikin.

## Korjaukset

**1. Kisavalinta ja "käynnissä tänään" DB:stä, ei originilta**

`harvest_competitions`-taulussa on jo `competition_date` ja `last_event_date`. Tehdään server function, joka palauttaa yhdellä DB-kyselyllä tänään käynnissä olevien kilpailujen id:t, ja `filterRunningToday` käyttää sitä. Aikataulun per-kilpailu-haku selaimesta poistuu kokonaan. Vain jos DB:stä ei löydy tietoa (uusi kisa), sallitaan enintään 3 aikataulukutsua.

**2. Kisalista react-queryn taakse**

`fetchCompetitionList` ja kisavalinta siirretään `queryOptions`-pohjaiseksi (`staleTime` 5 min, `gcTime` 30 min), jotta lista jaetaan komponenttien välillä eikä haeta uudelleen joka mountilla. Valikko avautuu heti myös silloin kun taustahaku on kesken (näytetään viimeksi tunnettu lista).

**3. TTL:t vastaamaan pollausväliä**

`src/lib/tuloslista-proxy.ts`:
- Käynnissä oleva laji: fresh 3 s → **12 s**, stale-ikkuna 7 s → **20 s** (15 s pollaus osuu aina välimuistiin; viive kasvaa enintään ~10 s, mikä on livenäytölle yhä riittävä)
- Aikataulu: 30/30 → **60/120**
- Virallistunut laji ja properties: ennallaan

**4. Turhan taustapollauksen lopetus**

`refetchIntervalInBackground: true` pois aikataulu- ja lajikyselyistä (`src/lib/tuloslista-queries.ts`). Tilalle `refetchOnWindowFocus: "always"`, joka on jo käytössä: piiloutunut välilehti lakkaa pollaamasta ja päivittyy heti kun se palaa esiin. Lisäksi pollaus pysäytetään, kun kilpailun kaikki kierrokset ovat `Official`-tilassa.

**5. Lukko-odotus ei saa jumittaa käyttäjän pyyntöä**

Proxyssä `LOCK_WAIT_MAX_MS` 10 s → 2,5 s, ja jos odotus ei tuota dataa, palautetaan heti vanhentunut välimuistikopio (jos on) sen sijaan että jatkettaisiin uuteen origin-yritykseen. Näin yksikään käyttäjän pyyntö ei jää roikkumaan.

## Tekniset yksityiskohdat

- Uusi server function `src/lib/competition-days.functions.ts`: `SELECT competition_id FROM harvest_competitions WHERE exists_in_source AND today BETWEEN competition_date::date AND coalesce(last_event_date, competition_date::date)`, palautetaan id-lista. Autentikointia ei tarvita (julkinen tieto), joten ei `requireSupabaseAuth`.
- Muutettavat tiedostot: `src/lib/competition-list.ts`, `src/lib/tuloslista-proxy.ts`, `src/lib/tuloslista-queries.ts`, `src/components/CompetitionSwitcher.tsx`, `src/lib/today-stats.ts`, uusi functions-tiedosto. Ei migraatiota.
- Varmistus jälkikäteen: kisavalinta avautuu paikallisesti Playwrightilla, ja `origin_call_daily`-jakauman seuranta seuraavana kisapäivänä (odotus: aikataulukutsut lähelle nollaa, tuloskutsut noin puoleen, cache-osumien osuus selvästi nousuun).

## Odotettu lopputulos

Aikataulukutsut originille käytännössä katoavat (2 000 → kymmeniä), tuloskutsut putoavat noin puoleen ja välimuistiosumien osuus nousee sitä mukaa kun katsojia on samalla lajilla. Kisavalinta avautuu välittömästi.
