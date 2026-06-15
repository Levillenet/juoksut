## Ongelmat nykytilassa

### Solver-regressiot (kahdesta edellisestä muutoksesta)

1. **Saman ikäluokan rinnakkaisuus rata/kenttä-välillä**
   - `AgeState` jaettiin `trackBusyUntil` + `fieldBusyUntil` -kenttiin → saman ikäluokan juoksu ja kenttälaji menevät päällekkäin.
   - Samat urheilijat tekevät sekä rata- että kenttälajeja → kaikki "Sama ikäryhmä päällekkäin" -kriittiset konfliktit.

2. **Rata/suora-lukitus + huono sijoitusjärjestys**
   - Sort-järjestys vertailee `BBB_run_60` ja `BBB_run_200` merkkijonoina → "200" < "60" → 200 m sijoitetaan ENSIN, ovaali varautuu päiväksi, 60 m -finalit/heatsit eivät mahdu.
   - final_b vaatii saman suorituspaikan + ≤2 min taukoa; kun ovaali on välissä varattu, final_b työnnetään tuntien päähän tai seuraavalle päivälle.

### Manuaalinen raahaus rajoittunut

3. **Käyttäjä ei voi raahata lajia toiselle suorituspaikalle**
   - `PlannerFullGantt.tsx` (`onPointerMove`, `onPointerUp`): drag muuttaa vain x-koordinaattia (aikaa). y-koordinaattia ei lueta eikä `venue_id`:tä päivitetä.
   - Käyttäjän pitää voida raahata palkki sekä eri kellonaikaan että eri suorituspaikkariville.

## Korjaussuunnitelma

### 1. Palauta saman ikäluokan kova rajoite — `src/lib/planner-solver.ts`
- `AgeState` takaisin yhteen kenttään: `busyUntil: number`.
- Poista `segUsesTrack`-haarautuminen `ageBusyUntil`-luvussa ja kirjoituksessa.

### 2. Korjaa sijoitusjärjestys — `src/lib/planner-solver.ts` sort-vaihe
- Lisää lyhyille suora-sprinteille (≤100 m, ei viesti) ryhmäavain joka sijoittaa ne ennen ovaalilajeja.
- Käytä numeerista distance-vertailua merkkijonovertailun sijaan.
- Säilytä saman eventId:n vaihejärjestys (heats → final_a → final_b) sekundäärisenä.

### 3. Salli raahaus toiselle suorituspaikalle — `src/components/planner/PlannerFullGantt.tsx`
- `dragRef`: lisää `origVenueId`.
- `onPointerMove`: laske myös `dy` ja seuraa visuaalisesti minkä venue-rivin päällä kursori on (lue `data-venue-id` lähimmästä rivielementistä `document.elementFromPoint`-kutsulla tai elementtiraadasta).
- `onPointerUp`: jos venue muuttui, kutsu mutaatiota joka päivittää `venue_id` + `starts_at` + `ends_at` + `auto_generated:false`.
- Validointi: estä pudotus jos uusi venue.kind ei sovi lajille (`isVenueForEvent`) — näytä toast.
- Varmista että venue-rivit kantavat `data-venue-id`-attribuuttia (lisää tarvittaessa renderöintiin).

### 4. Älä koske
- vaihejärjestyslogiikkaan, kestolaskentaan, palautusaikoihin
- `isVenueForEvent`-säännöstöön
- `trackLockoutUntil`-toteutukseen (käyttäjän pyyntö pysyy: 200 m+ varaa suorat)
- `final_b` `sameVenueAsPhase` + `maxGapAfterPhaseMin` -sääntöihin

### 5. Verifiointi
- Aja YAG (kopio) -generointi: warnings-määrä, "Sama ikäryhmä päällekkäin" (odotetaan 0), "ei mahdu" 60 m -lajeille (odotetaan 0), T13 60m aidat A/B-gap (≤2 min).
- Testaa manuaalisesti: raahaa yksi laji toiselle suorituspaikalle Gantt-näkymässä ja varmista että muutos tallentuu.
