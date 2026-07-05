## Juurisyy — miksi Kouvola Junior Games ei näy "Seuran urheilijat tänään" -osiossa

- `cached-public-api.tuloslista.com` **sisältää** 19719 (Kouvola Junior Games, 4.7., Valkealan Kajo) — data on olemassa.
- `harvest_competitions.19719` on tilassa `exists_in_source=false, row_count=0, last_scanned_at=29.6.` Migraatio nollasi `done=false`, mutta ei koskenut `last_scanned_at`-arvoon.
- Harvestterin revisit-jono (`nonexistRes` osiossa `harvest-results.ts`) järjestää ei-olemassaolevat rivit **`last_scanned_at ASC`** ja ottaa vain 120/ajo. Jonossa on 594 riviä, joista vanhimmat (5.6.) ovat 19421–19440 → uusimmat ID:t (kuten 19719) tulevat vasta ~5 ajon kuluttua.
- "Seuran urheilijat tänään" (`fetchClubTodayResults`) lukee `athlete_results`-taulua → koska harvestteri ei ole vielä upserttannut 19719:n rivejä, koko kisa puuttuu — sama syy kuin analytiikassa.

## Korjaus (frontend + backend rajallinen: vain harvestterin priorisointi)

Yksi backend-tiedostomuutos, ei uutta migraatiota. Muutetaan revisit-jonoa niin, että **uusimmat varatut mutta vielä ei-olemassaolevat ID:t skannataan aina ensin** — 19719 (ja tulevat vastaavat) tulee valituksi joka ajossa niin kauan kuin niitä ei ole harvestattu.

### `src/routes/api/public/hooks/harvest-results.ts`

Jaetaan nykyinen `nonexistRes` (jono kaikille tuoreille ei-olemassaoleville) kahteen budjettiin:

1. **Recent-bucket** (uusi): `exists_in_source=false, done=false, competition_id >= latestId - NONEXIST_PERMANENT_GAP` järjestettynä **`competition_id DESC`**, limit esim. 60. Nappaa aina ensin ne ID:t jotka ovat lähimpänä uusinta havaittua — käytännössä tämän viikon uudet kisat.
2. **Older-bucket** (nykyinen behavior säilyy): sama query, `last_scanned_at ASC`, limit `NONEXIST_REVISIT_LIMIT - 60`. Näin ei jäädä koskaan jumiin viikkojen takaisiin gap-riveihin.

`revisitRows`-listaan yhdistetään molemmat (Set-dedupe on jo paikalla). Ei muita muutoksia — `nearTodayRes`, `freshRes`, `staleRes` säilyvät.

Vaikutus: seuraavassa cron-ajossa 19719 (ja muut viimeaikaiset varatut ID:t) probataan uudelleen, upserttaantuu `athlete_results`-tauluun, ja näkyy sekä "Seuran urheilijat tänään" -osiossa että urheilijoiden analytiikassa parin tunnin sisällä.

## Ei muuteta

- Ei migraatiota (edellinen `first_scanned_at` -migraatio riittää).
- Ei `ClubTodaySection.tsx` / `club-today.ts` -muutoksia — nämä lukevat suoraan `athlete_results`ista ja korjaantuvat kun harvestteri saa datan sisään.
- Ei touch AthleteAnalytics-komponenttiin.

## Tekniset yksityiskohdat

```ts
const RECENT_NONEXIST_LIMIT = 60; // uusi
// nykyisen nonexistRes:n rinnalle:
const recentNonexistRes = await supabaseAdmin
  .from("harvest_competitions")
  .select("competition_id")
  .eq("exists_in_source", false)
  .eq("done", false)
  .gte("competition_id", Math.max(FLOOR_ID, latestId - NONEXIST_PERMANENT_GAP))
  .order("competition_id", { ascending: false })
  .limit(RECENT_NONEXIST_LIMIT);
// nykyisen nonexistRes-limitin päivitys: NONEXIST_REVISIT_LIMIT - RECENT_NONEXIST_LIMIT
```

Rivit yhdistetään `revisitRows`-arrayhin ennen dedupe-luuppia.
