## Diagnoosi

Suorituspaikan livenäytön (`/scoreboard`) datapolku käynnissä olevalle lajille:

```
selain → useQuery (refetchInterval 15 s) → proxy → Cloudflare-reunavälimuisti → tuloslista.com
```

Proxyn TTL käynnissä olevalle lajille (`resultsTtl`, kun jokin kierros on `Progress`): `edgeTtl: 8 s` + `swrWindow: 15 s`. Selain hakee joka 15 s. Nämä yhdessä tuottavat parhaimmillaan noin 15–20 s viiveen, mutta pahimmillaan lähelle 30 s. 7 minuutin viive on paljon suurempi kuin nämä lukemat, joten pelkkä TTL-viritys ei yksin riitä  ongelma on osin myös siinä että toistuvat kutsut osuvat vanhaan välimuistiin ja SWR-virkistys ei aja tarpeeksi tiheään.

Lisäksi: hyppylajien kentän tapauksessa uusi tulos näkyy Attempts-taulukossa (esim. suoritusjärjestyksen seuraava yritys) ennen kuin lopullinen Result-kenttä päivittyy. Jos näytöllä katsotaan vain Result-saraketta, uusi hyppy ei tunnu näkyvän vaikka data on jo tullut.

## Suunnitelma

1. **Tiukennetaan proxyn TTL käynnissä olevalle lajille** (`src/lib/tuloslista-proxy.ts`, `resultsTtl`):
   - `Progress`-tapaus: `edgeTtl: 8 → 3 s`, `swrWindow: 15 → 7 s`.
   - Muut tapaukset ennallaan (Official pysyy pitkänä, jotta origin-kuorma ei kasva).

2. **Nopeutetaan livenäytön clientin polling-taajuutta**  vain suorituspaikan livenäytössä, ei koko sovelluksessa (`src/routes/scoreboard.tsx`):
   - Luodaan paikallinen versio kyselystä, joka periytyy `eventDetailsQueryOptions`-optioista mutta ylikirjoittaa `refetchInterval: 5000` kun aktiivisen lajin jokin kierros on `Progress`, muuten 15 s.
   - Tämä ei kosketa `announcer`-näkymiä (joilla monta lajia auki  15 s on hyvä balanssi origin-kuorman kanssa).

3. **Varmistetaan että hyppylajien näytön viimeisin yritys näkyy heti**:
   - Tarkistetaan että scoreboardin hyppylajien rivi näyttää viimeisimmän epätyhjän `Attempts[i]`-arvon eikä ainoastaan `Result`-kenttää. Jos näin ei ole, korjataan renderöinti käyttämään `getResultVisualState`-apuria (jota `useNewResultsQueue` jo hyödyntää).

## Kuormavaikutus

Käynnissä olevan lajin origin-osumat lisääntyvät noin 15 s → 10 s välein (SWR-virkistys). Yhtä katsojaa kohti se on ~6 kutsua/min per laji. Koska proxy koalisoi rinnakkaiset pyynnöt yhdeksi origin-kutsuksi, yleisömäärän kasvu ei kerrannaista tätä. Vaikutus on maltillinen ja rajoittuu vain aktiivisiin lajeihin.

## Ei muutoksia

- Ei muutoksia harvesteriin tai `athlete_results`-tauluun.
- Ei muutoksia muihin näkymiin (announcer, watch, round).
