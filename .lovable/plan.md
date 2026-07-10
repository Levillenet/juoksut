## Mistä nollat johtuvat

Selvitin syyn tarkasti tietokannasta ja tuloslistan APIsta:

- Tänään on 4 kisaa (Jalaksen juniorikisat 19983, KUY Games 19970, SFIM 19929, Treenikauppa 19973). Kaikki näkyvät jo tuloslistan APIssa aktiivisina.
- Taustaharavoitsija on kuitenkin merkinnyt jokaisen näistä `exists_in_source = false` klo 22:32 (Helsinki) käynnillään — todennäköisesti hetkellisen upstream-vastaustyhjän tai rate-limitin takia.
- Sen jälkeen kursori (`next_id`) on ehtinyt 20604:ään, kun `latest_id` on 20497. Uudelleentarkistus­valinnat eivät pysty nostamaan näitä ID:itä uudestaan ajoon, koska:
  - "near-today anchor" -kysely vaatii vähintään yhden `exists_in_source = true` -rivin viimeisen 2 vrk:n ajalta → tänään yksikään ei ole → koko lähikohdehaku on tyhjä.
  - "recent-nonexist" -kysely rajoittaa ID:t väliin `latest_id − 300 … latest_id` (= ≥ 20197) → tämän päivän ID:t (19929–19983) putoavat pois.
  - "nonexist" -yleiskysely järjestää vanhimman skannauksen mukaan koko vuoden aukoista → tänään ei mahdu budjettiin.
- Kun `athlete_results` on tälle päivälle tyhjä, kaikki tänään-tilastot (urheilijat, ennätykset, kauden kärki, "seuran urheilijat tänään") näyttävät nollaa.

## Korjaus

Kaksi osaa: heti-korjaus tälle illalle + kestävä muutos, ettei tilanne toistu.

### 1. Kestävä korjaus haravoitsijaan

`src/routes/api/public/hooks/harvest-results.ts` valitsee uudelleen­skannattavat ID:t. Lisätään uusi valinta, joka on totuuslähde tuloslistasta itsestään:

- Uusi apufunktio hakee kilpailulistan (`/live/v1/competition`) ja poimii ne ID:t, joiden `Date` osuu välille [tänään − 3 vrk, tänään + 1 vrk].
- Nämä ID:t liitetään aina ajon `ids`-listaan (samaan tapaan kuin nykyinen `revisitRows`), riippumatta `exists_in_source`- tai `done`-lipuista.
- Tämä ohittaa tilanteen jossa yksi hetkellinen 404/rate-limit "lukitsee" tämän päivän kisan pois haravoinnista, koska tulevat cron-ajot palauttavat sen listalle joka kerta.
- Rajataan budjetti (esim. korkeintaan 40 ID:tä/ajo) ettei worker ylitä aikaraja­budjettia.

Samalla nollataan `exists_in_source = true`, jos probe alkaa palauttaa dataa (nykyinen `processCompetition` tekee tämän jo automaattisesti — `harvestRange` kirjoittaa `scanRecords`-rivin oikein).

### 2. Välitön palautus

Ajetaan käsin haravoitsija noiden 4 ID:n yli (`?from=19929&to=19983`) heti muutoksen jälkeen, jolloin tämän päivän tulokset kerätään ja etusivun tilastot päivittyvät.

### Tekniset yksityiskohdat

- Lisättävä import: `fetchCompetitionList` tai suora fetch tuloslistan proxyn läpi. Koska tämä on server-reitti, kutsutaan suoraan upstream URLia (`https://cached-public-api.tuloslista.com/live/v1/competition`) samalla `fetchJson`-apurilla kuin muutkin harvester-fetchit — sama User-Agent, sama rate-limit­lippu.
- Uusi vakio esim. `FRESH_LIST_LOOKBACK_DAYS = 3`, `FRESH_LIST_LOOKAHEAD_DAYS = 1`, `FRESH_LIST_MAX = 40`.
- Lisätään näiden ID:iden yhdistäminen ennen `harvestRange`-kutsua kohdassa, jossa muut revisit-rivit lisätään (rivi ~672).
- Ei muuteta cursor-logiikkaa: nämä ovat lisä-ID:itä, eivät vaikuta `next_id`:n etenemiseen.

### Ei muuteta

- Etusivun UI-koodia (`TodayStatsSection`, `ClubTodaySection`) ei tarvitse muokata — ne alkavat näyttää oikeat luvut heti kun `athlete_results` täyttyy.
- Ei kosketa cron-aikatauluun.
