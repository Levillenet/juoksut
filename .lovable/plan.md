## Päivitystiheys nyt

Suorituspaikan livenäyttö hakee lajin tiedot **15 sekunnin välein** (`eventDetailsQueryOptions` → `refetchInterval: 15_000`). Ei tarvetta muuttaa.

## Lisäykset livenäyttöön

Muokataan vain `src/routes/scoreboard.tsx` (header-osio, `ScoreboardLive`):

### 1. Kello headeriin
- Lisätään `useEffect`-ajastin (1 s), joka pitää `now`-tilan ajantasaisena.
- Näytetään Helsinki-aikaan muotoiltu **HH:MM:SS** isolla, tabular-numeroilla, statuksen oikealle puolelle.
- Mobile/kapealla ruudulla (alle 900 px) näytetään **HH:MM** ilman sekunteja, ettei rikota top-valitsinta.

### 2. Tuuliolosuhteet
- API antaa tuulen kahdella tasolla: `Heat.Wind` ja `Allocation.Wind` (per yritys -tuulet eivät ole mukana).
- Lasketaan näytettävä tuuli näin:
  - Jos `round.Heats[0].Wind` on numero → käytetään sitä erän tuulena.
  - Muussa tapauksessa otetaan **viimeisin ei-null `Allocation.Wind`** allokaatioiden joukosta (tuoreimman yrityksen kuvaaja).
  - Jos kumpaakaan ei ole, tuuli-elementtiä ei renderöidä (kuula, korkeus, keihäs jne.).
- Esitys: pieni "rinta" headerissa, esim. `Tuuli +1.2 m/s`. Etumerkki näkyvissä (`+`/`−`), yksi desimaali. Sallittu rajat ylittävä korostuu (yli +2.0) eri värillä.

### 3. Layout
- Header säilyy yhden rivin korkuisena. Järjestys vasemmalta oikealle:
  takaisin · laji + kierros + status · **kello** · **tuuli (jos saatavilla)** · top-valitsin · päivitä.
- Kapealla ruudulla kello + tuuli sijoittuvat omalle riville statusrivin alle, jotta top-valitsin mahtuu.

## Mitä ei muuteta

- Päivitystiheys (15 s) ja datalogiikka säilyvät ennallaan.
- Kortit, picker-näkymä, ScoreRow-komponentti ja tyylit eivät muutu.
- Muita reittejä ei kosketa.