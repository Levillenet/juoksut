# Live-tulosten nopeuttaminen: hot-sykli 15 s välein

## Tavoite

Kilpailut jotka ovat parhaillaan käynnissä (uusia tuloksia tippuu mutta ei ole vielä valmiita) saadaan 15 sekunnin viiveellä. Muut kilpailut pysyvät nykyisellä hitaammalla syklillä. Tuloslista.comin kuormitus pysyy maltillisena.

## Miten "kuuma kilpailu" tunnistetaan

Rajapinnasta ei tule "valmis"-lippua, joten johdetaan se kahdesta signaalista tietokannasta:

1. Kilpailu on tullut tuloslistaan (`harvest_competitions.exists_in_source = true`) eikä ole vielä merkitty valmiiksi käsitellyksi (`done = false`).
2. Sinne on tullut uusi tai päivittynyt tulos viimeisen 30 minuutin sisällä (`athlete_results.captured_at` päivittyy joka upsertissa).

Kilpailu "jäähtyy" pois hot-listalta automaattisesti heti kun 30 minuuttiin ei ole tullut mitään uutta, jolloin se palaa normaalille tausta-syklille eikä kuormita turhaan.

## Toteutus

**1. Harvesteriin uusi "hotlist"-tila**

`harvest-results.ts` osaa jo ottaa `fromId/toId`-parametrit yhtenäiselle ID-välille. Lisätään rinnalle `?ids=1,2,3` joka
- käsittelee vain annetut ID:t
- ohittaa raskaan revisit-logiikan
- ei liikuta `harvest_state`-kursoria (tausta-sykli hoitaa sen)
- kirjoittaa tulokset normaalisti `athlete_results`iin

**2. Erillinen advisory-lukko hot-syklille**

Nykyinen lukko `harvest-tuloslista` estää päällekkäiset ajot. Hot-syklille tehdään oma lukko `harvest-tuloslista-hot`, jotta se ja hidas tausta-sykli voivat pyöriä rinnakkain estämättä toisiaan.

**3. Uusi pg_cron -jobi 15 s välein**

Uusi tietokantafunktio joka
- lukee hot-listan yllä olevalla kyselyllä
- jos lista on tyhjä, ei tee mitään (ei turhaa kutsua)
- jos harvester on estotilassa (`harvest_state.blocked = true`), ei tee mitään
- muuten POSTaa `/api/public/hooks/harvest-results?ids=...`

Ajastetaan pg_cronilla 15 s välein (sub-minute-syntaksi).

**4. Indeksi kuumakyselyn nopeuttamiseen**

```
CREATE INDEX idx_athlete_results_comp_captured
  ON athlete_results (competition_id, captured_at DESC);
```

**5. Killswitch koskee myös hot-sykliä**

Sama `blocked`-lippu joka pysäyttää nykyisen harvesterin pysäyttää myös hot-syklin. Jos monitori havaitsee eston, hot-sykli lopettaa kutsut automaattisesti.

## Mitä käyttäjä näkee

- Kun kilpailun tuloksia aletaan syöttää tuloslistaan, viive `athlete_results`iin ja livenäytölle putoaa nykyisestä 2–5 minuutista noin 15–30 sekuntiin.
- Kun kilpailu hiljenee (30 min ilman uutta tulosta), se putoaa automaattisesti tausta-syklille.
- Estotilanteessa hot-sykli pysähtyy ensimmäisenä, joten emme jyskytä rajapintaa.

## Rehellisyyden nimissä

Meidän 15 s ei tarkoita 15 s viivettä käyttäjälle vaan sitä että emme ole itse pullonkaula. Tulos ilmestyy meille sen jälkeen kun toimitsija on syöttänyt sen ja tuloslista on julkaissut sen omassa rajapinnassaan. Kokonaisviive aktiiviselle kilpailulle on todennäköisesti 20–60 s, mikä riittää liveticker- ja kuuluttajakäyttöön mutta ei sekuntikellon korvaajaksi.
