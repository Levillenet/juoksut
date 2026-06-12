## Ongelma

Siiri Aavikko / T11 Korkeus -tapauksessa season best on tallennettu `athlete_results`-tauluun (Reilu Cup 2, 28.5.2026, 128). Urheilijakortti löytää sen, mutta suorituspaikan livenäytön rivillä SB ei näy.

Tausta: lisäsin äsken `effectiveRecord`-funktioon SB-fallbackin, joka hakee arvon `history-baseline`-välimuistista. Välimuisti ladataan `loadHistoryBaselineForCompetition`-kutsulla, joka on **fire-and-forget**: kun lataus valmistuu, mikään React-komponentti ei tiedä siitä eikä renderöi uudelleen. Lopputulos:

- Jos suorituspaikan datan kysely (`detailQ`) ehtii valmiiksi ennen baselinea (yleinen tapaus, koska tuloslista on nopeampi kuin koko kilpailun historian haku), `effectiveRecord` lukee tyhjän välimuistin → SB jää näkymättä.
- 15 sekunnin välein tapahtuva `detailQ`-päivitys laukaisee uuden renderin, jolloin SB tulee näkyviin — mutta vain jos baseline on siihen mennessä valmis. Käytännössä asiakaskertomus näyttää SB:n vain "joskus" eikä luotettavasti.

Sama ongelma koskee `watch.tsx`, `seuraa.$token.tsx`, `useAnnouncerData.ts` ja kaikkia paikkoja, jotka kutsuvat `effectiveRecord`-funktiota historian kanssa.

## Korjaus

Tehdään `loadHistoryBaseline*`-koukut React-tietoisiksi niin, että baselinen latautuminen aiheuttaa uudelleenrenderin niissä komponenteissa, jotka käyttävät sitä.

### 1. `src/lib/history-baseline.ts`

- Lisätään `queryOptions`-tyyppinen yhteinen avain: `historyBaselineKey(competitionId)` ja `sharedHistoryBaselineKey(token, competitionId)`.
- Säilytetään nykyinen muistivälimuisti `getHistoricalBest` / `getHistoricalSeasonBest` -synkronikutsuja varten.
- Tarjotaan `useHistoryBaseline(competitionId)` -hook (sisäisesti `useQuery`), joka palauttaa `dataUpdatedAt`-leiman. Hook täyttää saman moduulinvälimuistin kuin nykyinen `loadHistoryBaselineForCompetition`, mutta lisäksi React-query tietää, milloin lataus valmistuu.
- Sama `useSharedHistoryBaseline(token, competitionId)` jaetulle seurantalinkille.

### 2. Käyttöpaikat

Korvataan kaikki `void loadHistoryBaselineFor*`-kutsut `useHistoryBaseline`-hookilla samassa tiedostossa:

- `src/routes/scoreboard.tsx` (ScoreboardLive)
- `src/routes/watch.tsx`
- `src/hooks/useAnnouncerData.ts`
- `src/routes/seuraa.$token.tsx` (useSharedHistoryBaseline)

Lisätään hookin palauttama `dataUpdatedAt` rivien laskennan `useMemo`-dependenssilistalle (esim. `rows`-memo, `entries`-memo), jotta SB renderöityy heti, kun välimuisti on täytetty.

### 3. Verifiointi

- Avataan YAG-kilpailun T11 Korkeus -suorituspaikan livenäyttö ja tarkistetaan, että Siirin kohdalla näkyy `SB 128`.
- Tarkistetaan, että watch- ja seuraa-näkymät edelleen näyttävät PB-tähden niissä tapauksissa, joissa se aiemmin toimi.
- Varmistetaan, että muut SB-arvot eivät hävinneet (tuloslistasta tuleva SB säilyy etusijalla `effectiveRecord`-järjestyksessä `b?.sb || alloc.SB || historicalSeasonBest`).

## Tekniset yksityiskohdat

- `useQuery`-asetukset: `staleTime: 5 * 60_000`, `gcTime: 10 * 60_000`, `refetchOnWindowFocus: false`. Lataus on raskas, mutta cache pitää sen yhden kerran per kilpailu.
- Hookin `queryFn` palauttaa `dataUpdatedAt`-virkistyksen lisäksi `Map`-rakenteen, mutta kutsujat eivät käytä sitä suoraan — kaikki lukutoiminta menee edelleen `getHistoricalBest` / `getHistoricalSeasonBest`-synkronikutsujen kautta, jotka säilyvät ennallaan.
- Ei tietokantamuutoksia. Aiempi `get_shared_watch_history`-migraatio (jossa lisättiin `competition_date`) jää voimaan.
