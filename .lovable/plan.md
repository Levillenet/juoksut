## Tilanne

Tarkistin kilpailudatan kahdelta tasolta:

**Mitä tietokannassa on nyt** (75 kisaa):
- 06/2025: 3, 07/2025: 15, 08/2025: 9, 09/2025: 7, 10/2025: 9, 11/2025: 1, 12/2025: 1
- 01–02/2026: 5, 04/2026: 3, 05/2026: 22
- Aikaisin: 25.6.2025

**Mitä rajapinnasta oikeasti löytyy** (skannasin ID:t 10000–17000):
- ID 16456 (5.1.2025) on kaikkein vanhin saatavilla oleva kisa — sitä vanhempaa ei API:sta saa
- Välillä 16456–16999 on 290 kisaa (tammi–touko 2025), joista yksikään ei ole vielä tietokannassa
- Live.tuloslista.com:n etusivun lista palauttaa vain 70 lähikisaa, mutta yksittäiset `/competition/{id}/properties` -kutsut toimivat huomattavasti vanhemmillekin

**Miksi data puuttuu:** harvester (`src/routes/api/public/hooks/harvest-results.ts`) aloittaa kovakoodatusti ID:stä 17000 (`harvest_state.next_id` default = 17000, samoin `Math.max(17000, latestId - TAIL_RESCAN)` tail-moodissa). Koko alkuvuoden 2025 kausi (~290 kisaa) jäi siten skannaamatta.

24 kuukauden takautuva haku ei ole mahdollinen — API:n vanhin kisa on tammikuusta 2025. Käytännössä saamme noin 17 kuukautta, mikä kattaa kaksi täyttä kilpailukautta (2025 ja 2026).

## Suunnitelma

**1. Lasketaan harvesterin alaraja 17000 → 16456**

Tiedostossa `src/routes/api/public/hooks/harvest-results.ts`:
- Lisää vakio `const FLOOR_ID = 16456;` (kommentti: "API:n vanhin kisa, tammikuu 2025").
- Korvaa kovakoodatut `17000`-arvot:
  - Default-arvo `nextId = stateRow?.next_id ?? 17000` → `?? FLOOR_ID`
  - Default-arvo `latestId = stateRow?.latest_id ?? 17000` → `?? FLOOR_ID`
  - `Math.max(17000, latestId - TAIL_RESCAN)` → `Math.max(FLOOR_ID, latestId - TAIL_RESCAN)`
- Päivitä myös tietokannan `harvest_state` -taulun sarakkeiden defaultit `17000` → `16456` migraationa, jotta jos taulu joskus tyhjennetään, alaraja säilyy oikeana.

**2. Resetoidaan kursori takaisin 16456:een, jotta puuttuvat 290 kisaa noudetaan**

Migraationa: `UPDATE harvest_state SET next_id = 16456 WHERE id = 'singleton' AND next_id > 16456;`

`latest_id` (19299) jätetään ennalleen, jolloin harvester tunnistaa olevansa "backfill"-moodissa ja etenee 100 ID:n erissä eteenpäin (16456 → 16555 → … → 17000 → …) kunnes saavuttaa nykyisen latest_id:n. Cron ajaa harvesteria automaattisesti, joten täydennys etenee taustalla ilman käyttäjän toimia.

**3. Ei muutoksia frontendiin**

Sivut (`src/components/RecordsPanel.tsx`, urheilijoiden historia jne.) lukevat `athlete_results`-taulua sellaisenaan, joten uudet rivit näkyvät automaattisesti tuloskehityksessä ja kilpailijaseurannassa heti kun harvester on ehtinyt täydentää ne.

## Miten käyttäjä huomaa muutoksen

Kursori käy 290 puuttuvaa ID:tä läpi 100:n erissä, käytännössä parin–muutaman ajon aikana cronista riippuen. Sen jälkeen kahden kilpailukauden (2025 + 2026 alkuvuosi) kaikki tulokset ovat haettavissa. Vanhempaa dataa kuin tammikuu 2025 ei valitettavasti tuloslistan rajapinnasta saa missään tapauksessa.
