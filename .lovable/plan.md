
# Rata-/suora-konfliktin korjaus

## Diagnoosi

Tällä hetkellä `isVenueForEvent` sallii kaikki <300 m juoksut sekä `track_straight` että `track_oval` -tyypille. Tämä on liian löysä: 200 m vaatii kaarteen + etusuoran eli koko ovaalin, joten se ei voi koskaan olla suoralla. Lisäksi solver ei tunne käsitettä "ovaalin käyttö lukitsee suorat", joten 200 m+ menee samalle ajalle 60 m:n kanssa eri "paikoille", mikä on fyysisesti mahdotonta jos suorat ovat osa ovaalia.

Käyttäjän pyynnön mukaan tehdään tarkalleen kaksi muutosta — ei muuta solver-logiikkaa.

## Muutos 1 — `src/lib/planner-defaults.ts`

Korvataan `isVenueForEvent` käyttäjän antamalla logiikalla, hieman kondensoituna:

- Aitajuoksut: matka ≤ 80 m → `track_straight` tai `track_oval`; muuten vain `track_oval`.
- Kenttälajit kuten nyt (kuula, kiekko, moukari, keihäs, hyppylajit).
- Viesti/relay: aina `track_oval` (tarkistetaan ENNEN matkanparserointia, koska "4x60m viesti" parsiutuu 60 metriksi).
- Tavalliset juoksut: matka ≤ 100 m → straight tai oval; matka ≥ 101 m → vain `track_oval`. **Erityisesti 200 m ei enää salli `track_straight`.**

`parseDistanceM` säilytetään ennallaan; viesti-lyhenne ohitetaan jo ennen matkatarkistusta, joten "4x60m" päätyy oikein ovaalille.

## Muutos 2 — `src/lib/planner-solver.ts` (oval/straight-keskinäislukitus)

Lisätään uusi tilataulukko `ovalBusy: Array<{ s, e }>` ja `straightBusy: Array<{ s, e }>` solver-funktion sisälle (samaan paikkaan kuin muutkin tilakoneet, ~rivi 213).

Apufunktio `kindOfVenueId(id)` käyttää olemassa olevaa `venueKindById`-mappia.

Sijoitusvaiheessa (sisempi for-silmukka, ~rivi 303-325) `groupBlockUntil`-tarkistuksen rinnalle lisätään `trackLockoutUntil(cand, candidateStart, candEnd)`:

- Jos kandidaattipaikoissa on `track_oval` → tarkista ettei `straightBusy` sisällä päällekkäistä jaksoa; jos sisältää, palauta `Math.min(...päällekkäisten.e)`.
- Jos kandidaattipaikoissa on `track_straight` → tarkista vastaavasti `ovalBusy`.
- Muuten 0.

Jos `trackLockoutUntil > 0`, `candidateStart` viivytetään samalla mekanismilla kuin `blocked`-haarassa nyt.

Sijoituksen lopuksi (~rivi 346-350) kun segmentti merkitään paikatuksi:

- Jos jokin valittu venue on `track_oval` → `ovalBusy.push({ s: candidateStart, e: segEnd })`.
- Jos jokin on `track_straight` → `straightBusy.push({ s: candidateStart, e: segEnd })`.

Tämä on minimaalinen lisäys olemassa olevan `groupBlockUntil`-mallin viereen — ei kosketa vaihejärjestyslogiikkaa, kestoja, palautusaikoja eikä ikäluokkien busy-laskentaa.

## Verifiointi

1. Aja YAG (kopio) -generointi.
2. Vertaa varoituksien määrää edelliseen ajoon.
3. Tarkasta aikataulusta:
   - T13 60 m ja T13 200 m eivät enää päällekkäin (200 m ei voi sijaita track_straight-paikalla)
   - Kun jokin ikäluokka juoksee 200 m+ ovaalilla, mikään toinen juoksu ei ole samaan aikaan suoralla
   - Kaksi suoraa sprinttiä (60 m + 60 m / 60 m + 100 m) voi olla yhtä aikaa, kun ovaali on vapaa.
4. Raportoi käyttäjälle: varoituksien määrä ja konkreettiset esimerkit aikataulusta.

## Rajaukset

- EI muuteta phase/heat-logiikkaa, kestolaskentaa, palautusaikoja eikä konfliktiryhmien API:a.
- EI lisätä automaattista konfliktiryhmää tietokantaan — sääntö elää solverin sisällä, koska ovaali ja suorat ovat fysikaalisesti aina sama rakenne.
- Yksikkötestit lisätään kommenttina `planner-defaults.ts`-tiedoston loppuun (tai erilliseen testiin jos sellainen on olemassa — tarkistetaan build-modessa).
