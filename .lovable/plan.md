## Ongelma

Tuloslistan `/competition`-API antaa jokaiselle kisalle vain yhden `Date`-kentän (kisan alkupäivä). Niinpä:

- **Käynnissä olevat kisat** (`LiveCompetitionsSection`) jättää 12.–14.6. käynnissä olevan YAG:in pois 13.6., koska `Date === today` ei täsmää.
- **Päivän parhaat** ja **Seuran urheilijat tänään** suodattavat `athlete_results.competition_date`-kentän mukaan, joka on niin ikään kisan alkupäivä → monipäiväisen kisan myöhempien päivien tulokset eivät näy.

## Muutokset

### 1) Päivän parhaat, Seuran urheilijat tänään, Today stats
Tiedostot: `src/lib/daily-best.ts`, `src/lib/club-today.ts`, `src/lib/today-stats.ts`.

Vaihdetaan kaikki "tämän päivän" rajaukset käyttämään `captured_at`-saraketta `competition_date`-sarakkeen sijaan. `captured_at` on hetki, jolloin tulos poimittiin tuloslistalta — käytännössä sama kuin tuloksen syntyhetki, joten monipäiväisen kisan kunkin päivän tulokset osuvat oikealle päivälle automaattisesti.

- `fetchTodayAgeClasses`, `fetchDailyBest`, `fetchDailyBestForAthletes`: `.gte/.lt('competition_date', …)` → `.gte/.lt('captured_at', …)`.
- `club-today.ts` "tänään"-haut (rivit 44–45, 90–91): sama vaihto. Historian / "before today" -haut (rivit 119–156) jätetään ennalleen — ne perustuvat kisan alkupäivään, mikä on oikein "aiempi kausi" -tyyppisissä vertailuissa.
- `today-stats.ts` rivit 47–48 ja 89–90: vaihto `captured_at`-pohjaiseksi. Rivin 133 historiavertailu jätetään `competition_date`-pohjaiseksi.

Tämä on yksittäisten suodatuslausekkeiden vaihto — ei muutoksia komponenttien rajapintaan tai harvestointiin.

### 2) Käynnissä olevat kisat (monipäiväisyys)
Tiedosto: `src/lib/competition-list.ts` (+ pieni komponenttipäivitys ei tarpeen).

Lisätään uusi apu `filterRunningToday(list)`, jota `useTodayCompetitions` käyttää:

1. Esikarsitaan lista kisoihin, joiden `Date` on välillä `[today - 6 vrk, today]` (riittää kattamaan tyypilliset monipäiväiset kisat).
2. Esikarsittujen kisojen joukosta jokaiselle, jonka `Date === today`, hyväksytään suoraan.
3. Muille (alkupäivä menneisyydessä) haetaan `/live/v1/competition/{id}` (RoundsByDate, päivät avaimina muodossa `DD.MM.YYYY`) ja hyväksytään jos tämän päivän Helsinki-päiväavain löytyy avaimista. Haut rinnakkain `Promise.all`-kutsulla; tulos muistissa moduulitasolla `Map<id, { dates: Set<string>, fetchedAt: number }>` -välimuistissa (TTL esim. 10 min), jotta 30 s päivitykset eivät hammer-toa palvelinta.
4. Virheet (timeout/404) → kisa jätetään pois hiljaisesti.

`useTodayCompetitions`-hook saa async-vaiheen lisäksi (lisätään `loading`-tilan sisään); ulkoinen rajapinta säilyy ennallaan, joten `LiveCompetitionsSection` ei muutu.

## Vaikutus

- YAG ja muut monipäiväiset kisat näkyvät "Käynnissä olevat kisat" -listalla koko keston ajan.
- Päivän parhaat, Seuran tänään ja Today stats näyttävät myös 13.–14.6. tulokset, vaikka kisan alkupäivä on 12.6.
- Ei vaikutusta historian / kausivertailuihin (säilyttävät `competition_date`-pohjan).

## Tekninen huomio

`captured_at`-vaihto edellyttää, että harvestointi käy riittävän ajantasaisesti — projektissa harvestointi on jo aktiivinen `harvest-results`-hookin kautta, joten ero tuloshetkeen on minuutteja. Helsinki-päivärajan vaihteessa (klo 00) saattaa olla hetken epätarkkuus, mutta tulokset eivät käytännössä tule keskellä yötä.
