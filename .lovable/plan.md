## Ongelma

T10:n päivän paras näyttää voittajaksi Saarelma Tuulen ajalla 5,28, vaikka oikea voittaja on Amanda Gustafsson (4,09). Tietokannassa Amanda on, mutta hänet sivuutetaan järjestyksessä.

Syy: tietokannassa nämä T10 1km -tulokset ovat tallessa kategorialla `event_category = "Street"` ja `sub_category = "Run"` (maantie-/maastojuoksu). Funktio `isLowerBetter(category)` palauttaa `true` ainoastaan kun kategoria on `"Track"`. Niinpä `reduceBest` (ja muut "paras"-vertailut) kohtelevat näitä juoksutuloksia kuten kenttälajeja, joissa suurempi luku voittaa → 5,28 valitaan voittajaksi 4,09:n sijaan.

## Korjaus

Yksi muutos kohdassa `src/lib/athlete-history.ts`:

- Laajenna `isLowerBetter` ottamaan myös `sub_category` huomioon ja palauttamaan `true` kaikille juoksu- ja kävelytyyppisille alalajeille riippumatta siitä, onko `event_category` `"Track"`, `"Street"`, `"CrossCountry"` vms.
- Alalajit joiden ajat ovat pienempi = parempi: `Run`, `Sprint`, `MiddleDistance`, `LongDistance`, `Hurdles`, `Steeple`, `Relay`, `Walk`, `RoadRun`, `CrossCountry`.

Päivitä kaikki kutsupaikat välittämään `sub_category` toiseksi argumentiksi:

- `src/lib/daily-best.ts` (2 paikkaa, `reduceBest` ja `fetchDailyBestForAthletes`)
- `src/lib/today-stats.ts` (3 paikkaa)
- `src/lib/athlete-history.ts` (1 paikka rivillä 133)
- `src/routes/athlete.$key.tsx` (1 paikka — käytetään vain etiketissä, voi jättää nykyiseen muotoon tai välittää myös sub_categoryn)

Tämän jälkeen Amanda Gustafsson 4,09 nousee oikein T10:n päivän parhaaksi, ja sama korjaus pätee kaikkiin maasto-, maantie- ja muihin juoksulajeihin, joiden `event_category` ei ole `"Track"`.

Muita muutoksia ei tarvita (parseResultNumeric tuottaa nykyisellään "4,09" → 4.09 ja "5,28" → 5.28, mikä riittää oikeaan järjestykseen nyt kun pienempi = parempi).