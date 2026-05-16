# PB-merkinnän bugin korjaus

## Ongelma

Elli Savolaisen 60m Reilu Cup 1 (14.5.2026, 9,21) on merkitty PB:ksi, vaikka hänellä on aiempia parempia aikoja:
- Kouvola Junior Games 19.7.2025: **9,12**
- Avoimet nuorten pm-hallit 5.4.2026: **9,10**

## Syy

`mark_pbs_for_competitions`-funktio vertailee "aikaisempia" tuloksia `captured_at`-aikaleiman perusteella, eli sen mukaan **milloin rivi lisättiin tietokantaan** — ei kilpailun päivämäärän mukaan.

Reilu Cup 1 syötettiin 14.5. klo 17:29. Historialliset tulokset (mm. Kouvola) ehdittiin perata vasta 15.5. — silloin kun Reilu Cupin PB-arvio tehtiin, Kouvolan tulosta ei vielä ollut taulussa, joten 9,21 näytti PB:ltä.

Lisäksi funktio käsittelee vain rivejä joilla `was_pb = false` ja kääntää lipun vain ylöspäin. Se ei koskaan **poista** virheellistä PB-merkintää, vaikka aiempi parempi tulos myöhemmin ilmestyisi.

## Korjaus

### 1. Uusi PB-funktio (migration)

Korvaa `mark_pbs_for_competitions` funktiolla joka:
- Vertailee ensisijaisesti `competition_date`-ajalla, tiebreakerinä `captured_at` ja `id`.
- Asettaa `was_pb`-kentän aina oikein (sekä TRUE → FALSE että FALSE → TRUE) kohderyhmälle.
- Sama normalisointi (`normalize_event_name`) ja samat sääntö Track vs. ei-Track.

### 2. Globaali uudelleenlaskenta

Lisää funktio `recalculate_all_pbs()` joka käy kaikki uniikit `(athlete_key, normalize_event_name(event_name))`-parit ja merkitsee jokaiselle aikajärjestyksessä ensimmäisen "all-time-best"-rivin PB:ksi (kuten silloin tulos oli ennätys hetkellään).

Säännöt per (athlete, normalisoitu laji):
- Käy rivit järjestyksessä `competition_date ASC, captured_at ASC, id ASC`.
- Pidä yllä juoksevaa parasta (`min` Trackille, `max` muille).
- Jos rivi on parempi tai yhtä hyvä kuin aiemmat → `was_pb = true`. Muuten `false`.

Ajetaan tämä kerran migraation lopuksi.

### 3. Harvester pysyy ennallaan

`harvest-results.ts` kutsuu jatkossakin `mark_pbs_for_competitions(comp_ids)`. Funktion uusi toteutus toimii inkrementaalisesti: kun uusia kilpailuja tulee, niiden PB-status lasketaan kaikkia muita rivejä vasten oikein.

Huom: jos historiallista dataa ladataan jälkikäteen (kuten nyt 2025-kausi 15.5.), `mark_pbs_for_competitions` kutsutaan niillekin comp_id:eillä → uudet "vanhat" tulokset saavat PB-statuksen oikein ja **purkavat** myöhempien rivien virheellisen PB:n.

## Tekniset yksityiskohdat

- `mark_pbs_for_competitions(comp_ids)`: kohderyhmänä kaikki rivit joissa `competition_id = ANY(comp_ids)` JA niiden (athlete, norm_event)-parien **kaikki muut rivit** — koska yhden rivin lisääminen voi muuttaa myöhemmän rivin statusta. Käytännössä helpoin toteutus: aja rivit pareittain läpi PL/pgSQL-kursorilla tai `WITH ranked AS (...)` -kyselyllä joka laskee uuden statuksen kaikille `(athlete_key, norm_event)`-pareille joihin uudet rivit kuuluvat, ja UPDATE jos `was_pb` poikkeaa nykyisestä.
- Ei muutoksia frontend-koodiin eikä `harvest-results.ts`:ään.

## Tiedostot

- Uusi migraatio: `supabase/migrations/<timestamp>_fix_pb_calculation.sql`
  - `CREATE OR REPLACE FUNCTION public.mark_pbs_for_competitions(...)` (uusi logiikka)
  - Kertakäyttöinen `DO $$ ... $$` -lohko joka ajaa uudelleenlaskennan kaikille olemassaoleville kilpailuille
