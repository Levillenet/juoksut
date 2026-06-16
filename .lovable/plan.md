## Bugi: ageStates lukitsee koko sarjan vaikka eri lajeissa on eri urheilijat

Solver käsittelee `ageClass`-arvoa yhtenä jaettuna aikajanana → P11 60m klo 10:00–10:25 estää kaiken muun P11-toiminnan (Kiekko, Korkeus, Kuula) kunnes klo 10:25. Todellisuudessa heittäjät ja hyppääjät ovat eri henkilöitä.

## Korjaus: poista ageStates kokonaan (vaihtoehto C)

Saman lajin vaiheet (alkuerät → finaali) lukitaan jo `eventEnds` + `afterEventIds` + `afterPhaseKey` -mekanismilla, eli ageStates ei tuo lisäarvoa.

Muokattava tiedosto: `src/lib/planner-solver.ts`.

Poistettavat kohdat:
1. `ageStates`-mapin alustus ja `AgeState`-tyyppi (jos käytössä vain täällä).
2. Päivän alussa lisätty `ageStates`-reset (sama korjausblokki jonka lisäsimme äsken).
3. `ageBusyUntil`-muuttujan luku ja sen sisällytys `candidateStart`-laskuun (Math.max).
4. Sama `ageBusyUntil` aitarata-haarassa (rivi ~441).
5. `ageStates.set(...)` sijoituksen lopussa (rivit ~491–495).

Vastaavat varoitukset päällekkäisistä sarjoista jätetään `detectConflicts`-funktioon (informatiivinen, ei rajoite) — tarkistan ettei sitä poisteta.

## Mitä EI muuteta

- `eventEnds`, `phaseEnds`, `phaseVenues`, `ovalBusy`, `straightBusy`, `groupBusy`.
- Venue-rakenne, segmenttien generointi, `detectConflicts`-logiikka.

## Validointi

1. Aja YAG (kopio) -generointi.
2. Raportoi puuttuvien lajien määrä, lista ja yleisin syy.
3. Jos kenttälajit ovat sijoittuneet ja vain ovaali/viestit jäävät, syy on kapasiteetti — ei enää koodi.
