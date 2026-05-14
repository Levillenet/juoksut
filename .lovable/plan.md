## Tavoite

Kun urheilijan tulos rikkoo henkilökohtaisen ennätyksen, se merkitään pysyvästi siihen riviin. Vaikka sama urheilija myöhemmin tekisi vielä paremman tuloksen, alkuperäinen rivi näyttää historiassa edelleen "🏆 PB" -merkin.

## Mitä rakennetaan

### 1. Tietokanta: lippu `athlete_results`-tauluun

Lisätään uusi sarake:
- `was_pb` (boolean, default false) — `true` jos tulos oli urheilijan PB siinä lajissa sillä hetkellä, kun se kirjattiin.

Lisäksi täytetään takautuvasti olemassa oleva data: jokaiselle (athlete_key, normalisoitu event_name) -parille merkitään `was_pb = true` niihin riveihin, joissa kyseinen tulos oli kronologisesti uusi paras siihen mennessä. Track-lajeissa pienin aika voittaa, Field-lajeissa suurin tulos.

### 2. Harvest-hookin päivitys

`src/routes/api/public/hooks/harvest-results.ts` — kun uusi tulos tallennetaan, verrataan urheilijan aiempiin tuloksiin samasta lajista (normalisoitu nimi). Jos uusi tulos on parempi (tai ensimmäinen koskaan), asetetaan `was_pb = true`.

### 3. Käyttöliittymä

`ClubTodaySection`:
- Korvataan nykyinen "korosta jos tulos ≤ PB" -logiikka tarkistuksella `was_pb === true`.
- Näytetään pieni 🏆-merkki tai "PB!" -tagi tuloksen perässä, kun lippu on päällä.
- PB-aika suluissa (nykyinen "PB 7.85") säilyy ennallaan vertailun vuoksi.

Sama merkintä viedään myös:
- `round.$eventId.$roundId.tsx` (lopputulokset & erien rivit) — jos rivin athlete_keylle löytyy `was_pb`-merkintä tästä päivästä/lajista.
- `athlete.$key.tsx` (urheilijan historia) — PB-merkki näkyy historiarivillä.

## Tekninen huomio

- Normalisointi (T9 60m ↔ T11 60m ↔ M 60m) tehdään jo `normalizeEventName`-funktiolla. Sama logiikka käytetään takautuvassa täyttämisessä.
- `was_pb` ei muutu jälkikäteen — se on snapshot tallennushetkestä. Tämä on tarkoitus: historiarivit pysyvät rehellisinä siitä, mikä oli ennätys silloin.
- Ei rakenneta erillistä `personal_bests`-taulua, koska tieto on luonnollinen attribuutti tulosrivissä ja yksi sarake riittää.

## Mitä ei muutu

- `result_numeric`, `result_text` ja muut nykyiset kentät pysyvät ennallaan.
- "Nykyinen PB" -aika sulkujen sisällä lasketaan edelleen lennossa kuten nyt — vain sen rinnalle tulee pysyvä historiamerkki.
