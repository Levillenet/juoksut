## Tavoite

Kaksi parannusta `PlannerFullGantt`-näkymään:

1. Sijoittamattomat lajit eivät enää vie omaa riviä per laji vaan asetellaan tiiviisti useammalle riville ("wrap-layout"), jolloin näytön pinta-alaa säästyy huomattavasti.
2. Kun sijoittamatonta (tai sijoitettua) blokkia raahataan lähelle scrollausalueen ylä- tai alareunaa, näkymä rullaa automaattisesti, jotta laji voidaan pudottaa myös ruudun ulkopuolella oleville riveille.

## Muutokset (vain `src/components/planner/PlannerFullGantt.tsx`)

### 1. Tiivis "bin-packed" layout sijoittamattomille

- Lasketaan `unplacedLayout` memo: jokaiselle lajille `{left, top, width}` käyttäen yksinkertaista first-fit-pakkausta riveille, joiden leveys = `totalWidth - LEFT_COL`. Jokainen rivi on `ROW_HEIGHT` korkea; uudet rivit lisätään tarpeen mukaan.
- Lopullinen `unplacedRowCount` korvaa nykyisen `unplacedEvents.length`-pohjaisen korkeuden (rivit 919, 942).
- Vasemman sarakkeen lajilistaus (rivit 921–936) poistetaan — koska blokit eivät enää ole 1 laji/rivi, lajinimi näkyy itse blokissa (kuten nytkin). Vasempaan sarakkeeseen jää vain otsikkokaista (rivi 911–916).
- Blokin `top`/`left` luetaan layoutista, ei indeksistä (rivi 948, 959–960).
- `data-base-left` päivitetään layoutin antamaan left-arvoon, jotta horisontaalinen raahaus toimii.

### 2. Drop-paikan laskenta säilyy

`onPointerUp` käyttää jo `venueGrid.getBoundingClientRect()`-pohjaista hit-testiä, joten tiiviimpi layout ei vaikuta pudotuslogiikkaan. Tarkistetaan vain, että `dragRef.origTop` palautetaan oikein uudesta layoutista.

### 3. Auto-scroll raahauksen aikana

Lisätään `onPointerMove`-funktioon edge-scroll:

- Ottaa `scrollRef.current.getBoundingClientRect()`.
- Jos kursorin etäisyys ylä- tai alareunasta < ~60 px, käynnistetään `requestAnimationFrame`-pohjainen scroll-silmukka, joka kasvattaa/vähentää `scrollTop` arvoa (esim. 8–16 px/frame, etäisyyden mukaan skaalaten).
- Säilytetään ajastimen id `scrollRafRef`issa; pysäytetään kun kursori siirtyy pois reuna-alueelta tai `onPointerUp` laukeaa.
- Saman vaakasuuntaisen edge-scrollin voi lisätä symmetrisesti (vasen/oikea reuna) — pieni lisä, hyödyllinen pitkillä päivillä.

### Toteutusjärjestys

1. Lisää `unplacedLayout` memo + päivitä render-osio (rivit 909–997).
2. Lisää `scrollRafRef` + `maybeAutoScroll(e)`-apufunktio; kutsu se `onPointerMove`ssa ja peruuta `onPointerUp`ssa.
3. Verifioi selaimessa: sijoittamattomien osio on huomattavasti matalampi, ja blokin raahaus alas rullaa näkymää.

## Mitä EI muuteta

- Solver-logiikkaa, planner-sääntöjä tai tietokantaa ei kosketa.
- Sijoitettujen blokkien layout/looginen käyttäytyminen säilyy ennallaan.
