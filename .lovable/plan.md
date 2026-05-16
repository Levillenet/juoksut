## Tilanne

Tarkistin missä kilpailutuloksia järjestetään näytöllä:

- `src/routes/round.$eventId.$roundId.tsx` (Lopputulokset-osio) — käyttää jo `ResultRank`. OK.
- `src/components/announcer/shared.tsx`, `CompletedSection`, `RecordsBanner` — käyttävät jo `ResultRank`. OK.
- `src/routes/scoreboard.tsx` — käyttää jo `ResultRank` ensisijaisesti, numero fallbackina. OK.
- `src/routes/watch.tsx`, `src/routes/seuraa.$token.tsx` — näyttävät urheilijan oman sijoituksen suoraan `ResultRank`-arvolla. OK.
- `src/lib/daily-best.ts` — edellisessä korjauksessa otettu `ResultRank` käyttöön kisan sisällä. OK.

**Ainoa kohta joka ei vielä käytä ResultRankia kilpailutuloksien esittämiseen:**

- `src/routes/print.club.tsx` (rivi 108) ja `src/routes/print.watched.tsx` (rivi 91) järjestävät erän kilpailijat aina `heatIndex` + `Position` mukaan (= lähtöjärjestys). Tämä on järkevää ennen kisaa ja sen aikana, mutta kun erän tulokset on jo julkaistu (Official / Progress ja `ResultRank` annettu), näiden tulosteiden pitäisi näyttää virallinen lopputulosjärjestys eikä lähtöjärjestys — muuten esim. korkeushypyn pudotuksilla ratkaistut sijoitukset näkyvät väärässä järjestyksessä.

## Korjaus

Päivitä molempien tulostenäkymien `allocs`-järjestys siten, että:

1. Jos vähintään yhdellä erän kilpailijalla on `ResultRank` (= kisa on edennyt tuloksiin asti), järjestä KAIKKI rivit ensisijaisesti `ResultRank`-arvon (nouseva, `null` viimeiseksi) mukaan.
2. Muutoin säilytä nykyinen `heatIndex` + `Position` -järjestys (lähtöjärjestys).

Muutos tehdään kahteen tiedostoon: `src/routes/print.club.tsx` ja `src/routes/print.watched.tsx`.

Muita muutoksia ei tarvita — kaikki muut kilpailutulosnäkymät käyttävät jo `ResultRankia`.