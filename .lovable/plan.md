## Tavoite

Mobiilikäytössä (alle 768 px leveys) leipätekstit, metatekstit ja pienet UI-elementit ovat liian pieniä. Nostetaan perustekstikoot järkevästi ilman, että desktop-näkymä muuttuu tai layout rikkoutuu.

## Lähestymistapa

Tehdään muutos **yhdessä paikassa**: `src/styles.css`. Ei kosketa komponentteja — Tailwindin `text-sm`, `text-xs` jne. saavat mobiilissa hieman isomman renderöinnin globaalin base-kokoasetuksen kautta.

## Muutokset `src/styles.css`

### 1. Nosta html-perusfonttikokoa mobiilissa

Tailwindin `rem`-pohjaiset koot (text-xs = 0.75rem, text-sm = 0.875rem, text-base = 1rem) skaalautuvat automaattisesti, kun `html { font-size }` muuttuu.

```css
@layer base {
  html {
    font-size: 16px; /* desktop pysyy ennallaan */
  }
}

@media (max-width: 767px) {
  html {
    font-size: 17.5px; /* ~+9 % kaikkiin rem-pohjaisiin teksteihin */
  }
}
```

Tämä tekee mobiilissa:
- `text-xs` (12 → 13.1 px)
- `text-sm` (14 → 15.3 px) ← yleisin leipäteksti
- `text-base` (16 → 17.5 px)
- otsikot skaalautuvat samassa suhteessa

### 2. Nosta erikseen `text-xs`-luokan minimi mobiilissa

Pienimmät metatekstit (esim. aikaleimat, sekundääritiedot) ovat usein `text-xs`. Varmistetaan että ne ovat vähintään 13 px mobiilissa — alle sen luettavuus auringossa kärsii. Yllä oleva skaalaus hoitaa tämän jo, mutta lisätään varmistus:

```css
@media (max-width: 767px) {
  .text-xs { font-size: 0.8125rem; line-height: 1.15rem; } /* 13 px */
}
```

### 3. Hieman tiukempi line-height mobiilissa otsikoille

Estetään että kasvaneet otsikot vievät liikaa pystytilaa:

```css
@media (max-width: 767px) {
  h1, h2, h3 { line-height: 1.2; }
}
```

## Mitä EI muuteta

- Komponenttitiedostot, Tailwind-luokat, layout, värit
- Desktop-näkymä (kaikki muutokset `max-width: 767px` -median takana)
- Fonttiperhe

## Riskit ja niiden hallinta

- **Rivivaihdot/ylivuoto:** 9 % kasvu on maltillinen; testaan etusivun ja tuloslistan mobiilissa (390×844).
- **Painikkeiden korkeus** kasvaa hieman → parempi kosketuskohde, ei haitta.
- **Taulukot:** tarkistan että tuloslistan taulukko ei ala vierittämään vaakaan. Jos näin käy, kavennetaan ratkaisua koskemaan vain `body`-tasoa eikä taulukkosolujen sisältöä.

## Vahvistus toteutuksen jälkeen

Avaan mobiili-viewportilla:
- Etusivu (`/`)
- Tuloslista (round/eventid -näkymä)
- Hauskat tilastot

Vertaan visuaalisesti ennen/jälkeen ja varmistan ettei mikään rikkoudu.
