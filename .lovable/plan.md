## Tavoite

Viestijoukkueiden juoksijoiden nimet näkyviin kaikissa keskeisissä näkymissä — sekä reaaliaikaisissa (suorituspaikan livenäyttö, lajinäkymä, seuraa-näkymä, kuuluttaja) että etusivun "Seuran urheilijat tänään" -listassa. Esitys: vaihtojärjestys numeroituna, esim. `1. Halla Roto · 2. Eevi Piispanen · 3. Enni Häyrinen · 4. Nasti Nihtilä`.

## Tausta

Tuloslistan live-API palauttaa viestin allokaation alla `AthleteOrders[]` (sis. `Index` ja `Athlete.{Firstname,Surname,Organization}`) sekä `Athletes[]`. Nimiä ei tällä hetkellä lueta tyypityksessä eikä renderöidä missään.

Etusivun "Seuran urheilijat tänään" lukee taustaharvestin täyttämästä `athlete_results`-taulusta, jossa on yksi rivi per joukkue (firstname=surname=joukkueen nimi) — yksittäisiä juoksijoita ei tallenneta. Joten DB-pohjaisen näkymän tueksi tarvitaan skeemalaajennos ja harvesterin laajennos.

## Muutokset

### 1. Skeemamuutos (migraatio)

Uusi taulu `public.relay_legs`:
- `competition_id int`, `event_id int`, `team_alloc_id int` (= Allocation.Id), `leg_index int` (= AthleteOrders[].Index, 1–N), `athlete_id int`
- `firstname text`, `surname text`, `organization text`, `organization_id int`, `athlete_key text` (= "`surname|firstname|orgId`", sama muoto kuin `athlete_results`)
- `team_athlete_key text` (linkki team-riviin `athlete_results`-taulussa), `age_class text`, `event_name text`
- Primary key: `(competition_id, event_id, team_alloc_id, leg_index)`
- Indeksit: `(competition_id, event_id)` (live-lookup), `(team_athlete_key, competition_id, event_id)` (etusivu-lookup), `(athlete_key)` (urheilijasivu)
- GRANTit (luetaan etusivulta anon-kontekstissa? — tarkistetaan: `athlete_results` sallii lukea anon-kontekstissa? Käytetään samaa luku-mallia kuin `athlete_results`)
- RLS: read-only kaikille (sama kuin `athlete_results`)

### 2. Harvester (`src/routes/api/public/hooks/harvest-results.ts`)

Laajennetaan `Allocation`-interface harvestissa: `Id?: number; AthleteOrders?: { Index: number; Athlete: { Id: number; Firstname: string; Surname: string; Organization?: { Id: number; Name: string } } }[]`.

`processCompetition`:n päässä, kun `category === "Relay"` ja AthleteOrders on saatavilla, kerätään `relay_legs`-rivit ja flushataan ne erikseen `upsert`illä (sama `pending`-pattern kuin tulosriveillä, oma chunk). Käytetään viimeisintä kierrosta (final/loppu), jotta lopullinen joukkuekokoonpano voittaa alkuerän kokoonpanon.

### 3. Live-tyypit (`src/lib/tuloslista.ts`)

Lisätään `Allocation`-tyyppiin:
```ts
AthleteOrders?: Array<{ Index: number; Athlete: { Id: number; Firstname: string; Surname: string; Organization?: { Id: number; Name: string; NameShort: string } } }>;
Athletes?: Array<{ Id: number; Index: number; Firstname: string; Surname: string }>;
```
Sama `Enrollment`-tyyppiin (`Athletes?`).

Lisätään apufunktio `formatRelayLegs(alloc: Allocation): string | null`:
- jos `event_category === "Relay"` ja `AthleteOrders`/`Athletes` on, palauttaa `"1. Etu Suku · 2. ... · 3. ... · 4. ..."` (lajitellaan Indexin mukaan).

### 4. Live-näkymät

Renderöidään `formatRelayLegs`-tulos joukkueen alle pienellä muted-tekstillä:
- **`src/routes/scoreboard.tsx`** — suorituspaikan livenäyttö, lisätään rivin nimirivin alle
- **`src/routes/round.$eventId.$roundId.tsx`** — lajinäkymä
- **`src/routes/watch.tsx`** ja **`src/routes/seuraa.$token.tsx`** — seurattujen näkymä (jos seurattava juoksee viestissä, näytetään koko joukkue)
- **Kuuluttaja** `src/components/announcer/shared.tsx` / `CompletedSection.tsx` / `InProgressSection.tsx` — completed-rivin alle
- **`src/components/announcer/NewResultOverlay.tsx`** — uuden tuloksen flash-overlay

### 5. Etusivun "Seuran urheilijat tänään" + osallistuvien urheilijoiden näkymät

**`src/lib/club-today.ts`**: uusi funktio `fetchClubTodayRelayLegs(rows)`, joka hakee `relay_legs`-rivit kaikille rivien `(competition_id, event_id, team_athlete_key)`-tripleille ja palauttaa Mapin. ClubTodayRow-tyyppiin ei kosketa.

**`src/components/ClubTodaySection.tsx`**: jos rivi on `event_category === "Relay"`, näytetään joukkuerivin alapuolella `1. … · 2. … · 3. … · 4. …`. Lisätietoja seuran omasta juoksijasta ei korosteta — koko kokoonpano näkyy seuran joukkueelle.

### 6. Pieni karsinta

Athletes/AthleteOrders-payload on iso (n. 4–8 kpl per joukkue). Ei tallenneta `Athlete`-objektia kokonaisuudessaan, vain tarvittavat kentät. Ei kosketa muihin nykyisiin näkymiin (urheilijasivut, kausitilastot) tämän kierroksen aikana — voidaan laajentaa myöhemmin jos halutaan että viestit tulevat myös yksittäisen urheilijan sivulle.

## Vaiheet

1. Migraatio `relay_legs`-taululle (GRANT + RLS).
2. Harvesterin laajennos: `AthleteOrders` luetaan ja kirjoitetaan `relay_legs`-tauluun. Backfill ajetaan kun harvester ajaa seuraavan kerran tail-moodissa (revisitoi viimeiset ID:t) — tämän päivän viestien legit täyttyvät ~1 cronin viiveellä, lisäksi käytetään harvesterin `?fromId&toId`-overrideä YAG:lle (19616) manuaalisen ajon kautta.
3. Live-tyypit + `formatRelayLegs`-helper.
4. Live-näkymien renderöinti (scoreboard, round, watch, seuraa, kuuluttaja, overlay).
5. ClubTodaySection-lookup ja renderöinti.

## Verifiointi

- YAG T11 4x600m: lajinäkymä ja scoreboard näyttävät joukkueen alla `1.–4. juoksijat` AthleteOrders-järjestyksessä.
- Etusivu → valitse "Lahden Ahkera" → P11/T11/T13 4×600 m -rivit näyttävät kaikkien neljän juoksijan nimet vaihtojärjestyksessä.
- Ei muutoksia muihin lajeihin (yksittäisiin lajeihin ei tule "Athletes"-listaa).
