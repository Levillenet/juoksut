## Tavoite

"Seuran urheilijat tänään" -listalla PB-merkinnän viereen näytetään, kuinka paljon tulos paransi aiempaa ennätystä (esim. `+5 cm`, `−0,18 s`).

## Muutokset

### 1. `src/lib/club-today.ts`
- Lisätään uusi funktio `fetchClubPreviousPbs(athleteKeys, beforeDate)` joka palauttaa jokaisen `(athlete_key, normalisoitu event_name)` parin parhaan tuloksen **ennen** annettua päivää. Käyttää samaa `isLowerBetter`-logiikkaa kuin `fetchClubPbs`, mutta rajaa `competition_date < beforeDate` (valitun päivän Helsinki-keskiyö).
- Palauttaa `{ text, numeric, category }` jotta improvement voidaan laskea oikein juoksu/kenttä-laji huomioiden.

### 2. `src/components/ClubTodaySection.tsx`
- Korvataan nykyinen `fetchClubPbs`-pohjainen `pbsQuery` (joka palauttaa nykyisen PB:n, sisältäen tämänpäiväiset tulokset) `fetchClubPreviousPbs`-pohjaisella kyselyllä, parametrina valittu päivä `selectedDate`.
- PB-rivillä (`r.was_pb === true`):
  - Lasketaan parannus käyttäen `formatImprovement(r.event_category, r.result_text, previousPb.text)` (importti `@/lib/records`).
  - Näytetään parannus PB-badgen vieressä, esim. `PB +5 cm` tai `PB −0,18 s`.
  - Alariville jää edelleen `PB {previousPb.text}` (eli aiempi ennätys, jonka päälle parannus tuli) — selventää mistä parannettiin.
- Ei-PB-riveillä alarivin "PB {text}" näyttää edelleen aiemman parhaan kuten nytkin (nyt korjautuu myös, koska kysely ei enää sisällä tämänpäiväistä tulosta itseään).

## Tekninen yksityiskohta

- `helsinkiDayBounds(selectedDate).startISO` toimii rajauksena: aiemmat = `competition_date < startISO`.
- `formatImprovement` palauttaa `null` jos parannusta ei voi laskea — siinä tapauksessa näytetään pelkkä "PB" -badge kuten nytkin.
- `was_pb` -lippu tulee suoraan tietokannasta (mark_pbs), joten parannus näytetään vain kun rivi on oikeasti PB. Jos aiempaa tulosta ei löydy (uran ensimmäinen tulos lajissa), parannusta ei näytetä.

Ei muita tiedostomuutoksia, ei skeemamuutoksia.