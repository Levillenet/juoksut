Havainto: lähdedatassa kisan 19256 P8 3-ottelu Pituus on jo päivittynyt ja käynnissä, mutta tuotannon kuuluttajanäkymä/ticker näyttää jääneen vanhaan P8 Kuula -viestiin. Korjaus kannattaa tehdä etupään päivityslogiikkaan, ei tietokantaan.

Suunnitelma:
1. Muutan kuuluttajan tuloshakujen asetuksia niin aktiiviset lajitulokset haetaan aina varmasti uudelleen 15 sekunnin välein, myös silloin kun näkymä on taustalla tai selaimen fokus ei vaihdu.
2. Lisään pienen cache-busterin Tuloslista API -hakuihin, jotta selain/CDN ei voi pitää kuuluttajan live-tulosta vanhassa vastauksessa pidempään kuin on tarkoitus.
3. Päivitän ticker-logiikkaa niin viimeisin näkyvä ticker-viesti ei jää harhaanjohtavasti vanhaan viestiin, kun Käynnissä-listan live-tulos päivittyy.
4. Varmistan erityisesti P8 3-ottelu Pituus -lajin tilanteen: sen pitää näkyä Käynnissä-osiossa ja kärkikolmikon pitää vastata lähdedataa.

Teknisesti muutokset kohdistuvat todennäköisesti tiedostoihin `src/lib/tuloslista.ts`, `src/lib/tuloslista-queries.ts` ja tarvittaessa `src/hooks/useFieldLeaderChanges.ts` / `src/hooks/useAnnouncerData.ts`. Tietokantamuutoksia ei tarvita.