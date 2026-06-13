## Ongelma

`/search` (Hae nimellä) ei löydä huomisen T10 800 m Amanda Gustavssonia, mutta `/watch` (Seuratut urheilijat) löytää saman urheilijan.

Syy: kaksi eri indeksointitapaa.

- `/watch` käyttää `competitionIndexQueryOptions` (`src/lib/tuloslista-queries.ts`), joka osaa **falbäckiksi** synteettiset rivit `ev.Enrollments`-listasta silloin kun lajiin ei ole vielä jaettu eriä (`fromEnrollment: true`). Huomisen 800 m on juuri tällainen: ilmoittautumiset olemassa, eräjako tulossa.
- `/search` käyttää omaa indeksointiaan komponentissa `src/components/AthleteSearch.tsx`, joka iteroi vain `round.Heats[].Allocations`. Jos eriä ei ole, lajia ei tule indeksiin – joten hakukin ei löydä siihen ilmoittautuneita.

## Korjaus

Yhdenmukaistetaan: `AthleteSearch` käyttää samaa jaettua `competitionIndexQueryOptions`-kyselyä kuin `/watch`. Etu: yksi totuus, jaettu välimuisti (haku ei tee toistamiseen kymmeniä event-hakuja kun käyttäjä on jo käynyt watch-näkymässä), ja enrollment-fallback tulee automaattisesti.

### Muutokset

1. **`src/components/AthleteSearch.tsx`**
   - Poista oma `buildIndex` / per-event fetch -looppi ja `setIndex`/`setProgress`/`setLoading`-tila.
   - Korvaa `useQuery(competitionIndexQueryOptions(competitionId, { skipBaselines: true, onProgress }))`. `skipBaselines: true` koska hakunäkymä ei tarvitse record-baseline-tallennuksia.
   - Sovella `runningOnly`-suodatus indeksin päälle (`entries.filter(e => isRunningEvent(e.round))`) – tätä käytetään esim. `running-ops`-sivulla.
   - Listanäytön rivissä: jos `e.fromEnrollment === true` ja kyseessä on juoksu, näytä "Erä – / Rata –" sijaan pieni "Ilmoittautunut" -merkintä (eräjako tulossa). Kentällä jo ennestään näytetään "Järj. n" vain kun `Position != null`, joten enrollment-rivi (Position 0) näkyy ilman erikoiskäsittelyä.
   - Latausilmoitus käyttää queryn `isFetching`-tilaa ja `onProgress`-callbackin viimeisiä lukuja.

2. **Muut käyttäjät**: tarkistetaan että `AthleteSearch`-komponenttia käyttävät sivut (`src/routes/search.tsx`, `src/routes/running-ops.tsx` mikäli käyttää) toimivat edelleen samalla rajapinnalla – propsit (`competitionId`, `runningOnly`, `placeholder`, `autoFocus`) säilyvät ennallaan.

Ei muutoksia tietokantaan, backendiin tai muihin näkymiin.

## Tekninen huomio

`competitionIndexQueryOptions` ajaa oletuksena baseline-tallennuksen Supabaseen jokaiselle eventille. Hakukomponentin pitäisi käyttää `skipBaselines: true` -varianttia (eri queryKey-suffix `"no-baselines"`), ettei pelkkä haku tee turhia kirjoituksia jos käyttäjä ei käytä watch-näkymää. Jos watch on jo käynyt, hänellä on cachessa "baselines"-versio – tämä tarkoittaa kahta erillistä cache-merkintää, mikä on hyväksyttävä kompromissi: enrollment-fallback on identtinen kummassakin.
