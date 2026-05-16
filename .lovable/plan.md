## Ongelma

"Päivän parhaat" -näkymä näyttää Lasyn pm-maastoista vain T8-tuloksen, vaikka tuloslista.com:lla kaikki ikäluokat (T9, P9, T10, P10, T11, P11, T12, P12, T13, P13) ovat jo Official-tilassa ja sisältävät tulokset.

## Juurisyy

`athlete_results`-taulussa kilpailulle 19248 (Lasyn pm-maastot) on vain 1 rivi (T8). Tausta-harvesteri on viimeksi skannannut kilpailun klo **08:12 UTC**, jolloin vain T8-juoksu oli juostu. Muut sarjat juostiin klo 08:15–09:15 UTC, mutta uutta skannausta ei ole tehty, vaikka kellonaika on jo huomattavasti myöhemmin.

Harvesterin **revisit-jono** valitsee kierrätettävät kilpailut näin:

```sql
select competition_id
from harvest_competitions
where done = false
order by last_scanned_at asc
limit 120
```

Tällä hetkellä `done = false` -kilpailuja on **1 270** ja niistä **892** on skannattu kilpailua 19248 *aikaisemmin* (ne ovat kaikki vanhoja, useiden vuosien takaisia kilpailuja, joissa harvestoija odottaa "myöhästyneitä" päivityksiä 365 päivän ajan). Koska revisit-jonon raja on 120 kierrosta kohden, tämän päivän käynnissä olevat kilpailut jäävät jonon päähän ja niitä päivitetään vain noin kerran 6–8 ajossa.

Lopputulos: tämän päivän kilpailut päivittyvät hitaasti, ja samalla "Päivän parhaat" -lista jää vajaaksi.

## Korjaus

Priorisoi revisit-jonossa kilpailut, joiden `competition_date` on lähihistoriaa (tämä päivä tai eilen). Jaetaan revisit-budjetti kahteen osaan saman ajon sisällä:

1. **Tuore jono** (etusijalla): `competition_date >= now() - 2 päivää`, järjestys `last_scanned_at asc`. Tämä takaa, että tämän päivän käynnissä olevat kilpailut päivittyvät joka ajossa.
2. **Vanha jono** (täytöksi): loput rivit `done = false` -joukosta vanhassa järjestyksessä `last_scanned_at asc`, jotta vanhempia keskeneräisiä ei jätetä kokonaan paitsioon.

Toteutus tiedostoon `src/routes/api/public/hooks/harvest-results.ts` (vain rivit ~382–393, sen alueen, joka valitsee revisit-kilpailut):

- Lisää uusi vakio `FRESH_REVISIT_WINDOW_DAYS = 2` ja jaa `REVISIT_LIMIT` esim. niin että `FRESH_REVISIT_LIMIT = 80` ja jäljelle jäävä budjetti (40) käytetään vanhempiin.
- Tee kaksi `from("harvest_competitions").select(...)`-kyselyä:
  1. `done = false AND competition_date >= now() - interval '2 days'`, limit 80, järjestys `last_scanned_at asc`.
  2. `done = false AND competition_date < now() - interval '2 days'`, limit 40, järjestys `last_scanned_at asc`.
- Yhdistä molempien id:t deduplikoiden ja lisää nykyiseen `ids`-listaan kuten ennenkin.

Ei muita muutoksia: `harvest_competitions`-taulun rakenne (siellä on jo `competition_date`-sarake), advisory lock, PB-merkintälogiikka ja kursorin etenemissääntö säilyvät ennallaan.

## Vaikutus käyttäjälle

Seuraavan harvester-ajon jälkeen Lasyn pm-maastot ja muut tämän päivän kilpailut päivittyvät kokonaan, ja "Päivän parhaat" näyttää kaikki ikäluokat (T8, T9, P9, T10, P10, …) heti kun tulokset ilmestyvät tuloslistalle. Vanhempien keskeneräisten kilpailujen kierrätys jatkuu — vain hitaammin kuin nyt.

## Rajaukset

- Ei muutoksia tietokannan rakenteeseen.
- Ei muutoksia frontendiin (`DailyBestSection`, `daily-best.ts`).
- Ei muutoksia muiden harvesterien tai cronien aikataulutukseen.
