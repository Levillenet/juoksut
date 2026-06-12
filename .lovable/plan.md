# Visualisointi vain kerran per uusi tulos

## Juurisyy

`src/lib/result-visualization.ts` rakentaa allokaation signaturen näin:

```
result:${result}|rank:${ResultRank}|attempts:...
```

`ResultRank` muuttuu aina kun joku **muu** kilpailija saa tuloksen ja sijoitukset järjestyvät uudelleen. Tällöin Juho Alapien / Luka Klaavuniemen signature muuttuu vaikka heidän oma tulos ja yritykset eivät ole muuttuneet → overlay laukeaa uudelleen.

## Korjaus

### `src/lib/result-visualization.ts`

Poistetaan `rank:${ResultRank}` signaturesta. Signaturen tehtävä on tunnistaa "onko tämän urheilijan oma suoritus muuttunut" — sijoitus on johdannainen, ei oma suoritus.

Uusi muoto:
```
result:${result ?? ""}|${attemptSignature ?? ""}
```

Tämä riittää: kun urheilija saa uuden tuloksen tai uuden yrityksen, signature muuttuu kertaalleen ja overlay laukeaa kertaalleen. Sijoitusten päivittyminen muiden tulosten myötä ei enää aiheuta uutta laukaisua.

## Verifiointi

- TypeScript-tarkistus.
- Manuaalinen testi `/scoreboard`-näytöllä kenttälajissa: kun useampi kilpailija saa tuloksia peräkkäin, kunkin overlay laukeaa vain kertaalleen — ei uudestaan sijoitusten muuttuessa.

## Mitä ei muuteta

- `NewResultOverlay`, `useNewResultsQueue`, `scoreboard.tsx`-diff-logiikka pysyvät ennallaan.
- `ResultRank` näytetään edelleen overlayssa normaalisti (luetaan suoraan allokaatiosta, ei signaturesta).
