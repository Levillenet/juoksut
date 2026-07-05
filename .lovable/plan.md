# Lahden piirin piiriennätykset

Ladattu PDF sisältää ~1200 riviä ja satoja ennätyksiä (P8–P22, T8–T22, useita ottelu-, aita- ja painoluokkia, halli/aut-merkinnät). Vanhoista ennätyksistä osa on nykyisin poistuneiden seurojen nimissä (Lammin Säkiä, Lahden Urheilijat, Kosken Kuohu, Lahden Sampo, Hollolan Urheilijat -46), joten pidämme kaikki ennätykset historiallisesti oikein, mutta uudet PE-merkinnät sallitaan vain listatuille 19 nykyseuralle.

## Tietokanta

Uusi taulu **`district_records`** (yksi rivi per voimassa oleva ennätys — vain viimeisin per event_key + age_class + gender):

- `id`, `gender` ('M'/'F'), `age_class` ('P8'..'P22','T8'..'T22'), `event_name_raw`, `event_pb_key`, `result_text`, `result_numeric`, `record_holder`, `birth_year`, `club`, `record_year`, `indoor`, `wind_or_manual` (esim. 'aut.','i','+ 1,4'), `notes` (esim. ottelun osasuoritukset), `source_page`, `created_at`, `updated_at`.
- Indeksit: `(age_class, event_pb_key)` uniq, `(record_holder, birth_year)`.
- RLS: julkinen SELECT (kaikki näkevät), muutokset vain adminille (`is_admin_user()`).

Uusi taulu **`district_record_breaks`** — historia siitä, milloin tulos on rikkonut piiriennätyksen (analogia was_pb):

- `id`, `athlete_key`, `athlete_result_id` (FK), `age_class`, `event_pb_key`, `previous_record_id` (FK district_records), `previous_result_numeric`, `new_result_numeric`, `broken_at`, `competition_id`.
- Julkinen SELECT.

Uusi sarake **`athlete_results.was_district_record` boolean default false** — kevyt merkintä kuten `was_pb`.

Uusi vakioseuralista tietokantaan: **`lahti_district_clubs`** (yksi sarake `club_name`) — 19 seuraa, käytetään PE-tarkistuksissa. Nimet:
Artjärven Ahjo, Asikkalan Raikas, Hartolan Voima, Heinolan Isku, Herralan Hukat, Hollolan Nasta, Iitin Pyrintö, Joutsan Pommi, Kuhmoisten Kumu, Kärkölän Kisa-Veikot, Lahden Ahkera, LahtiSport, Myrskylän Myrsky, Nastolan Naseva, Orimattilan Jymy, Orimattilan Toive, Padasjoen Yritys, Pertunmaan Ponnistajat, Sysmän Sisu.

SQL-funktio **`check_district_record(_result_id uuid)`** SECURITY DEFINER:
- Hakee tuloksen, tarkistaa että seura on `lahti_district_clubs`-listalla ja ikä sopii `age_class`-luokkaan.
- Vertaa `result_numeric`-arvoa `district_records`-taulun vastaavaan `event_pb_key + age_class`-riviin (juoksuissa pienempi, kentässä suurempi).
- Jos rikkoo → päivittää `district_records`-rivin, lisää `district_record_breaks`-rivin, asettaa `was_district_record=true`.

## PDF-parsinta

Kertaluontoinen node-skripti `scripts/parse-district-records.mjs`:
- Lukee `pe.txt` (pdftotext -layout output).
- Tunnistaa ikäluokat regexillä (P8, P 10, T13 jne.).
- Parsii per rivi: tulos, nimi + syntymävuosi, seura, vuosi.
- Normalisoi laji: erottaa aitakorkeuden/kuulan painon lajinimeen, käyttää samaa `event_pb_key`-logiikkaa kuin nykyinen `event_pb_key`-funktio.
- Tuottaa SQL-migraation (INSERT INTO district_records) — käydään läpi ja hyväksytään ennen ajoa.
- Ottelurivit (2-rivistä: pisteet + osasuoritukset) kootaan `notes`-kenttään.

Realistinen kattavuus: ~85–90 % automaattisesti; loput (rikkinäiset rivit, viestit joissa juoksijaluettelo) käydään manuaalisesti läpi tai jätetään pois.

## Automaattinen PE-tarkistus

- Uusi trigger `athlete_results`-tauluun (AFTER INSERT/UPDATE OF result_numeric) → kutsuu `check_district_record()`.
- Backfill: yksi ajo `check_district_record` kaikille viimeisen 5 vuoden tuloksille listattujen seurojen urheilijoille.

## UI

1. **Etusivun korostus** — kun jonkin listatun seuran urheilija tekee piiriennätyksen, näkyy uudessa "Piiriennätykset tänään" -osiossa athlete_analytics-tyylillä.
2. **Uusi reitti `/piirienn`** (Lahden piiri) — TanStack-reitti, näyttää ennätykset ikäluokittain valittavana (P/T + ikä), taulukkona (laji, tulos, tekijä, seura, vuosi). Jaettava suoralinkki + head-metadata.
3. **Tulosnäkymään PE-merkki** — samaan tapaan kuin nykyiset PE/SE-merkit, uusi vihreä "PE" -badge.

## Vaiheistus

1. Migraatiot (taulut + seuralista + funktio + trigger).
2. Parsintaskripti + SQL-inserttien katselmointi.
3. Backfill viimeisen 5 vuoden tuloksille.
4. UI-komponentit (piiriennätyssivu, PE-badge, etusivun osio).

## Kysymys ennen aloitusta

Onko OK että:
- historialliset ennätykset pidetään alkuperäisinä (poistuneet seurat myös), mutta uudet PE:t sallitaan vain 19 nykyseuralle?
- vanhoja seuranimiä ei yhdistetä nykyisiin (esim. Lahden Urheilijat ≠ Lahden Ahkera)?

Jos kyllä, aloitan vaiheella 1 (migraatiot).
