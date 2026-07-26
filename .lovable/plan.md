## Mistä on kyse

Lohja Junior Games (kisa-ID 20126) on tietokannassa merkitty tilaan "ei löydy lähteestä", vaikka kilpailu on edelleen olemassa tuloslistalla ja siitä on jo 961 tulosriviä. Tarkistetut faktat:

- `harvest_competitions`-rivi 20126: `exists_in_source = false`, `last_event_date = null`, `row_count = 0`, `done = true`, viimeisin skannaus 25.7. klo 14:32.
- Tuloslistan rajapinta palauttaa nyt kilpailun normaalisti (nimi ja alkupäivä löytyvät), eli kyse oli hetkellisestä häiriöstä.
- Viimeisin tulosrivi koko järjestelmässä on 25.7. klo 14:10, eli kisaa ei ole sen jälkeen käyty kertaakaan läpi.

Syy: kun kilpailun perustietojen haku epäonnistuu hetkellisesti, tulostenhaku kirjoittaa riville "ei löydy lähteestä", tyhjentää viimeisen kilpailupäivän ja merkitsee kisan valmiiksi. Tämän jälkeen kisa suodattuu pysyvästi pois sekä uudelleenskannauksesta että etusivun "käynnissä tänään" -logiikasta, joten seuran urheilijat eivät näy.

## Mitä korjataan

1. **Hetkellinen häiriö ei saa tuhota tietoa.** Kun perustietojen tai aikataulun haku epäonnistuu, riville ei kirjoiteta `exists_in_source = false` eikä nollata `last_event_date` / `row_count`, vaan aiemmat arvot säilytetään ja vain `last_scanned_at` päivittyy.
2. **Kisaa ei merkitä valmiiksi epävarmalla tiedolla.** `done = true` asetetaan vain, kun aikataulu on saatu luettua ja viimeinen kilpailupäivä on menneisyydessä.
3. **Itsekorjautuvuus.** Uudelleenskannauslistalle otetaan mukaan myös kisat, joiden `exists_in_source = false` mutta joiden alkupäivä on viimeisen 3 vuorokauden sisällä, jotta väärä merkintä korjaantuu automaattisesti seuraavalla ajolla.
4. **Nykyisen tilanteen palautus.** Nollataan virheelliset merkinnät niiltä viime päivien kisoilta, joilla on tuloksia tietokannassa mutta `exists_in_source = false` tai `last_event_date` puuttuu, jotta Lohja Junior Games ja vastaavat tulevat heti takaisin näkyviin.

## Tekniset yksityiskohdat

- `src/routes/api/public/hooks/harvest-results.ts`
  - `processCompetition` erottaa "kisaa ei ole olemassa" (rajapinta vastasi, mutta kilpailua ei löydy) ja "haku epäonnistui" (verkkovirhe, 5xx, rate limit) toisistaan omalla paluuarvolla.
  - `harvestIds` kirjoittaa `scanRecords`-riville vain turvalliset kentät epäonnistuneessa tapauksessa; `last_event_date` ja `row_count` säilytetään aiemmasta rivistä (ladataan samaan aikaan kuin `first_scanned_at`).
  - `last_event_date` fallbackina käytetään aiempaa arvoa tai `competition_date`-päivää, ei koskaan `null`ia jos vanha arvo oli olemassa.
  - Pending-listan suodatin ottaa mukaan `exists_in_source = false` -rivit, joiden `competition_date >= tänään - 3 vrk`.
- Datan korjaus tehdään päivityskyselynä `harvest_competitions`-tauluun (ei skeemamuutosta): kisoille, joilla on rivejä `athlete_results`-taulussa viimeisen 5 vrk ajalta, asetetaan `exists_in_source = true`, `done = false` ja `last_event_date` tulosten perusteella.
- Frontendiin ei tarvita muutoksia: `src/lib/competition-list.ts` toimii oikein heti kun tietokannan rivit ovat kunnossa.
