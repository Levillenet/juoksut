## Ongelma

Etusivun tilavalo näyttää punaista ja tekstiä "Tulospalvelu ei ole vastannut hetkeen", vaikka tuloksia todella tulee järjestelmään. Tarkistuksen mukaan:

- `harvest_state.last_run_at` = 11:20 UTC (n. 100 min sitten)
- Uusin tulos `athlete_results.captured_at` = 11:50 UTC (n. 30 min sitten, 275 riviä)

`HarvestLight` päättelee terveyden pelkästään `last_run_at`-kentästä (yli 30 min = punainen). Tuloksia kuitenkin virtaa käyttäjävetoisen hot-cyclen (proxy) kautta, joka tallentaa rivit mutta ei päivitä `last_run_at`-kenttää. Signaali on siis väärä: cron-harvester ei ole ajanut hetkeen, mutta itse tulospalvelu ja järjestelmä toimivat.

## Ratkaisu

Muutetaan `HarvestLight`-komponentin päättelyä niin, että tuoreet tulokset (`last_captured_at`) riittävät terveeksi tilaksi, vaikka `last_run_at` olisi vanhentunut.

### Uusi logiikka

- **Punainen**: `blocked=true`, TAI sekä `last_run_at` että `last_captured_at` yli 30 min vanhoja.
- **Keltainen**: aktiivinen kisa käynnissä, mutta viimeisin tulos yli 45 min vanha (ennallaan).
- **Vihreä**: muutoin.

Tooltip-detaljit säilyvät ennallaan (näyttävät sekä viimeisen ajon että viimeisen tuloksen).

## Toteutus

Muokataan `src/components/HarvestLight.tsx`:
- Lasketaan `captureFresh = lastCap && (now - lastCap) < RUN_STALE_MS`.
- `apiOk = !blocked && (!runStale || captureFresh)`.
- Kun `runStale` mutta `captureFresh`, teksti pysyy vihreänä "Tulokset päivittyvät normaalisti".

## Erikseen huomioitavaa (ei tässä planissa)

Cron-harvesterin `last_run_at` ei ole päivittynyt tuntiin: erillinen selvitys siitä miksi ajastin ei laukea (voi olla Cloudflare-cron tai `harvest_state` update failaa erä-ajossa). Merkitään seuraavaksi tehtäväksi, jos punainen valo palaa uudella logiikallakin.
