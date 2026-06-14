# Lajien sitominen oikeisiin suorituspaikkoihin

## Ongelma

Solver (`src/lib/planner-solver.ts`) sijoittaa lajeja **kaikille** vapaille suorituspaikoille kindistä riippumatta — esim. kuula voi päätyä juoksuradalle. Olemassa oleva `isVenueForEvent(kind, eventName)` (`src/lib/planner-defaults.ts`) ei ole kytkettynä solveriin. Lisäksi `VenueKind`-luettelo niputtaa kaikki heitot `throw_ring`iin, joten kuula, kiekko ja moukari kelpaavat samoille kehille — vaikka todellisuudessa kuula heitetään kuulakehässä ja kiekko/moukari moukarikehässä (häkki).

## Ratkaisu

1) **Lisätään tarkempi `VenueKind`-jaottelu** heitoille `src/lib/planner-types.ts`:
   - `shot_ring` – Kuulakehä (kuula)
   - `throw_cage` – Moukarikehä / heittohäkki (kiekko, moukari)
   - `throw_runway` – Keihäsvauhdinotto (keihäs) — ennallaan
   - `throw_ring` säilytetään yhteensopivuuden vuoksi yleisenä "muu kehä" -tyyppinä, mutta uudet oletuspaikat eivät käytä sitä.
   - Päivitetään `VENUE_KIND_LABEL`.

2) **Päivitetään oletuspaikat** `src/lib/planner-defaults.ts`:
   - `shot` → `kind: "shot_ring"`
   - `discus` → `kind: "throw_cage"` (jaettu "Moukari-/kiekkohäkki" käytännössä, mutta nimi pysyy "Kiekkokehä" / sallitaan myös moukari)
   - `hammer` → `kind: "throw_cage"`

3) **Päivitetään `isVenueForEvent`**:
   - `kuula|shot` → vain `shot_ring`
   - `kiekko|discus` → vain `throw_cage`
   - `moukari|hammer` → vain `throw_cage`
   - `keihäs|javelin` → vain `throw_runway`
   - `pituus|kolmiloikka` → vain `jump_pit`
   - `korkeus` → vain `high_jump`
   - `seiväs` → vain `pole_vault`
   - `aidat` ja juoksulajit → `track_straight` tai `track_oval`
   - Generic fallback ei enää palauta `true`:tä — palauttaa `false`, jotta tuntematon paikka ei vahingossa kelpaa.

4) **Kytketään suodatus solveriin** `src/lib/planner-solver.ts`:
   - Segmentin sisään lasketaan `compatibleVenues = input.venues.filter(v => isVenueForEvent(v.kind, ev.event_name))`.
   - Korvataan `venueStates`-globaali käyttö per-segment `eligibleStates`-listalla.
   - Jos `eligibleStates.length < needsStations`, lisätään varoitus: `"<age> <laji> – ei sopivaa suorituspaikkaa (tarvitaan tyyppi X)"` ja jatketaan.
   - Vapauttaminen (`busyUntil`-päivitys) tapahtuu vain valituille `placedVenues`-paikoille kuten nykyisinkin.

5) **Konfliktitarkistus** `detectConflicts` (`planner-solver.ts`): lisätään uusi tarkistus, joka merkitsee aikatauluitemin punaiseksi, jos `venue.kind` ei sovi `event_name`iin (käyttäjän manuaalinen drag voi rikkoa sääntöä). Reason: `"Laji ei kuulu suorituspaikalle <venue>"`.

6) **Migraatio uusille kindeille**: Tietokannan `plan_venues.kind` on todennäköisesti `text`/enum. Tarkistetaan ensin `plan_venues`-skeema `supabase--read_query`illä; jos kind on enum, lisätään arvot `shot_ring` ja `throw_cage`. Jos sarake on pelkkä `text`, ei tarvita migraatiota. Käytössä olevat rivit `kind = 'throw_ring'` siirretään parhaaseen vastineeseen nimellä:
   - nimi sisältää "kuula" → `shot_ring`
   - nimi sisältää "moukari" tai "kiekko" → `throw_cage`
   - muuten ennallaan.

## Muutettavat tiedostot

- `src/lib/planner-types.ts` — uudet `VenueKind`-arvot + label.
- `src/lib/planner-defaults.ts` — oletuspaikkojen kindit + `isVenueForEvent` tiukennus.
- `src/lib/planner-solver.ts` — suodatus segmenttikohtaisesti + konfliktitarkistus.
- (mahdollinen) Supabase-migraatio enumin laajennukseen ja olemassa olevien `throw_ring`-rivien luokittelu uudelleen.

## Mitä EI tehdä

- Ei muuteta PDF/Excel-vientiä, gantt-näkymää eikä UI-reittejä.
- Ei kosketa solverin aikalogiikkaa muuten kuin suodatuksen osalta.
