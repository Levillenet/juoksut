## Ongelma

Livenäytöllä (scoreboard) esimerkiksi Enni Aavikon pituushypyn PB näkyy virheellisenä (2,82) vaikka historiadatassa on jo Kouvola Junior Gamesin 3,09. Sama ongelma toistuu selostajanäkymän listoissa.

Syy: `src/routes/scoreboard.tsx` laskee jo `eff = effectiveRecord(...)`, joka yhdistää tuloslistan alloc.PB:n omaan `athlete_results`-historiaamme, mutta näytöllä käytetään silti raakoja `row.SB` / `row.PB` -arvoja suoraan Tuloslistalta. Historiadatassa oleva parempi PB ei siis koskaan näy. Sama toistuu `src/components/announcer/shared.tsx`-tiedoston kahdessa lohkossa (rivit 478–479 ja 595–596), joissa käytetään `a.SB` / `a.PB` `eff`:n sijaan.

## Muutokset

1. `src/routes/scoreboard.tsx` rivit 772–783: vaihda `row.SB` → `eff.sb` ja `row.PB` → `eff.pb`. Näytetään PB ensin ja SB vain jos se on eri kuin PB (aiemman "SB priorisoinnin" korjauksen mukaisesti).
2. `src/components/announcer/shared.tsx` rivit 478–479 ja 595–596: käytä `eff.sb` / `eff.pb` `a.SB` / `a.PB` sijaan, sama PB-ensin logiikka. Varmista että `eff` on jo käytettävissä molemmissa lohkoissa (tarvittaessa lasketaan komponentin alussa).

Ei muita muutoksia. Historian latausketju (`useHistoryBaseline` + `record-baseline`) toimii oikein, kunhan sen tulos päätyy näytölle.
