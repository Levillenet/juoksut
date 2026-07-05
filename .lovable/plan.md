## Ongelma

Etusivun "Päivän parhaat tulokset ympäri Suomen" -osiossa ei näytetä, oliko tulos ennätys. Esim. Siiri Aavikko (T11 kolmiloikka) — tänään sekä oma ennätys (SE/PB) että piirin ennätys (PE).

## Ratkaisu

Näytetään ennätysmerkit `PB` (oma ennätys) ja `PE` (piirin ennätys) tuloksen vieressä `DailyBestSection`-listalla. Tiedot ovat jo tietokannassa (`athlete_results.was_pb`, `was_district_record`), pitää vain hakea ja renderöidä.

## Muutokset

1. **`src/lib/daily-best.ts`**
   - Lisää `was_pb: boolean | null` ja `was_district_record: boolean | null` `DailyBestRow`-tyyppiin.
   - Lisää molemmat sarakkeet `fetchDailyBest`- ja `fetchDailyBestForAthletes`-SELECT-listaan.

2. **`src/components/DailyBestSection.tsx`**
   - Tuloksen (`result_text`) viereen renderöi pienet värilliset badget:
     - `PB` (kulta/keltainen) kun `was_pb === true`
     - `PE` (violetti/primary) kun `was_district_record === true`
   - Badge on tekstipohjainen chip (esim. Tailwind `bg-amber-500/15 text-amber-700` ja `bg-primary/15 text-primary`), matala korkeus, `text-[10px]`, jotta se ei häiritse mobiilinäkymää.

## Verifiointi

Playwright etusivulla: valitse T11 → tarkista että Siiri Aavikko kolmiloikka -rivillä näkyvät `PB` ja `PE` merkit tuloksen vieressä.
