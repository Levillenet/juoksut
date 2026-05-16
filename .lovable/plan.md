## Korjaus: juoksuissa käytetään viimeisen kierroksen aikaa

Juoksulajeissa kisan tulos on aina **viimeisen kierroksen** (loppukilpailu / A-finaali / B-finaali) aika — ei nopein aika. Jos urheilija jää alkuerään, alkuerän aika jää tulokseksi. A/B-finaali ratkeaa automaattisesti, koska urheilija esiintyy vain toisen finaalin allokoinneissa.

Kenttälajeissa pidetään nykyinen "paras yritys" -logiikka.

## Muutos

### `src/routes/api/public/hooks/harvest-results.ts`
`processCompetition`-funktiossa `bestForEvent`-logiikka:
- **Track**: aina kun saman urheilijan rivi nähdään uudelleen myöhemmältä kierrokselta (rounds iteroidaan kronologisesti), korvaa edellinen. Eli "viimeisin kierros jossa urheilijalla on tulos" voittaa.
- **Muut (Field, Throw, Combined…)**: säilytä nykyinen "valitse paras numeerinen" -sääntö.

### Backfill
Triggeröidään Kouvolan kisa (17741) heti uudelleen verifiointia varten. Muut kisat päivittyvät automaattisesti taustaharvesterin kautta (done-flagi on jo nollattu viimeisen 365 päivän kisoille).
