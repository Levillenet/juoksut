Korjaan tämän niin, että kuvassa näkyvä vanha erävideo saa tulokset näkyviin heti palvelussa jo olevista tuloksista.

Ongelma nyt:
- Video tietää oikean erän: `athlete_key = heat:400286` / `heat_key = heat:400286`.
- `athlete_results`-taulussa on jo saman kilpailun ja lajin tulokset valmiina.
- Nykyinen backfill yrittää hakea tulokset live-lajidatan kautta vain, jos videolle löytyy `event_id`. Tällä vanhalla videolla `event_id` päätellään epäsuorasti yhdestä osumatuloksesta, ja hakupolku voi jäädä tyhjäksi vaikka omassa tietokannassa tulokset ovat olemassa.

Toteutus:
1. Päivitetään `src/lib/public-videos.ts` niin, että erävideoille haetaan mukaan kaikki saman kilpailun, lajin ja erätekstin (`Erä 2`) tulosrivit palvelun `athlete_results`-datasta.
2. Muodostetaan näistä riveistä `heat_results`-snapshot, jos videolla ei vielä ole tallennettua snapshotia.
3. Päivitetään `src/routes/videot.tsx` niin, että “Näytä erän tulokset” käyttää ensisijaisesti videolle tallennettua snapshotia ja toissijaisesti näistä omista tulosriveistä muodostettua snapshotia.
4. Kun vanhan videon tulokset löytyvät omasta datasta, tallennetaan snapshot videolle kerran `set_heat_results_if_null`-kutsulla, jotta jatkossa sitä ei tarvitse hakea uudelleen.
5. Säilytetään nykyinen live-haun fallback viimeisenä varakeinona, mutta ei anneta sen näyttää “Ei tuloksia”, jos omasta tulostaulusta löytyy tuloksia.

Tarkistus:
- Varmistan tietokannasta, että kuvassa näkyvän `T11 60m aidat · Erä 2` -videon tulosrivit muodostuvat oikein.
- Tarkistan, että laajennus näyttää juoksijat ja tulokset eikä “Ei tuloksia”.