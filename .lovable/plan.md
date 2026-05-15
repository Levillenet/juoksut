## Tavoite

Oma sivu `/kilpailukalenteri`, jolla voi selata ja suodattaa kilpailukalenteri.fi:stä yleisurheilukisat (rata + maantie). Data scrapataan kerran päivässä taustalla ja tallennetaan omaan tauluun, joten käyttäjälle haku on nopea.

## Lähde

Kilpailukalenteri.fi:llä ei ole julkista API:a. Käytetään HTML-scrapea:
- Hakusivu (POST/GET parametreilla): `https://www.kilpailukalenteri.fi/?cs=20&...`
- Yksittäinen kisa: `?cs=16&nid={id}` — sieltä saadaan tarkemmat tiedot.
- Suodatetaan lajiksi yleisurheilu (rata + maantie). Aluksi tuodaan kuluvan kauden + ~6 kk eteenpäin olevat kisat.

Jokaisesta kisasta tallennetaan: lähde-id (`nid`), nimi, päivämäärä(t), paikkakunta, luokitus (SM/kansallinen/pk/seura/aluekisa…), laji (rata/maantie), ilmoittautumisen päättymispäivä, järjestäjäseura jos saatavilla, ja linkki alkuperäiseen sivuun.

## Tietokanta

Uusi taulu `external_competitions`:
- `source` (text, oletus `'kilpailukalenteri'`)
- `source_id` (int, esim. nid) — uniikki yhdessä `source`:n kanssa
- `name`, `location`, `classification`, `discipline` (`track` | `road`)
- `start_date`, `end_date` (date), `registration_deadline` (timestamptz, null)
- `organizer` (text, null), `url` (text)
- `raw` (jsonb) — alkuperäinen scraped payload diagnostiikkaan
- `last_seen_at`, `created_at`, `updated_at`

RLS: kaikki authenticated voi lukea, vain palvelin (admin) kirjoittaa — sama malli kuin `athlete_results`.

Lisäksi `harvest_state`-tyylinen rivi `external_harvest_state` (last_run_at, last_status, scanned_count) seurantaan.

## Backend

1. **Scraper** `src/lib/external-competitions.server.ts`:
   - `fetchKilpailukalenteriList(monthsAhead)` hakee selauslistan kuukausi kerrallaan, suodattaa lajiksi yleisurheilu.
   - Parsii HTML:n cheeriolla (lisätään dependencyksi).
   - Palauttaa normalisoidut rivit.
2. **Cron-reitti** `src/routes/api/public/hooks/harvest-kilpailukalenteri.ts`:
   - POST-kutsu, todennus `apikey`-headerilla (Supabase anon key, sama tapa kuin nykyinen harvester).
   - Ajaa scrapen, upsertaa `external_competitions`-tauluun (`onConflict: source,source_id`), päivittää `last_seen_at`.
   - Päivittää `external_harvest_state`.
3. **pg_cron-ajastus** kerran päivässä klo 04:00 Helsinki-aikaa (cron-ilmaisu UTC:nä `0 1 * * *`). Lisätään insert-toolilla cron.schedule-kutsu, joka kutsuu reittiä stabiilin published-URL:n kautta.
4. **Server fn** `getExternalCompetitions` (`createServerFn`) lukee taulun ja palauttaa suodatetun listan (päivämäärä-, luokitus-, lajisuodattimet). Käyttää `requireSupabaseAuth`-middlewarea.

## Frontend

Uusi reitti `src/routes/kilpailukalenteri.tsx`:
- Otsikko, lyhyt selitys ("Lähde: kilpailukalenteri.fi, päivittyy kerran vuorokaudessa").
- Suodatuspalkki: aikaväli (alku–loppu, oletus tänään → +60 pv), luokitus (multi-select: SM, kansallinen, pk, seura, alue, jne.), laji (rata/maantie), vapaa tekstihaku (nimi/paikkakunta).
- Tuloslista taulukkona: päivämäärä, kilpailu (linkki ulkoiselle sivulle), paikkakunta, luokitus, ilmoittautuminen päättyy. Ryhmitelty päivän mukaan.
- Mobiili: kortteina (sama tyyli kuin muut listat).
- Tyhjän tilan ja virheen viestit suomeksi.

Linkki uuteen sivuun lisätään etusivun navigaatioon (sama paikka kuin "Tilastot" / "Suorituspaikan livenäyttö").

## Riippuvuudet

- `cheerio` HTML-parsintaan (server-only, toimii Cloudflare Worker -runtimessa).

## Ei kuulu tähän

- Ilmoittautumisen tai live-tulosten yhdistäminen (kilpailukalenteri ei tarjoa niitä).
- Reaaliaikainen tarkistus — uudet kisat näkyvät seuraavan vuorokauden aikana.
- Muiden lajien (suunnistus, hiihto…) kisat.
