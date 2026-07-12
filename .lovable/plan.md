## Tilanne

Etusivun valo katsoo nyt vain "milloin viimeinen tulos tallennettiin". Jos päivällä ei ole yhtään uutta tulosta (esim. hiljainen aamu tai kilpailut alkavat vasta iltapäivällä), valo menee turhaan punaiseksi vaikka haku toimii täysin normaalisti.

Toinen ongelma: kaksi- ja monipäiväisiä kilpailuja (esim. Jymy Games 11.–12.7.) ei tunnisteta jatkuvina. Kilpailu on tietokannassa vain aloituspäivällä 11.7., joten palvelu ajattelee, ettei "tänään" ole kilpailuja vaikka kilpailua ajetaan koko päivän.

## Mitä tehdään

### 1. Kilpailun kesto tunnistetaan aikataulusta

Kun haku käy kilpailun aikataulun läpi, tallennetaan `harvest_competitions`-tauluun myös **viimeisen erän päivämäärä** (Helsingin aikaa). Näin kilpailu tunnetaan sen todellisella keston pituudella eikä vain aloituspäivällä. Kun tänään on tuon välin sisällä, kilpailu tunnistetaan käynnissä olevaksi.

Sama tieto käytetään "hot cycle" -listauksessa ja "tänään ei kilpailuja" -tunnistuksessa, joten kaikki näkymät alkavat kohdella monipäiväisiä oikein.

### 2. Valon logiikka: "toimiiko haku?"

Valo katsoo jatkossa kolmea signaalia:

- **Ei estoa** (`harvest_state.blocked = false`).
- **Haku on käynyt lähiaikoina** (`last_run_at` alle 15 minuuttia sitten kello 09–21 Helsinki, muulloin viimeisen 12 tunnin sisällä; yöllä hakua ei kuulukaan pyöriä).
- **Kun kilpailuja on käynnissä**, viimeisin tallennettu tulos on korkeintaan noin 30 minuuttia vanha. Jos taas mitään kilpailua ei ole käynnissä, tuoreiden tulosten puuttuminen ei enää värjää valoa punaiseksi.

Käytännössä:

```text
blocked                          → punainen ("haku suljettu, syy X")
haku ei ole käynyt aikaikkunassa → punainen ("haku ei ole käynnistynyt")
kilpailu käynnissä, tulokset vanhoja → keltainen ("tulokset päivittyvät hitaasti")
muuten                            → vihreä
```

Valo saa myös lyhyen selittävän tekstin: "Tänään ei ole kilpailuja", "Kilpailu käynnissä, viimeisin tulos X min sitten", tai "Haku toimii, seuraava kilpailu XX.X.".

### 3. Etusivun "päivän lajit ja kilpailut" -kortti

Sama korjaus: kortti näyttää selkeän tekstin "Tänään ei kilpailuja tuloslistassa" nollien sijaan, jos päivälle ei ole yhtään aktiivista kilpailua. Monipäiväisen kilpailun tapauksessa kortti näyttää oikean määrän, koska kilpailu tunnistetaan käynnissä olevaksi.

## Tekninen puoli

- **Migraatio:** lisätään `harvest_competitions.last_event_date DATE` (Helsinki-päivämäärä). Täytetään taustalla harvesterin seuraavalla ajolla; alustava täyttö olemassaoleville riveille kopioi `competition_date`:n (turvallinen oletus, päivittyy oikein kun aikataulu haetaan uudestaan).
- **Harvester** (`src/routes/api/public/hooks/harvest-results.ts`): kun aikataulu on käyty, lasketaan `max(BeginDateTimeWithTZ)` Helsingin päivämääränä ja kirjoitetaan `last_event_date`.
- **`get_hot_competition_ids`**: ehto muutetaan muotoon `today BETWEEN start_date AND coalesce(last_event_date, start_date)`.
- **Uusi apufunktio** `is_any_competition_active_today()`: palauttaa boolean; käytetään sekä valossa että etusivun kortissa.
- **`src/components/HarvestLight.tsx`**: uusi kolmiportainen tila (vihreä/keltainen/punainen), hakee myös `last_run_at`, `active_today` -tiedot, ja rakentaa selittävän tekstin.
- **`TodayStatsSection`** / etusivun kortti: näyttää "ei kilpailuja tänään" -tilan kun `active_today = false`, käyttäen `last_event_date`-korjattua joukkoa.
- Ei muutoksia ajastuksiin, proxyyn, välimuistiin eikä yöikkunaan.
