Havainto tietokannasta:

- Eilen 26.7. kirjautui 7130 origin-laskuria ja vain 98 proxy-cache-osumaa.
- Tämä ei selity käyttäjäprofiililla. Eilen sovelluksessa oli vain noin 20 uniikkia kävijää ja 140 analytiikkatapahtumaa.
- Suurin origin-kuorma ei tullut suoraan käyttäjävolyymistä, vaan taustatyöstä ja hot cyclestä:
  - harvester results: 3597
  - hot_cycle results: 767
  - käyttäjäpuolen proxy_origin results: 1298
  - käyttäjäpuolen proxy_origin schedule: 944
- Cache-taulussa on dataa, eli jaettu cache toimii osittain, mutta laskurin perusteella liian moni polku päätyy silti origin-hakuun.
- Valvonta näyttää lähteen olevan terve, joten kyse ei ole siitä, että reuna ei voisi palvella, vaan siitä, että nykyinen TTL ja hakustrategia päästävät liian paljon pyyntöjä originille.

Johtopäätös:

- Ei, eilinen käyttöprofiili ei yksin perustele noin suurta origin-määrää.
- Taustahaku hakee tuloksia liian laajasti ja/tai liian usein.
- Lisäksi käyttäjäpolun schedule-hakuja menee originille suhteettoman paljon, mikä viittaa siihen, että kilpailukohtaisia aikatauluja kysytään liian pienellä yhteisellä hyötyikkunalla.

Korjaussuunnitelma:

1. Rajataan taustaharvesterin tuloshaku tiukemmin
   - Priorisoidaan vain kilpailut, joissa on oikeasti tämän päivän tai lähiajan aktiivisuutta.
   - Vähennetään vanhojen ja jo valmiiksi käsiteltyjen kilpailujen tulos-endpointtien uudelleenhakua.
   - Säilytetään self-healing, mutta ei anneta sen skannata laajaa joukkoa jokaisessa ajossa.

2. Muutetaan hot cycle vähemmän aggressiiviseksi
   - Hot cycle saa jatkossakin pitää käynnissä olevat lajit tuoreina.
   - Se ei saa hakea koko kilpailun laajaa tapahtumajoukkoa jatkuvasti, jos käyttäjä ei oikeasti katso niitä.
   - Pidetään kuuluttaja ja suorituspaikan livenäyttö etusijalla, mutta koalisoidaan samat tulokset yhteisen cachen kautta.

3. Nostetaan aikataulu- ja properties-välimuistin hyötyä
   - Schedule ja properties muuttuvat hitaasti, joten niiden TTL voi olla nykyistä pidempi.
   - Tämä vähentää erityisesti eilisen kaltaisia 944 schedule-origin-pyyntöä.

4. Korjataan mittarointi ymmärrettävämmäksi
   - Erotellaan admin-näkymässä selvästi:
     - taustaharvesterin origin-haut
     - hot cyclen origin-haut
     - käyttäjän käynnistämät origin-haut
     - jaetusta cachetaulusta palvellut hit/stale
     - selain tai edge-cache hitit
   - Nykyinen “reuna” näyttää vain proxy_cache-lähteen, mutta ei anna koko kuvaa jaetun DB-cachen hyödyntämisestä.

5. Lisätään päivittäinen “miksi originille mentiin” tarkistus
   - Tallennetaan tai näytetään top-polut, joista origin-kutsut syntyvät.
   - Näin seuraavalla kerralla nähdään heti, onko piikki esimerkiksi yhdestä kisasta, yhdestä scoreboardista, hot cyclestä vai harvesterin backlogista.

6. Varmistetaan muutoksen jälkeen luvuista
   - Verrataan seuraavan ajon jälkeen origin_call_daily-jakaumaa.
   - Tavoite: käyttäjäpuolen proxy_origin laskee selvästi ja schedule-origin lähes katoaa normaalikäytössä.
   - Harvesterin origin-määrän pitää laskea niin, että se vastaa aktiivisten kilpailujen todellista määrää, ei koko mahdollista kilpailumassaa.