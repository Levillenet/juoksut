## Tavoite

Kilpailijaseuranta (`/watch`) näyttää tällä hetkellä vain sen kisan sisältöä, joka on valittuna kisavalitsimessa. Jos seurattava urheilija kilpailee tänään eri kisassa kuin valittuna, häntä ei näy.

Halutaan: sivu tunnistaa automaattisesti kaikki kisat, joissa seurattavilla urheilijoilla on tänään tuloksia, listaa ne, ja käyttäjä voi klikata haluamansa kisan aktiiviseksi.

## Muutokset

### 1. Uusi apufunktio `src/lib/watch-store.ts` (tai `src/lib/daily-best.ts`)

Lisätään funktio `fetchTodayCompetitionsForAthletes(athleteKeys: string[])`, joka:
- Hakee `athlete_results`-taulusta rivit, joissa `athlete_key IN (…)` ja `captured_at` on Helsinki-päivän sisällä (käyttää olemassa olevaa `helsinkiDayBounds` `daily-best.ts`:stä).
- Ryhmittelee `competition_id`:n mukaan → palauttaa listan `{ competitionId, competitionName, competitionDate, location, athleteCount, resultCount, latestCapturedAt }`.
- Järjestää: uusin `latestCapturedAt` ensin.

### 2. Uusi komponentti `TodayCompetitionsForWatched` (samassa `src/routes/watch.tsx`)

- Kutsuu `useQuery`:llä yllä olevaa funktiota, `queryKey: ["watch-today-competitions", sortedWatchedKeys]`, `refetchInterval: 60_000`.
- Renderöityy vain kun seurattavia on ja kun palautuu ≥1 kisa.
- Renderöi otsikon "Tänään käynnissä" ja listan korteista. Kortti näyttää:
  - Kisan nimen + paikkakunnan
  - `N seurattavaa · M tulosta tänään`
  - Aktiivinen-merkki jos `competitionId === currentCompetitionId`
- Kortin klikkaus kutsuu `setCompetitionId(id)` (`useCompetitionId`-hookin toinen palautusarvo), jolloin koko sivu vaihtaa kisaa ja `indexQuery` uudelleenlatautuu.
- Sijoitetaan `<main>`-alueen alkuun, ennen hakutuloksia ja seuranta-listoja, mutta virheilmoituksen ja `ShareInviteBanner`in jälkeen.

### 3. Ei muutoksia dataan

Tämä on puhdas lukupolku: käyttää olemassa olevaa `athlete_results` -taulua ja sen nykyisiä `SELECT`-politiikkoja. Ei uusia migraatioita, tauluja, funktioita tai politiikkoja.

## Rajaus

- Vain `/watch`-sivu (`src/routes/watch.tsx` + yksi uusi apufunktio).
- Ei muuteta olemassa olevaa `indexQuery`/`watchedSections`-logiikkaa. Käyttäjä saa listan tänään aktiivisista kisoista näkyviin; halutessaan hän klikkaa toisen kisan aktiiviseksi ja sivu vaihtaa normaalisti valittuun kisaan.
- Ei kosketa jakolinkkeihin (`seuraa.$token.tsx`) tässä vaiheessa.
