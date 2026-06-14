## Tavoite

Tehdä suunnittelijasta valmiimpi: oletussuorituspaikat YU-kentälle, pakotettu lajikatalogivalinta, monipäiväinen tapahtuma + lajien päivärajaus, raahattava Gantt-aikataulu, testikilpailugeneraattori, **ja pohjan ottaminen aiemmasta livetuloslistakilpailusta**.

## Muutokset

### 1. Tapahtuman luonti & perustiedot
- `competition_plans`: lisää `is_multi_day` (bool) ja `day_windows` (jsonb: `[{date, starts_at, ends_at}]`).
- Basics-välilehti: "Monipäiväinen?" -kytkin → näytetään päivälista (lisää/poista) ja alku/loppu per päivä.

### 2. Suorituspaikat — YU-kentän oletuspohja
- "Käytä YU-kentän oletusta" -nappi avaa paneelin, jossa lista vakiopaikoista määräalasvetoineen (0/1/2/3):
  pikajuoksusuora, ratakierros, pituuskuoppa, kolmiloikkapaikka, korkeushyppy, seiväshyppy, kuulakehä, kiekkokehä, keihäsvauhdinotto, moukarikehä.
- "Lisää valitut" luo `plan_venues`-rivit järkevillä nimillä ("Pituuskuoppa A/B", "Kuulakehä 1"…).
- Manuaalinen lisääminen säilyy.
- Tekstit: "Asemia rinnakkain" → kenttälajeissa "Suorituspaikkoja", juoksulajeissa "Ratoja".

### 3. Lajit — pakotettu valinta katalogista
- Poistetaan vapaat tekstikentät; käytetään `get_event_catalog`-RPC:tä (alennetaan kynnystä uudessa `get_event_catalog_full`-RPC:ssä, jotta kaikki sarjat tulevat mukaan).
- Lajidialogi: kaksivaiheinen pudotusvalikko (ikäluokka → laji), "Lisää oma laji" toissijaisena painikkeena.
- Final-formaatille selitykset valinnan vieressä.
- "Oma kesto (min)" → "Ohita arvioitu kesto (min)" + tooltip ("Oletuksena lasketaan livetuloslistan historiasta; täytä vain jos haluat pakottaa toisen arvon").

### 4. Lajien päivärajaus (monipäivä)
- `plan_events`: lisää `allowed_days date[]` (null = vapaa).
- Lajidialogissa monivalinta päivistä jos `is_multi_day`.
- Solveri rajaa sijoittelun sallittuihin päiviin.

### 5. Solver — monipäivätuki
- Pilkotaan greedy päivittäin: iteroidaan päivät järjestyksessä, segmentti joka ei mahdu siirtyy seuraavaan sallittuun päivään.
- Venuetilakoneet nollataan päivän alussa.

### 6. Aikataulunäkymä — Gantt + raahaus
- Uusi `PlannerGantt`-komponentti:
  - Vasen sarake: rivit ryhmiteltynä ikäluokan + lajin mukaan (toggle: ikäluokan / suorituspaikan mukaan).
  - Yläpalkki: aika-akseli per päivä, päivävalitsin välilehtinä.
  - Palkit värikoodattu ikäluokan mukaan, leveys = kesto.
- Raahaus pointer-tapahtumilla (ei uutta riippuvuutta), napsahdus 5 min ruudukkoon. Pudotus toisen suorituspaikan riville vaihtaa venuen.
- Reaaliaikainen `detectConflicts` → punainen reuna + tooltip.
- "Tallenna" persistoi `plan_schedule_items`-muutokset.

### 7. Testikilpailun generaattori
- "Luo demokilpailu" -nappi: tyhjentää (vahvistuksella) ja lisää YU-kentän oletuspaikat + tyypilliset lajit jokaiseen ikäluokkaan + satunnaiset osallistujamäärät (6–24), ajaa solverin.

### 8. **Pohja aiemmasta kilpailusta** (uusi)
- "Uusi suunnitelma" -nappiin pudotusvalinta:
  - "Tyhjä pohja" (nykyinen).
  - "YU-kentän oletus + demolajit" (= testikilpailu).
  - "Aiempi kilpailu…" → avaa dialogi, jossa pudotusvalikossa **vuoden 2026 kilpailut** (myöhemmin valittava vuosi) `athlete_results`-taulusta (DISTINCT `competition_id`, `competition_name`, `competition_date`, järjestys uusin ensin).
- Valittu kilpailu → kopioidaan suunnitelmaan:
  - **Ikäluokat + lajit**: `athlete_results` ryhmiteltynä `age_class` + `event_pb_key` → `plan_events`-rivit. Osallistujamääräksi todellinen osallistujamäärä (DISTINCT `athlete_key`).
  - **Suorituspaikat**: oletetaan YU-kentän vakiopaikat (1 kpl kutakin), koska venue-tieto ei ole tuloslistassa. Käyttäjä voi muokata.
  - **Aikaikkuna**: `min/max(captured_at)` → tapahtuman alku/loppu pyöristettynä. Monipäiväinen tunnistetaan, jos kestää yli yhden päivän.
  - **Kestojen oletusarvot** poimitaan automaattisesti samasta kilpailusta (per laji `max-min` capture-aika), jos olemassa, muuten yleisestä regressiosta.
- Toteutus: uusi server-fn `src/lib/planner-templates.functions.ts`:
  - `listRecentCompetitions(year)` → palauttaa kilpailut pudotusvalikkoa varten.
  - `buildPlanFromCompetition(competitionId, planId)` → ajaa kopioinnin server-fn:nä (`requireSupabaseAuth` + admin-tarkistus).

### 9. Termistö & UX-pikkukorjaukset
- "Asemia rinnakkain" → kontekstin mukaan "Suorituspaikkoja" / "Ratoja".
- Final-formaatin selitykset.
- "Oma kesto" → "Ohita arvioitu kesto" + ohje.

## Tekniset yksityiskohdat

- **Migraatio**:
  - `ALTER TABLE competition_plans ADD COLUMN is_multi_day boolean NOT NULL DEFAULT false, ADD COLUMN day_windows jsonb`.
  - `ALTER TABLE plan_events ADD COLUMN allowed_days date[]`.
  - Uusi RPC `get_event_catalog_full()` (alennettu kynnys, ei aikarajaa).
  - Uusi RPC `list_planner_template_competitions(p_year int)` palauttaa kilpailulistan.
- **Uudet tiedostot**:
  - `src/lib/planner-defaults.ts` — YU-kentän vakiopaikat.
  - `src/lib/planner-demo.ts` — demokilpailun generointi.
  - `src/lib/planner-templates.functions.ts` — server-fn: listaus + kopiointi aiemmasta kilpailusta.
  - `src/components/planner/DefaultVenuesDialog.tsx`.
  - `src/components/planner/EventPickerDialog.tsx` — kaksivaiheinen pudotusvalikko.
  - `src/components/planner/TemplatePickerDialog.tsx` — uusi (kilpailu pohjaksi).
  - `src/components/planner/PlannerGantt.tsx` — raahattava kalenteri.
- **Muokattavat**: `src/lib/planner-solver.ts` (monipäivä + `allowed_days`), `src/lib/planner-types.ts`, `src/routes/planner.$planId.tsx`, `src/routes/planner.index.tsx` (uudet luontivaihtoehdot).
- Raahaus toteutetaan kevyellä pointer-handlerilla ilman uusia riippuvuuksia; px↔min konversio aika-akselin `pixelsPerMin`-vakion kautta.

## Mitä jää pois
- Ei lajien välistä riippuvuusgraafia (paitsi heats→final, joka jo on).
- Ei mobiilioptimoitua raahausta tässä iteraatiossa.
- Pohjasta kopioitaessa venue-mappaus on käyttäjän vastuulla (lähdedatassa ei ole suorituspaikkatietoa).
