# Graafinen aikataulu koko ruutuun + EventPicker-bugfix

## A) Lisää laji ‑dialogin ikäryhmävalikon bugfix

Bugi: `EventPickerDialog`:in `const [age, setAge] = useState<string>(ageClasses[0] ?? "")` arvotetaan kerran. Kun dialogi avataan ennen kuin `catalog`-RPC on ehtinyt latautua, `age` jää tyhjäksi vaikka `<select>` näyttää ikäryhmät → laji-lista on tyhjä.

Korjaus: `useEffect`, joka asettaa `age` ensimmäiseksi `ageClasses`-arvoksi aina kun lista muuttuu eikä nykyinen `age` löydy listasta. Saman kerralla varmistetaan, että ikäryhmät on järjestetty (T9, P9, T10, P10, … T15, P15, N, M).

## B) Graafinen aikataulu — uusi koko ruudun näkymä

Uusi reitti `src/routes/planner.$planId.gantt.tsx` (full-screen, ei `max-w-6xl`-kapenninta). Avataan **"Aikataulu"**-välilehden painikkeesta "Avaa koko näytön aikataulu" → uusi välilehti/sivu. Komponentti irrotetaan tiedostoon `src/components/planner/PlannerFullGantt.tsx` ja korvaa nykyisen sisäkkäisen `PlannerGantt`-komponentin renderin myös välilehdellä (tiivis preview + linkki).

### Layout — kuten Excel "YAG22_Lauantai"

Vaakasuuntainen aika, kaksi pinottua osiota samalla aika-akselilla:

```text
                    | 8           | 9               | 10              | ...
                    | 05 10 15 20 | 05 10 15 20 ... |
─ Suorituspaikkakohtainen aikataulu ─
Juoksut etusuora   |         [T15 100m 32 osan. 5min/erä]   [T14 100m] ...
Juoksut takasuora  |         [T13 60m ae]                   [T12 60m ae]
Kuula 1            |  [P13 Kuula]                           [P15 Kuula]
Pituus etusuora 1  |  [T11 pituus 76 hyppyä]                ...
Korkeus 1          |  [T9 korkeus]                          ...
...
─ Ikäryhmäkohtainen aikataulu ─
T9                 |  [T9 korkeus]                          [T9 pituus]
P9                 |
T10                |
...
```

- **Vasen sticky-sarake**: ensimmäisessä osiossa suorituspaikat (`venues`), toisessa ikäryhmät (`Set<age_class>` aakkostettuna `ageClassSort`illa).
- **Ylä sticky-rivi**: kaksitasoinen aika-akseli – yläosa kokonainen tunti (esim. "8", "9"), alaosa 5 min ‑välit (5, 10, 15, … 55). Aika ‑sarake-leveys vakio (esim. 14 px / 5 min eli 168 px / tunti) → ruutuviivat kuten Excelissä. Päivän aikaikkuna `plan.day_windows`:sta pyöristettynä alaspäin/ylöspäin tasatunteihin.
- **Solut (palkit)**: positio `(starts_at − startMs)/5min · 14px` vasemmasta reunasta; leveys `kesto/5min · 14px`. Ylä-osiossa rivi = `venue_id`, ala-osiossa rivi = `age_class`. Sisältö 2 riviä: `T15 (5) 5min/erä` ja `100m ae` (lajinimi), kuten Excelissä. Aikataulu lukee `ScheduleItemRow`-rivit ja resolvoi `event.name`/`participants`/`isHurdles` `evMap`istä.
- **Värit**: ikäryhmän mukaan (sama `colorFor`). Konflikti → punainen reunus.
- **Drag**: vaakasuuntainen veto siirtää aikaa (5 min snap) — molemmissa osioissa sama bar-id, päivitys yhdellä mutaatiolla. (Vertikaalivetoa ei enää tarvita, koska rivit ovat venue/age-pakotetut.)
- **Päivätabit** ylälaidassa, kun `plan.is_multi_day`.

### Tekninen rakenne

- Uusi tiedosto `src/components/planner/PlannerFullGantt.tsx` joka ottaa props `{plan, venues, events, schedule, conflicts, onChange}`.
- Skrollaus: koko alue yhdessä `overflow-auto`-kontissa; sticky-vasen ja sticky-ylä CSS:llä (`position: sticky; left/top: 0; z-index`).
- Renderöinti CSS Gridillä yhden ison gridin sijasta kahtena erillisenä grid-osiona, jotka jakavat saman `gridTemplateColumns`-määrittelyn. Pakotettu sama colTemplate (ts. sama `pxPer5Min`) → akselit linjautuvat. Ylälaidan aikajana renderöidään kerran ja toistuu ennen kumpaakin osiota label-rivinä; sisäisesti `position: sticky; top: 0`.
- Uusi reitti `src/routes/planner.$planId.gantt.tsx` — fullscreen sivu (header pelkkä takaisin-linkki + nimi + päivätab), renderöi `PlannerFullGantt`. Lukee samat queryt kuin `planner.$planId.tsx` (oma `loaderless` komponentti TanStack Queryillä).
- Aikataulu-välilehdessä lisätään painike `<Link to="/planner/$planId/gantt">Avaa koko näytön aikataulu</Link>` ja säilytetään nykyinen kompakti vertikaali-Gantt drag-toiminnallisuudella (älä riko olemassa olevaa).

### Reittiremerkintä

Uusi tiedosto `planner.$planId.gantt.tsx` → polku `/planner/:planId/gantt`. TanStack Router generoi `routeTree.gen.ts` automaattisesti.

## Muutettavat / uudet tiedostot

- **Uusi** `src/components/planner/PlannerFullGantt.tsx` — koko ruudun kaksoisaikataulu.
- **Uusi** `src/routes/planner.$planId.gantt.tsx` — full-screen reitti.
- **Muokkaa** `src/routes/planner.$planId.tsx`:
  - EventPicker: lisää `useEffect`, joka pitää `age`:n synkronoituna `ageClasses`-listan kanssa.
  - Aikataulu-välilehti: lisää "Avaa koko näytön aikataulu" -linkki nykyisen Ganttin yläpuolelle.

## Mitä EI tehdä

- Ei muuteta nykyistä solveria, kestoarviota eikä DB-skeemaa.
- Ei poisteta nykyistä pieni-Ganttia välilehdeltä, jotta drag toimii edelleen samassa näkymässä.
- Ei toteuteta horisontaali-dragia ensimmäisessä iteraatiossa (vain visualisointi + zoom) — voidaan lisätä myöhemmin jos tarpeen. *(Voit nostaa tämän jos haluat heti.)*
