## Auditin tulos

Käytiin läpi kaikki kohdat, joissa tuloslistan **livedataa** indeksoidaan tai haetaan. Tärkeintä: tunnistetaan urheilijat / ilmoittautumiset oikein silloinkin, kun eräjakoa ei ole vielä tehty (eilinen ongelma).

### Tila tällä hetkellä

**Urheilija- ja allokaatiotason indeksointi (`competitionIndexQueryOptions`)** – sisältää Enrollments-fallbackin, eli löytää myös pelkät ilmoittautumiset:
- `src/routes/watch.tsx` ✓
- `src/components/AthleteSearch.tsx` ✓ (juuri korjattu)
- `src/routes/seuraa.$token.tsx` ✓
- `src/routes/print.watched.tsx` ✓
- `src/routes/print.club.tsx` ✓
- `src/routes/print.yag-calling.tsx` ✓

→ Kaikki urheilijatasoiset live-näkymät käyttävät yhtä jaettua indeksiä.

**Aikataulu-/round-taso (`fetchRounds` suoraan):**
- `src/routes/index.tsx` (kotisivun aikataulu)
- `src/routes/print.index.tsx` (tulostettava aikataulu)
- `src/routes/running-ops.tsx` (juoksulajien operointi)

Nämä listaavat vain *round*-rivejä eivätkä urheilijoita, joten enrollment-fallback ei ole oleellinen. Ne kuitenkin tekevät oman `useEffect`+`useState`-loopin ohi `competitionScheduleQueryOptions`-jakelusta → kaksi rinnakkaista cachea ja ylimääräiset API-haut. Toiminnallista bugia ei ole.

**Live-tulokset (announcer, scoreboard, round-sivu):** käyttävät `competitionScheduleQueryOptions` + `eventDetailsQueryOptions` (`fetchEvent`). Oikea käyttötarkoitus – nämä näyttävät vain käynnissä olevia eriä, joissa allokaatiot ovat aina olemassa. Ei muutostarvetta.

**DB-pohjaiset historialliset haut** (`athlete_results`, `relay_legs`, jne. tiedostoissa `daily-best.ts`, `club-today.ts`, `athlete-history.ts`, `season-*`, `fun-stats.ts`, `today-stats.ts`): eri domain (harvesterilla kerätyt valmiit tulokset), ei liity live-ilmoittautumisiin. Ei muutostarvetta.

### Ehdotetut muutokset

#### 1. Yhdistä aikatauluhaut jaettuun cacheen (`src/lib/tuloslista-queries.ts`-pohjaiseen)

Korvaa kolmen sivun manuaalinen `fetchRounds`+`useState`-pari yhdellä jaetulla queryllä:

- **`src/routes/index.tsx`** (kotisivu, ei-officials-haara): käytä `useQuery(competitionScheduleQueryOptions(competitionId))`. Poista `data`/`name`/`loading`/`updatedAt`/`refreshSec`-interval-koodi ja read-helperit. `competitionScheduleQueryOptions` refetchaa jo 15 s välein – jos asetuksen `refreshSec` halutaan vaikuttavan, kääritään queryyn `refetchInterval`-override.
- **`src/routes/print.index.tsx`**: sama korvaus. Tulostussivulle riittää oletus-staleTime, mutta jaettu cache tekee navigaation jouhevaksi.
- **`src/routes/running-ops.tsx`**: sama korvaus.

Hyödyt:
- Yksi totuus kisan aikataululle koko sovelluksessa, vähemmän duplikaattikutsuja proxyyn.
- Jos huomenna lisätään uusi näkymä, ei tarvitse miettiä erikseen miten ladata aikataulu.

#### 2. Lisää yksiselitteinen kommentti yhden totuuden periaatteesta

Lisää `src/lib/tuloslista-queries.ts`-tiedoston alkuun JSDoc-osio, joka:
- Listaa kaksi sallittua live-indeksointitapaa (`competitionIndexQueryOptions` = urheilijat/allokaatiot, `competitionScheduleQueryOptions` = rounds).
- Kieltää uusien manuaalisten `fetchEvent`-looppien luomisen muualla. `fetchEvent` käytetään vain `eventDetailsQueryOptions`-funktion sisällä yksittäistä lajia varten.
- Mainitsee Enrollments-fallbackin syyn (eräjako tekemättä → ilmoittautumiset näkyviin).

Tämä toimii tulevaisuuden suojaverkkona – sama virhe ei toistu, koska seuraava editoija näkee sääntöjen olevan kirjattuna yhteen paikkaan.

### Mitä ei tehdä

- DB-pohjaisia hakuja (`athlete_results` ym.) ei yhtenäistetä – ne ovat tarkoituksellisesti per käyttötapaus rakennettuja kyselyitä, joiden sarakevalinnat ja suodatukset eroavat.
- Announcer/scoreboard/round-sivua ei muuteta – ne käyttävät jo jaettuja queryOptions-funktioita.

### Tekninen huomio (koskien muutos 1)

`competitionScheduleQueryOptions` palauttaa `{ rounds, name }`. Korvattaessa muista:
- Lue `data?.rounds`, ei suoraan `data`.
- `loading`-tila on `query.isFetching && !query.data`, ei pelkkä `isFetching` (jälkimmäinen vilkkuu refetchin aikana).
- Korvaa `setUpdatedAt(new Date())` lukemalla `query.dataUpdatedAt`.
- Manuaalinen "Päivitä"-nappi: `queryClient.invalidateQueries({ queryKey: competitionScheduleKey(id) })`.
