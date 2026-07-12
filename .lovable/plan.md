## Ongelma

Etusivun valo on jälleen punainen. Tarkistuksen mukaan:
- Viimeisin cron-ajo 36 min sitten (yli 30 min raja)
- Viimeisin tulos 67 min sitten (yli 30 min raja)
- Ei aktiivista kisaa tänään (stats-kortit tyhjiä)

Nykyinen logiikka merkitsee tilan punaiseksi aina kun sekä ajo että kaappaus ovat vanhentuneet, vaikka mikään kisa ei olisi käynnissä. Hiljaisena iltana (kisat päättyneet) tämä on väärä hälytys: mitään ei ole tarkoituskaan tulla, joten "tulospalvelu ei ole vastannut" viesti johtaa harhaan.

## Ratkaisu

Kytketään hälytysraja siihen, onko kisoja käynnissä:

- **Punainen**: `blocked=true`, TAI aktiivinen kisa käynnissä JA sekä ajo että viimeisin tulos yli 30 min vanhoja.
- **Keltainen**: aktiivinen kisa käynnissä, ajo tuore mutta tuloksia ei yli 45 min (ennallaan).
- **Vihreä**: ei aktiivista kisaa, TAI tuoreita tuloksia tulee normaalisti.

Kun kisapäivä on ohi, valo pysyy vihreänä eikä käyttäjää säikäytellä yöllä tai aamulla ennen ensimmäistä kisaa.

## Toteutus

`src/components/HarvestLight.tsx`: siirretään `runStale`/`captureFresh` tarkistus `anyCompetitionToday`-haaraan. Kun kisoja ei ole, palautetaan aina vihreä (ellei `blocked`). Tooltip säilyttää tarkat aikaleimat.

## Erikseen (ei tässä planissa)

Cron-ajastin on hitaanpuoleinen (36 min väli). Tämä on erillinen selvitys jos halutaan tiheämpi tausta-ajo; nyt käyttäjävetoinen hot-cycle hoitaa live-päivitykset.
