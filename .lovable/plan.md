## Tavoite

Kun calling-listan (PDF) erien määrä < tuloslistan erien määrä, ylimääräiset erät (esim. T13 erä 5–11) ohjataan automaattisesti viimeisen olemassa olevan calling-rivin (erä 4) alle, ja kyseiseen riviin lisätään huomautus "ylimääräinen erä, calling-aikataulu puuttuu — selvitetään myöhemmin".

## Toteutus

### 1) `src/data/yag-calling.ts` — perutaan käsin ekstrapoloidut rivit

Poistetaan aiemmin lisätyt ekstrapoloidut erät, jotta fallback-logiikka aktivoituu niillekin:

- T13 200m erät 5–11 (8 riviä, lisättiin aiemmassa kierroksessa erän 4 jälkeen)
- T11 150m erä 9
- P11 150m erä 6
- P12 200m erä 5

### 2) `src/lib/yag-calling-match.ts` — overflow-fallback

Lisätään `YagCallingMatch`-tyyppiin uusi kenttä:

```ts
/** Eränumerot joille ei löydy omaa calling-riviä; nämä entryt
 *  on sidottu tämän rivin alle huomautuksella. */
overflowHeats?: number[];
```

Muutetaan `matchYagCalling`:n erä-jaettu haara seuraavasti:

- Lasketaan `maxCallingHeat = max(parseHeat(r.laji)) over g.rows`.
- Julkaistut entryt joiden `heatIndex > maxCallingHeat` kerätään `overflowEntries`-listaan **erikseen** sen sijaan, että jätettäisiin pois.
- Etsitään viimeisen erän calling-rivi (`g.rows.find(r => parseHeat(r.laji) === maxCallingHeat)`).
- Liitetään overflowEntries sen rivin `entries`-listaan ja täytetään `overflowHeats` uniikeilla, järjestetyillä erä-numeroilla (esim. `[5, 6, 7, 8, 9, 10, 11]`).
- Heat-numero pidetään ennallaan (= maxCallingHeat) — UI näyttää huomautuksen erikseen.

Julkaisemattomien (heatIndex === 0) käsittely säilyy ennallaan.

### 3) `src/routes/print.yag-calling.tsx` — näytetään huomautus

Erä-sarakkeeseen ja/tai sarja/laji-soluun lisätään pieni huomio kun `m.overflowHeats?.length`:

```tsx
{m.overflowHeats && m.overflowHeats.length > 0 && (
  <div className="mt-1 text-[10px] italic text-amber-700 print:text-black">
    Huom: lisäksi erät {formatHeatList(m.overflowHeats)} — calling-aikataulu
    puuttuu, selvitetään myöhemmin.
  </div>
)}
```

`formatHeatList([5,6,7,8,9,10,11])` → "5–11"; ei-peräkkäiset → "5, 7, 9".
Sijoitetaan huomautus sarja/laji-solun (col 4) urheilijalistan alle, jotta se näkyy selvästi.

### 4) `src/lib/yag-calling-pdf.ts` — sama huomautus PDF:ään

`sarjaCell`-stringin loppuun lisätään uusi rivi kun overflow-eriä on:

```ts
const overflowNote =
  m.overflowHeats && m.overflowHeats.length > 0
    ? `\n[Huom: lisäksi erät ${formatHeatList(m.overflowHeats)} — calling-aikataulu puuttuu]`
    : "";
const sarjaCell = `${lajiTxt}\n${athletes}${overflowNote}`;
```

`formatHeatList`-helper viedään `yag-calling-match.ts`:stä (export) tai duplikoidaan kummassakin.

## Vaikutus

- T13 200m: julkaistuilla erillä 5–11 olevat urheilijat näkyvät erän 4 calling-rivin alla yhdessä erän 4 omien urheilijoiden kanssa. Rivissä lukee "Huom: lisäksi erät 5–11 — calling-aikataulu puuttuu, selvitetään myöhemmin."
- T11/P11 150m ja P12 200m vastaavasti.
- Ei muutoksia muuhun logiikkaan (julkaisematon = entinen `allHeats`-näkymä).

## Avoin kysymys

Ei. Toteutetaan suoraan.
