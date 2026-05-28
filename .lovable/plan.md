## Tulostussuunta: pysty / vaaka

Lisätään `/print`-sivulle valinta tulostussuunnalle ja optimoidaan vaaka-asettelu neljälle sarakkeelle, jotta 109 lajia mahtuu yhdelle taitettavalle A4-arkille.

### UI-muutokset (`src/routes/print.index.tsx`)

- Lajisuodattimen viereen uusi segmenttivalinta: **Pysty (2 saraketta)** / **Vaaka (4 saraketta)**. Oletus: Vaaka (koska kompaktimpi).
- Tila `orientation: "portrait" | "landscape"` säilytetään `localStorage`issa (`print-orientation`) muiden asetusten tapaan.
- Annetaan `<main>`-elementille luokka `print-schedule print-portrait` tai `print-schedule print-landscape` valinnan mukaan.
- Lisätään vihje: "Valitse tulostusikkunassa sama suunta (pysty/vaaka). Vaakaan mahtuu 4 saraketta — voit taittaa A4:n keskeltä pieneksi vihkoseksi."

### CSS-muutokset (`src/styles.css`)

Erotetaan `@page`-säännöt suunnan mukaan käyttämällä erillisiä `@media print` -lohkoja yhdistettynä luokkavalitsimeen `:has(.print-landscape)` rungossa:

```css
@media print {
  /* Yhteiset säännöt (kuten nyt) — fontit, värit, jne. */
}

/* Pysty: 2 saraketta (nykyinen käyttäytyminen) */
@media print {
  body:has(.print-portrait) { /* trigger */ }
  @page { size: A4 portrait; margin: 10mm; }
  .print-portrait { column-count: 2; column-gap: 8mm; }
}

/* Vaaka: 4 saraketta */
@media print {
  @page { size: A4 landscape; margin: 8mm 8mm 10mm 8mm; }
  .print-landscape {
    column-count: 4;
    column-gap: 6mm;
    font-size: 8.5pt;
    line-height: 1.2;
  }
  .print-landscape td { padding: 0.4mm 1mm !important; }
  .print-landscape td.time { width: 3em; }
  .print-landscape h2 { font-size: 9.5pt; }
}
```

Huom: `@page size` on CSS:n globaali — ei voi vaihtaa kesken sivun. Ratkaisu: kirjoitetaan kaksi `@page`-sääntöä eri `@media print` -lohkoihin, jotka ovat ehdollisia `:has()`-valitsimella `<html>`/`<body>`-tasolla, TAI yksinkertaisemmin: asetetaan `<html>`-tasolle data-attribuutti `data-print-orientation` ja käytetään sitä CSS:ssä. Tämä on tuettu kaikissa moderneissa selaimissa (Chrome, Edge, Safari) jotka osaavat `@page`-sääntöjen päättelyn DOM-tilan perusteella.

**Tekninen detalji:** Asetetaan komponentissa `useEffect`-koukulla `document.documentElement.dataset.printOrientation = orientation` ja CSS:ssä:

```css
@media print {
  html[data-print-orientation="landscape"] @page { size: A4 landscape; }
  html[data-print-orientation="portrait"]  @page { size: A4 portrait; }
}
```

Jos `html[...] @page` ei kelpaa kaikissa selaimissa, fallback: kirjoitetaan dynaamisesti `<style id="print-page-style">@page { size: A4 landscape }</style>` `<head>`iin valinnan mukaan ja päivitetään se kun käyttäjä vaihtaa suuntaa. Tämä on luotettavin tapa.

### Vaaka-asettelun mitoitus

A4 vaaka = 297×210 mm. Marginaalit 8mm → tehollinen leveys 281mm. 4 saraketta × 6mm gap = 18mm → sarakeleveys ~65mm. Riittää aika (3em ≈ 12mm) + lajinimi.

109 lajia × ~5mm rivikorkeus = ~545mm sarakekorkeutta yhteensä. Jaettuna 4 sarakkeelle = ~136mm/sarake. Mahtuu hyvin 192mm korkeuteen → **yksi A4-arkki vaakana**, joka voidaan taittaa keskeltä A5-vihkoseksi.

### Lopputulos

- Yksi valinta: Pysty (2 saraketta, 2–3 sivua) tai Vaaka (4 saraketta, ~1 sivu).
- Vaaka mahdollistaa A4-arkin taittamisen pieneksi taskuun mahtuvaksi vihkoseksi.
- Valinta säilyy seuraavalla käyntikerralla.

### Tiedostot
- `src/routes/print.index.tsx` — suuntavalinta + dynaaminen `@page`-tyyli headiin
- `src/styles.css` — `.print-landscape`-säännöt
