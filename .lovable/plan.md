## Ongelma

Omaseurantasivulla (`/watch`) urheilijan tuloksen PB-merkki ei näy uusille ennätyksille. Esim. Siiri Aavikko, T11 150 m, uusi 21,49 (vanha 22,67) — ei tähteä.

Syy: `effectiveRecord(e.round.EventId, e.alloc)` kutsutaan ilman `history`-parametria. Live-allokaation `PB`-kenttä on usein tyhjä eikä `record_baseline`-snapshotteja ole, joten vertailtava PB jää tyhjäksi ja `detectRecord` palauttaa `null`.

ClubTodaySection ja announcer-näkymät käyttävät jo historiapohjaa (`loadHistoryBaselineForCompetition` + `effectiveRecord(..., { competitionId, athleteKey, eventName })`). Sama puuttuu watch-sivulta.

## Korjaus — `src/routes/watch.tsx`

1. Importoidaan `loadHistoryBaselineForCompetition` tiedostosta `@/lib/history-baseline`.
2. `WatchPage`-komponentissa lisätään `useEffect`, joka kutsuu `loadHistoryBaselineForCompetition(competitionId)` kun `competitionId` muuttuu (sama kuvio kuin `scoreboard.tsx`:ssä).
3. Rivin 772 `effectiveRecord`-kutsuun annetaan kolmas `history`-argumentti:
   ```
   effectiveRecord(e.round.EventId, e.alloc, {
     competitionId,
     athleteKey: athlete.key,
     eventName: e.round.EventName,
   })
   ```
   `athlete.key` saadaan ulomman `watchedSections.map(({ athlete, entries }) => …)` -lohkon `athlete`-arvosta (käytössä jo rivillä 646).

## Tekninen huomio

- `athleteKey`-formaatti `${surname}|${firstname}|${orgId ?? ""}` on sama mitä harvester tallentaa `athlete_results`-tauluun, joten avaimet täsmäävät.
- `loadHistoryBaselineForCompetition` on idempotentti ja muistissa cachetettu, joten useampi kutsu ei aiheuta lisäkyselyitä.
- Ei muutoksia tietokantaan, ei muita tiedostoja.