## "Kauden kärki" -näkymän puuttuvien tulosten korjaus

### Ongelma
Esim. Ulkokausi → Tytöt 11 → korkeus näyttää vanhoja kärkituloksia (143 cm), vaikka tämän päivän kisassa on hypätty 148 cm. Data on tietokannassa kunnossa.

### Juurisyy
`season-leaders.ts`-tiedoston Supabase-sivuhakuja kutsutaan **ilman `.order()`-lauseketta** PAGE_SIZE = 1000 sivuilla. PostgREST ei takaa stabiilia rivijärjestystä peräkkäisten sivujen välillä ilman ORDER BY:tä — etenkin kun taulu päivittyy aktiivisesti (uusia tuloksia tipahtaa kannassa hauskan päivän aikana). Käytännössä osa riveistä jää väliin tai tulee kahdesti, jolloin viimeisimpien kisojen rivit voivat puuttua kokonaan tulosjoukosta. T11-ulkokaudella on jo 4356 riviä → 5 sivua → vika osuu juuri tähän kokoluokkaan.

### Korjaus
Lisätään stabiili `.order("id", { ascending: true })` jokaiseen sivutettuun hakuun tiedostoissa:

**`src/lib/season-leaders.ts`** — neljä funktiota:
- `fetchSeasonRows`
- `fetchSeasonAgeClasses`
- `fetchSeasonEvents`
- `fetchSeasonClubs`

**`src/lib/season-top.ts`** — yksi funktio:
- `fetchSeasonRowsForAgeClass`

Lisäksi pidetään React Queryn `staleTime` ennallaan (60 s) — sivun avaaminen / refetch palauttaa tuoreen datan.

### Vaikutus
- Korjaa puuttuvat uusimmat tulokset Kauden kärki -näkymässä kaikille ikäluokille (ei pelkkä T11), kaikille lajeille.
- Korjaa myös urheilijasivun "kauden kärki" -merkinnät (`loadAthleteSeasonTopFlags`) saman juurisyyn takia.
- Ei muutoksia tietokantaan, RLS:ään tai UI:hin.

### Verifiointi
- Avataan /season-leaders → Ulkokausi → T11 → korkeus → kärjessä Kankare Martta 148 (12.6.2026).