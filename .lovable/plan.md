## Tavoite
Videon "Näytä erän tulokset" -listaan lisätään rata numeron kanssa, jotta katsoja tietää kuka juoksee millä radalla. Rivi muotoon: **sija · rata · nimi · seura · tulos**.

## Muutokset

### 1. `src/routes/videot.tsx` – `HeatResultsToggle`-rivin ulkoasu
Nykyisin näytetään joko sija tai rata (`r{position}`), ei molempia. Uusi rivi:
```
1.  R3  Meikäläinen Matti · Seura   8,45
```
- `sija`: `result_rank` + "."
- `rata`: `R{position}` (position on live-datan `Allocation.Position`, joka on rata Track-lajeissa)
- Jos sija puuttuu (esim. hyppy/heitto tms.), näytetään pelkkä rata; jos rata puuttuu, pelkkä sija.
- Järjestys: ensin radan mukaan nousevasti, tai sijan mukaan jos rata puuttuu.

### 2. `src/lib/public-videos.ts` – `buildStoredHeatSnapshot`
Nykyisin `position: index + 1` asetetaan väärin "radaksi", vaikka `athlete_results`-taulussa ei ole rataa. Korjaus: aseta `position: null`, jotta ratakenttää ei näytetä virheellisenä. Sija tulee `result_rank`-kentästä normaalisti.

### 3. Ei muutoksia tallennettuun snapshottiin
`round.$eventId.$roundId.tsx` tallentaa jo `position`-kentän Allocationsista (= rata). Samoin `videot.tsx`:n live-backfill. Nämä toimivat sellaisenaan – vain näyttö muuttuu.

## Rajaus
Vain UI-muutos + yksi pieni korjaus snapshotin rakentamiseen. Ei tietokantamigraatiota, ei uusia kenttiä.