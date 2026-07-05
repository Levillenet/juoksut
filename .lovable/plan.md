## Ongelma

Stellan (T11, 60 m aidat) sivustolla näkyy edelleen "PB 11,71" väärin. Oikea nykyinen ennätys on 11,55 (Pika- ja aitajuoksukarnevaalit 25.6.), ja aiempi paras oli 11,71 (Lasyn pm-ottelut 4-ottelu 6.6.).

Debug: DB:ssä on molemmat tulokset oikein tallennettuna (Väli-Klemelä|Stella|378, T11 60m aidat 11,55 comp 19800; T11 4-ottelu 60m aidat 11,71 comp 19577). `effectiveRecord`-korjaus watch-sivulle toimii, mutta **erä-/round-sivu (`/round/$eventId/$roundId`) näyttää yhä raakaa `alloc.PB`-arvoa suoraan tuloslistasta**, joka on 11,71.

## Juurisyy

`src/routes/round.$eventId.$roundId.tsx`:
1. Ilmoittautuneet-listassa (rivi 285) ja erän lähtörivissä ennen tulosta (rivi 417) näytetään `{e.PB}` / `{a.PB}` suoraan — ei effectiveRecordin läpi.
2. Sivu **ei kutsu `useHistoryBaseline(competitionId)`** lainkaan, joten vaikka nykyiset `effectiveRecord`-kutsut (rivit 386, 471) välittävät `ageClass/category`, historia-välimuisti on tyhjä ja fallback ei löydä 11,55:tä.

## Korjaus

Yksi tiedosto: `src/routes/round.$eventId.$roundId.tsx`.

1. **Lataa historia-baseline sivulle**: importtaa `useHistoryBaseline` ja kutsu se `competitionId`:llä komponentin alussa (samoin kuin `scoreboard.tsx`:ssä).
2. **Ilmoittautuneet-lista (rivi ~282–286)**: laske `effectiveRecord(e.EventId ?? parseInt(eventId,10), e, { competitionId, athleteKey, eventName, ageClass, category })` ja näytä `eff.pb` / `eff.sb` (tekstit `PB {eff.pb}` / `SB {eff.sb}`).
3. **Erän lähtörivi ennen tulosta (rivi ~415–418)**: sama muutos — käytä `effectiveRecord`ista laskettuja `eff.pb` / `eff.sb`.

Molemmat käyttävät samoja meta-tietoja (`data?.Name`, `data?.Group`, `data?.EventCategory`) jotka jo ovat käytössä sivun muissa `effectiveRecord`-kutsuissa.

## Verifiointi

Playwright: avaa `/round/<eventId>/<roundId>` T11 60m aidat pika- ja aitajuoksukarnevaaleista, tarkasta että Stella Väli-Klemelällä ei näy "PB 11,71" ilmoittautumis-/lähtörivissä. Tulosrivin (11,55) badge näyttää oikein `(PB 11,71)` koska historia sulkee nykyisen kilpailun pois — se on odotettu käyttäytyminen.
