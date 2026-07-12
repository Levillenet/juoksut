Havainto datasta:
- Tänään `harvester` näkyy nollana, koska tämänpäiväiset harvesterin ja hot-cyclen pyynnöt ovat kirjautuneet vielä `proxy_origin` ja `proxy_cache` -lähteisiin. Tämä johtuu siitä, että lähdeotsakkeen korjaus vaikuttaa vasta uusiin ajoihin, eikä takautuvasti muuta jo kirjattuja rivejä.
- Tänään laskurissa on tällä hetkellä noin 832 origin-kutsua ja 577 reunavälimuistista palveltua vastausta. Kokonaispalvellut pyynnöt ovat siis noin 1 409, jos origin ja reuna lasketaan yhteen.
- Eilen `harvester` näkyy oikein suurena lukuna, koska silloin kutsut kirjautuivat suoraan harvester-lähteelle ennen proxy-reitityksen muutosta.

Suunnitelma:
1. Päivitän adminin kutsutilastokortin niin, että se näyttää erikseen:
   - `Origin-kutsut tuloslistalle`
   - `Reunasta palvellut`
   - `Yhteensä käsitellyt pyynnöt`
   Tämä poistaa epäselvyyden siitä, miksi 832 ei ole sama kuin kaikki pyynnöt.

2. Lisään saman päivän riville huomautuksen, jos `harvester` on 0 mutta `proxy_origin` tai `proxy_cache` kasvaa:
   - “Taustatyön pyynnöt voivat näkyä proxy-lähteissä ennen lähdeotsakkeen käyttöönottoa.”
   Näin käyttäjä näkee heti, ettei nolla välttämättä tarkoita, ettei ajo olisi käynnissä.

3. Korjaan lähteiden listauksen selkeämmäksi:
   - näytetään myös `proxy_cache`, koska se selittää reunavälimuistin määrän
   - nimetään lähteet käyttäjäystävällisesti, esimerkiksi `harvester`, `hot cycle`, `käyttäjäpyynnöt originille`, `reunavälimuisti`

4. Lisään tarvittaessa pienen “viimeksi päivitetty” tai `updated_at`-tiedon riville, jotta nähdään onko tämän päivän laskuri elävä eikä vanhentunut.

Tekninen toteutus:
- Muutos tehdään `src/routes/admin.tuloslista-probe.tsx` -näkymään.
- Tarvittaessa laajennan `getOriginCallStats`-palautetta niin, että se palauttaa myös päivän viimeisimmän laskuripäivityksen.
- Tietokantaan ei tarvitse tehdä muutosta, ellei haluta myöhemmin takautuvasti uudelleenluokitella tämän päivän proxy-rivejä harvesteriksi, mitä en suosittele ilman varmaa erottelua.