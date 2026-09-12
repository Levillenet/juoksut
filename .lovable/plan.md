# Enni Aavikon puuttuva tulos: korjaus tulosten hakuun

## Mitä tarkistin

Kilpailu "Lasyn pm-ottelu, osa 2" (12.9.2026), laji T8 3-ottelu Pituus:

- Tuloslistan rajapinta antaa juuri nyt tuoreena 11 tulosta, mukaan lukien Enni Aavikko 3.20.
- Meidän tietokannassamme samassa lajissa on vain 8 tulosta, eikä Enniä ole.
- Palvelumme välimuistissa oleva kopio tästä lajista on kello 7.42, ja siinä Ennin, Meerin ja Maisan tulokset ovat vielä tyhjiä. Tulokset on siis kirjattu tuloslistaan vasta tämän kopion jälkeen.

Kaksi syytä yhdessä:

1. Tulostenhaku lukee lajin tiedot välimuistista, joka virallistuneelle lajille saa olla jopa tunnin vanha. Vanhentunut kopio tallennettiin sellaisenaan.
2. Kun lajista on jo edes yksi rivi tallessa ja laji on merkitty viralliseksi, haku ohittaa sen jatkossa. Näin puuttuvat rivit eivät koskaan täydentyneet.

## Mitä korjataan

1. **Tuore tieto talteen:** taustalla pyörivä tulostenhaku hakee käynnissä olevien kilpailujen aikataulun ja tulokset aina suoraan lähteestä, ei vanhentuneesta välimuistista. Tavallisten käyttäjien selailu käyttää edelleen välimuistia, joten kutsumäärä lähteeseen pysyy pienenä.
2. **Vajaat lajit haetaan uudelleen:** laji ohitetaan valmiina vain kun tallennettujen tulosten määrä vastaa lajin osallistujamäärää. Vajaaksi jääneet lajit haetaan uudelleen, kunnes ne täydentyvät.
3. **Järjestys ja määrä:** kierroksella käydään ensin läpi lajit joista puuttuu tuloksia, ja yhden kilpailun kierroksen kattavuutta nostetaan (40 lajia), jotta aamun lajit eivät jää iltapäivällä katveeseen.
4. **Tiheys:** tänään käynnissä olevat kilpailut tarkistetaan 10 minuutin välein kevyellä haulla (aiemmin harvemmin), ja käyttäjän avaama livenäkymä päivittyy edelleen 15 sekunnin sykliä.

Lopuksi ajetaan haku kyseiselle kilpailulle ja varmistetaan, että Ennin 3.20 näkyy tuloksissa, sekä että päivän muutkin vajaat lajit täydentyvät.

## Tekniset yksityiskohdat

Tiedosto `src/routes/api/public/hooks/harvest-results.ts`:

- `fetchJson`/`fetchJsonEx` saavat `fresh`-valinnan, joka lisää sisäiselle proxylle `x-force-origin`-otsakkeen; käytetään aikataululle ja tuloksille kun kyseessä on käynnissä olevan kisan kierros.
- `selectBackgroundEventIds(rounds, storedCounts, cap)` valitsee alkaneet lajit; laji katsotaan valmiiksi vain jos kaikki kierrokset ovat `Official` ja tallennettuja rivejä on vähintään `CountAllocated` verran. Lajitiedot aggregoidaan `EventId`-tasolla ja lajilista järjestetään ensin puuttuvuuden, sitten aloitusajan mukaan.
- `processCompetition` saa valinnat `backgroundOngoing` ja `storedEventIds` (Map: eventId -> rivimäärä); `harvestIds` hakee rivimäärät taulusta `athlete_results` kisakohtaisesti ja välimuistittaa ne ajon ajaksi.
- Taustakierroksen kattavuus `BACKGROUND_HOT_MAX_EVENTS = 40`, uudelleentarkistusväli `ONGOING_TODAY_RESCAN_MS = 10 min`; osittaisessa haussa `harvest_competitions.row_count` säilyttää aiemman maksimin.

Riski kutsumäärään: tuoreet haut koskevat vain tänään käynnissä olevia kilpailuja ja niiden vajaita lajeja, joten lisäys origin-kutsuihin on rajattu ja laskee kun lajit täydentyvät.
