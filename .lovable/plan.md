## Tavoite

Tällä hetkellä `/print/yag-calling` näyttää vain seurannassa olevien urheilijoiden Calling-aikataulun. Lisätään mahdollisuus tulostaa sama aikataulu valitulle seuralle — samaan tyyliin kuin `/print/club` toimii kilpailun aikatauluille.

## Toteutus

**1. `src/routes/print.yag-calling.tsx`**

- Lisätään `validateSearch`iin `org` (numero, oletus 0) ja `mode` (`"watched" | "club"`, oletus `"watched"`).
- Sivun yläosaan kompakti valitsin (samaan boxiin kuin tulostussuunta):
  - Kaksi pilleripainiketta: **Seurannassa** / **Oma seura**.
  - Kun *Oma seura* valittuna, alle ilmestyy seuran pudotusvalikko (sama logiikka kuin `/print/club`:ssa: kerätään seurat YAG-kisan entryistä, näytetään urheilijamäärä).
- Suodatuslogiikka:
  - `mode === "watched"` → nykyinen `watchedKeys`-suodatus.
  - `mode === "club"` ja `org > 0` → suodata `entries` siten että `alloc.Organization?.Id === org`.
- Tämän jälkeen ajetaan `matchYagCalling(filtered)` samalla tavalla.
- Otsikkoteksti ja "Ei lähtöjä" -viesti mukautuvat tilan mukaan ("Seurattujen lähdöt" / "Seuran *X* lähdöt").
- `auto`-print-efekti toimii kummassakin moodissa.

**2. `src/components/PrintTabs.tsx`**

- Ei muutoksia. Sama `YAG Calling` -välilehti vie samaan reittiin; valinta tapahtuu sivun sisällä.

**3. Roolit**

- Sivu pidetään `RequireRole allow={["user"]}` -takana (kuten nyt). Vaihtoehtoisesti voisin avata seura-moodin myös `official`-roolille, mutta pidän nykyisen rajauksen ellei toisin pyydetä.

## Mitä ei muuteta

- `src/data/yag-calling.ts` (PDF-pohjainen data) ja `src/lib/yag-calling-match.ts` (täsmäyslogiikka) pysyvät ennallaan.
- `/print/club` ja `/print/watched` jatkavat nykyisellään.
