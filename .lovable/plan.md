Kaksi virhettä etusivun "Seuran urheilijat tänään" -listalla Jymy Games -kilpailussa: Siirin 150m näyttää virheellisen PB-merkin ja Ennin 800m jää lukemaan "DNS" vaikka juoksu ajettiin.

## Havaitut juurisyyt

**1) Väärä PB Siirillä (T11 150m 22,11)**
- DB:ssä Siirin 150m tulokset: 21,49 (12.6.), 21,55 (25.6.), 22,67, 23,24, 23,11. Todellinen PB on 21,49.
- `athlete_results.was_pb=false` tälle riville, joten SQL-puoli on oikein.
- Silti UI näyttää "PB −1,13 s" = 23,24 − 22,11. Eli `ClubTodaySection` löytää `pb.numeric=23,24` vaikka DB:ssä on parempi 21,49.
- Syy: `fetchClubPreviousPbs` hakee vain `.in("athlete_key", athleteKeys)`-rivit ilman event-suodatinta ja ilman kilpailuvuosi- tai päivämääräjärjestystä. Rivejä voi olla paljon (kaikki seuran urheilijoiden kaikki lajit), ja PostgREST-oletusraja 1000 leikkaa vanhimmat pois — mutta koodissa on `.limit(10000)` joka _lisätään_ headeriin. Todennäköinen ongelma on että 23,24 pääsee mukaan mutta 21,49 ei, koska Supabase Data API rajoittaa tulosjoukon eri tavalla riippuen `range`-headerista. Vaihtoehtoisesti `pbEventKey` normalisoi eri tavalla samalle riville (ei tässä tapauksessa, koska 150m ei ole spec-sensitive), tai `beatsPrev`-logiikka käyttää `was_pb`-lipun sijaan raakaa parhaan-arvon hakua joka jää epätäydelliseksi.
- Aidosti oikea vertailulähde on jo olemassa: `mark_pbs_for_competitions` merkitsee `was_pb`-lipun oikein, ja DB:ssä paras aiempi 150m löytyy suoraan yhdellä kyselyllä per urheilija/laji.

**2) Enni 800m jäänyt DNS-tilaan**
- Rivi kaapattu 12.7. klo 10:30 UTC arvolla "DNS".
- `harvest_competitions` competition_id=19992 (Jymy Games): `done=true`, `last_scanned_at=2026-07-12 08:07 UTC`, `last_event_date=2026-07-12`.
- Kilpailu on merkitty valmiiksi vaikka `last_event_date` on tänään — harvesteri ei enää skannaa sitä, joten DNS ei päivity oikeaan tulokseen kun 800m myöhemmin juostiin.

## Muutokset

**A. `src/routes/api/public/hooks/harvest-results.ts`** — älä merkitse kilpailua `done=true` jos `last_event_date >= tänään` (Helsinki). Multi-day-tapauksissa `done` saa asettua vasta kun tapahtumapäivä on menneisyydessä. Nykyinen `done`-logiikka (todennäköisesti nojaa siihen että kaikilla lajeilla on `Result` per allocation) ohittaa alkuerä-jälkeisen loppueräpäivityksen; korjataan päivämääräehdolla.

**B. Kertakorjaus DB:hen** — nollataan `done=false` niille kilpailuille joilla `last_event_date >= current_date` Helsinki-aikaan, jotta harvesteri palaa niihin heti seuraavassa ajossa. Tämä ajetaan omana migraationa tai kertaluontoisena päivityksenä.

**C. `src/lib/club-today.ts`** — vaihda `fetchClubPreviousPbs` käyttämään suoraan `was_pb`-lippua ja urheilijakohtaista aiempaa parasta:
- Hae vain `athlete_key + normalized_event_name` -pareja jotka ovat tänään listalla, ei koko urheilijan koko historiaa.
- Käytä RPC:tä tai selkeästi rajattua SELECT-kyselyä joka palauttaa per (athlete_key, pb_key) parhaan `result_numeric` -arvon ennen valittua päivää. Näin PB-vertailu ei enää nojaa mahdollisesti leikattuun asiakassivuun.
- `isPb`-päätös: pidetään `was_pb`-lippu ensisijaisena (koska `mark_pbs_for_competitions` laskee sen kanonisesti), ja `beatsPrev` vain fallbackina jos was_pb ei vielä ehtinyt päivittyä.

**D. `ClubTodaySection.tsx`** — käytä uutta yksinkertaisempaa `pb`-lookupia; poista fallback-map jos ei enää tarvita. Näytä improvement vain jos `was_pb=true` (tai `beatsPrev` on aidosti parempi kuin haettu paras).

## Verifiointi

1. Ajetaan kertakorjaus → `harvest_competitions.done=false` kilpailulle 19992.
2. Odotetaan seuraava harvest-ajo tai laukaistaan käsin → tarkistetaan että Ennin T9 800m saa oikean tuloksen.
3. Etusivulla Siirille T11 150m 22,11: ei enää PB-merkkiä (koska aiempi 21,49 on parempi).
4. Enni T9 150m 25,83: PB-merkki säilyy jos oikeasti PB.

## Ei-tavoitteet

- Ei muuteta muiden osioiden (DailyBest, RecordsBanner) PB-logiikkaa tässä.
- Ei muuteta tuloslistan proxy-välimuistia.
