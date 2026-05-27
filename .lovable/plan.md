## Ongelma

`TodayStatsSection` ("Urheilua tänään") laskee kaiken `athlete_results`-taulusta. Tämä jättää näkyvistä:

- **Kisoja-laskuri** näyttää vain ne kisat, joista on jo harvesteoitu tuloksia (6). Käynnissä olevat ilman tuloksia eivät näy → todellisuudessa kisoja on ≥12.
- **Ennätyksiä-laskuri** käyttää `was_pb`-saraketta, jonka päivittää harvest-putki kutsumalla `mark_pbs_for_competitions`. Tänään-päivän kisoille (esim. 19394, 19399, 19402…) tämä ei ole vielä mennyt läpi → 1380 rivistä was_pb=true on 0, vaikka käyttäjät näkevät PB-merkintöjä muualla.

## Muutos

### `src/lib/today-stats.ts`

1. **Kisojen lukumäärä elävästä lähteestä**: hae `fetchCompetitionList()` (sama lähde kuin `CompetitionSwitcher` käyttää) ja suodata Helsingin tämän päivän kisoihin (`filterToday`). Käytä tätä `competitions`-arvona athlete_results-distinct-id:n sijaan. Säilytä athlete_results-pohjaiset arvot `events`, `athletes`, `seasonTops` ennallaan.

2. **PB-laskennan korvaaminen client-puolella**: älä luota `was_pb`-sarakkeeseen. Lisää uusi apufunktio `fetchAllTimePriorBests(eventNames, athleteKeys)`, joka palauttaa `Map<athlete_key|normEvent, number>` parhaista tuloksista *ennen tämän päivän alkua* koko historiasta (ei kausirajaa). Käytä samaa sivutuskuviota kuin `fetchSeasonPriorBests`, hakuna `in("event_name", …)` + `in("athlete_key", …)`. Jaa kysely paloihin (`CHUNK = 200` athlete_keyä) jotta URL ei räjähdä.

3. **PB-laskenta**: käy läpi tänään-päivän rivit, joilla on `result_numeric` ja `athlete_key`. Jokaista (athlete, normalized event_name) -paria kohden: jos parempaa prior-tulosta ei ole (lower/higher better -säännön mukaan), kasvata `pbs`-laskuria yhdellä. Käytä `normalizeEventName` ja `isLowerBetter` (jo importattu).

4. **De-dup**: jos sama athlete-laji esiintyy useassa rivissä tänään, laske vain kerran. Pidä per (athlete, normEvent) tänään paras tulos ja vertaa sitä prior-bestiin.

### `src/components/TodayStatsSection.tsx`

Ei muutoksia — sama data-rajapinta riittää.

## Tekninen huomio

- `fetchCompetitionList` on jo cachattu fetch (CDN: `cached-public-api.tuloslista.com`); ei tuo lisäkuormaa.
- All-time PB-haku kasvattaa tämän queryn kokonaisbittimäärää, mutta athlete_keys-lista on rajattu tämän päivän osallistujiin (≈ alle 1500), eivätkä event_names ole moninaisia. Sivutus + chunked `in()` pitää sen siedettävänä.
- HARD_CAPit säilytetään turvarajoina.

Ei muutoksia harvest-putkeen, RLS:ään tai muihin näkymiin.