## Tavoite

1. Kilpailijan nimi vie kaikkialla urheilijatilastoihin (`/athlete/$key`).
2. Sukunimihaku → "Haku nimellä", joka osuu sekä etu- että sukunimeen.

## Muutokset

### 1. `src/components/AthleteSearch.tsx` — haku nimellä + nimi klikattavaksi
- Vaihda placeholder ja `aria-label`: `"Sukunimi"` → `"Nimi (etu- tai sukunimi)"`. Päivitä propsin oletus.
- Suodatuslogiikka: matchaa, jos `Surname` TAI `Firstname` sisältää kyselyn (case-insensitive). Käytä jo olemassa olevaa `q.length >= 2` -ehtoa.
- Ryhmäkortin yläosan nimi (`{g.name}`) → muuta `<Link to="/athlete/$key" params={{ key: athleteKey(surname, firstname, orgId) }}>`. Käytä `athleteKey`-helperia `@/lib/watch-store`:sta. Heat-rivien linkit `/round/...` jäävät ennalleen.
- Käytä `routes/search.tsx`-kutsuun sopivaa kuvausta (otsikko "Hae nimellä"). Päivitä `search.tsx`:n header-tekstit ("Hae nimellä", "Hae osallistujaa" säilyy).

### 2. `src/routes/round.$eventId.$roundId.tsx` — nimi linkittyy
- `a.Name` -elementti `<p>` → kääri `<Link to="/athlete/$key" params={{ key: athleteKey(a.Surname, a.Firstname, a.Organization?.Id ?? null) }}>`. Säilytä `NotInCompetition`-badge nimen vieressä (ei linkin sisällä).

### 3. `src/components/SeasonStatsSection.tsx` — nimi linkittyy
- Rivi 152–154: nimi `<Link to="/athlete/$key" params={{ key: r.athleteKey }}>`.

### 4. `src/components/ClubTodaySection.tsx` — nimi linkittyy
- Rivi 201–203: nimi `<Link to="/athlete/$key" params={{ key: r.athlete_key }}>` (kenttä on jo dataissa).

### 5. `src/components/DailyBestSection.tsx` + `src/lib/daily-best.ts` — nimi linkittyy
- `DailyBestRow`-tyyppiin lisää `athlete_key: string` ja `organization_id: number | null`.
- `fetchDailyBest`-`.select(...)` lisää `athlete_key, organization_id`.
- Komponentissa rivi 139: kääri `{r.surname} {r.firstname}` `<Link to="/athlete/$key" params={{ key: r.athlete_key }}>`.

## Mitä ei kosketa
- `athlete.$key.tsx`, hauskat tilastot, watch-lista, season-leaders — niissä nimet ovat jo klikattavissa.
- Hakulogiikan rakenne (`buildIndex`, concurrency) säilyy; vain filtteri ja UI-tekstit muuttuvat.
- Linkkien tyylit pidetään hillittyinä (hover-underline), ettei layout muutu.
