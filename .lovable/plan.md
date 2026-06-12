## Ongelma

Jaetussa seurantanäkymässä (`/seuraa/$token`) urheilijan tuloksen viereen ei tule PB-tähteä eikä parannustietoa.

Syyt:
1. `seuraa.$token.tsx` ei renderöi `<RecordBadge>`-komponenttia eikä kutsu `effectiveRecord`-funktiota.
2. Vaikka kutsuttaisiin, nykyinen `loadHistoryBaselineForCompetition` lukee `athlete_results`-taulun suoraan, ja sen RLS sallii vain `authenticated`-roolin. Jakolinkin vastaanottaja on yleensä kirjautumaton, joten data ei tulisi näkyviin.

## Korjaus

### 1. Tietokanta — uusi SECURITY DEFINER RPC

Lisätään migraatio, joka luo funktion `public.get_shared_watch_history(p_token text)`. Se palauttaa jakolinkin urheilijoiden historian (rivit eri kisoista) muodossa, jonka `history-baseline` -logiikka osaa kuluttaa:

- Palautuskolumnit: `athlete_key`, `event_name`, `event_category`, `sub_category`, `result_text`, `result_numeric`.
- WHERE: token vastaa `watch_shares`-riviä, joka ei ole peruutettu; rivit poimitaan `athlete_results`-taulusta `watched_athletes`-taulun athlete_key-listan kautta (jakajan `user_id` haetaan watch_sharesista); rajataan pois nykyinen `competition_id` ja `result_numeric IS NOT NULL`.
- GRANT EXECUTE `anon`, `authenticated`.

### 2. `src/lib/history-baseline.ts`

Lisätään uusi public-funktio `loadHistoryBaselineForSharedWatch(token, competitionId)`, joka:
- käyttää samaa muistivälimuistia (`cache`) avaimena `competitionId`,
- kutsuu uutta RPC:tä `get_shared_watch_history` ja muuntaa rivit samaan `HistoricalBest`-mapiin kuin nykyinen `loadHistoryBaselineForCompetition`,
- jakaa apurifunktion (esim. `buildBaselineMap(rows, competitionId)`) joka rakentaa kartan ja tallettaa cacheen.

### 3. `src/routes/seuraa.$token.tsx`

- Importoidaan `RecordBadge` (`@/lib/records`), `effectiveRecord` (`@/lib/record-baseline`) ja uusi `loadHistoryBaselineForSharedWatch`.
- `useEffect`, joka kutsuu `loadHistoryBaselineForSharedWatch(token, competitionId)` kun `token` ja `competitionId` ovat olemassa.
- Renderöinnissä (rivit 251–260, kun `e.alloc.Result` on olemassa) lisätään `RecordBadge` samalla tavalla kuin `watch.tsx`:ssä:
  ```
  const eff = effectiveRecord(e.round.EventId, e.alloc, {
    competitionId,
    athleteKey: athlete.key,
    eventName: e.round.EventName,
  });
  <RecordBadge category={e.round.Category} result={e.alloc.Result} pb={eff.pb} sb={eff.sb} size="sm" layout="row" />
  ```

## Tekninen huomio

- RPC on SECURITY DEFINER + `search_path = public`, sallii lukemisen vain pätevän tokenin kautta — ei laajenna anonyymin pääsyä `athlete_results`-tauluun muuten.
- Cache-avain on `competitionId`, joten jaetun ja oman näkymän baselinet eivät risteä, koska share-näkymässä competitionId on jakolinkin oma kisa.
- Ei muutoksia `watch.tsx`:ään, ei muiden näkymien logiikkaan.