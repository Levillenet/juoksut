## Tavoite

Kun kenttälajissa on kaksi erää (esim. korkeus T11 jaettu kahdelle hyppypaikalle), suorituspaikan livenäytössä voi valita kumpaa erää seurataan vai näytetäänkö koko kisa yhtenä listana. Muualla (kuuluttaja, /watch, /round, tulostuslistat) käyttäytyminen säilyy ennallaan — erät käsitellään aina yhtenä kisana.

## Muutokset

### `src/routes/scoreboard.tsx` (ainoa muokattava tiedosto)

**1. URL-parametri `heat`**

Lisätään `SearchParams`-tyyppiin `heat?: number | "all"` (oletus `"all"`). `validateSearch` lukee numeron tai merkkijonon `"all"`.

**2. Eränvalitsin headeriin**

Kun `round.Heats.length >= 2`, näytetään headerissa pieni pillipainikerivi (Top-N -valitsimen vieressä):

```
[ Koko kisa ] [ Erä 1 ] [ Erä 2 ]
```

Painike päivittää `heat`-search-parametrin. Kun `Heats.length <= 1`, valitsinta ei näytetä.

**3. `rows`-laskennan suodatus**

`useMemo`-blokissa lasketaan suodatetut heatit:

```ts
const visibleHeats = heat === "all" || heat == null
  ? round.Heats
  : round.Heats.filter((h) => h.Index === heat);
const allocs = visibleHeats.flatMap((h) => h.Allocations);
```

Sijoituslaskenta jatkuu täsmälleen samalla logiikalla — kun käyttäjä valitsee yhden erän, sijat lasketaan vain sen erän osallistujien kesken (ResultRank-arvot näytetään silti sellaisenaan, ja jos ne tulevat virallisesta lähteestä koko kisalle, sortataan parhaan tuloksen mukaan kuten nykyisin fallback tekee).

**4. Tuulen lähde**

`wind`-`useMemo` käyttää samaa `visibleHeats`-listaa: yhden erän valinta näyttää sen erän tuulen, ”koko kisa” käyttää nykyistä logiikkaa (ensimmäisen erän tuuli).

**5. Otsikko headerissa**

`round.Name`-rivin perään lisätään valittu erä, kun se on muu kuin koko kisa: `· Erä 1`.

**6. Uuden tuloksen overlay**

`prevResultsRef`-vertailu iteroi edelleen kaikki erät (näin overlay näyttää myös valitsemattoman erän tulokset jos käyttäjä haluaa — vaihtoehtoisesti rajataan `visibleHeats`-listaan). **Päätös:** rajataan `visibleHeats`-listaan, jotta valittu erä saa fokuksen.

### Muutokset, joita EI tehdä

- `src/routes/round.$eventId.$roundId.tsx` (näyttää erät jo erikseen — pysyy)
- `src/routes/announcer.*` (kuuluttaja seuraa koko kisaa — pysyy)
- `src/routes/watch.tsx`, `src/routes/print.*` (pysyy)
- `src/lib/record-baseline.ts`, `history-baseline.ts` ym. (ei riipu erien jaosta)

## Tekniset huomiot

- `Heat.Index` on numero (1, 2, …) — käytetään suoraan URL-arvona.
- Defaultti `heat="all"` valitaan niin, että nykyiset bookmarkit/linkit toimivat muuttumatta.
- Kun käyttäjä vaihtaa lajia headerin takaisin-napilla, `heat` resetoituu (poistetaan search-paramista samoin kuin `eventId`/`roundId` nyt).
- Top-N -valinta säilyy yli erävaihdon (search-param päivitetään `prev => ({...prev, heat})` -kuviolla).

## Lopputulos

- Suorituspaikan näyttö korkeus-T11:llä: oletuksena ”Koko kisa” (Top-10 yhdistetty); valitsemalla ”Erä 1” näkyy vain ensimmäisen hyppyryhmän kärki, ”Erä 2” vain toisen.
- Muut näkymät säilyvät ennallaan ja yhdistävät erät kuten ennenkin.
