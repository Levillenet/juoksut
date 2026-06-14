## Stadionien integrointi planneriin

Iso muutos joka koskee tietokantaa, plannerin UI:tä (3 välilehteä) ja solveria. Toteutus 4 vaiheessa, jokainen vaihe testattavissa erikseen.

### Vaihe 1 — Tietokanta

**Migraatio 1: laajenna `plan_venues`**
- `stadium_venue_id uuid REFERENCES public.stadium_venues(id) ON DELETE SET NULL`
- `included boolean NOT NULL DEFAULT true`

**Migraatio 2: laajenna `competition_plans`**
- `stadium_id uuid REFERENCES public.stadiums(id) ON DELETE SET NULL`

**Migraatio 3: uusi taulu `plan_conflict_groups`**
Rakenne kopio `stadium_conflict_groups`:sta:
- `id`, `plan_id` (FK competition_plans CASCADE), `name`, `description`, `venue_ids uuid[]` (viittaa plan_venues.id), `max_concurrent int default 1`, `source_stadium_group_id uuid NULL` (alkuperäisen viite, jotta voidaan tunnistaa kopio), timestamps
- RLS: omistaja saman planin kautta (`competition_plans.user_id = auth.uid()`)
- GRANT authenticated/service_role, RLS päälle

### Vaihe 2 — Perustiedot-välilehti

`BasicsTab`:
- Uusi kenttä **Stadion**: `<Select>` joka listaa käyttäjän stadionit + "Ei stadionia" + linkki "Luo uusi stadion ↗" (avaa `/stadiums` uudessa välilehdessä)
- Kun valinta muuttuu **ei → on**: kutsu `applyStadiumToPlan(planId, stadiumId)`:
  1. Hae `stadium_venues` + `stadium_conflict_groups`
  2. Lisää puuttuvat plan_venues-rivit (`included=false`, `stadium_venue_id` asetettu, name/kind kopioidaan)
  3. Kopioi conflict groups → `plan_conflict_groups` mapaten venue_id:t uusiin plan_venue-id:hin
- Kun valinta muuttuu **on → ei tai toinen stadion**: varoita modal-dialogilla ("poistetaan X paikkaa ja Y rajoitetta jotka tulivat stadionilta, säilyy käyttäjän käsin lisäämät"). Vahvistuksen jälkeen poista rivit joilla `stadium_venue_id IS NOT NULL` ja conflict groupsit joilla `source_stadium_group_id IS NOT NULL`.
- Infolaatikko stadionin alla: "N suorituspaikkaa, M rajoitetta. Mene Suorituspaikat-välilehdelle valitsemaan mitä tässä kisassa käytetään."

### Vaihe 3 — Suorituspaikat-välilehti

`VenuesTab` ehdollisesti:

**Jos `plan.stadium_id` ei null:**
- Lista plan_venues-riveistä joilla `stadium_venue_id IS NOT NULL`, ryhmitelty `kind`-mukaan ("Juoksuradat", "Hyppypaikat", "Heittopaikat", "Muut")
- Jokaisella rivillä rastiruutu `included` (toggle päivittää suoraan kantaan)
- Käyttäjän käsin lisäämät paikat (stadium_venue_id IS NULL) omassa "Lisätyt paikat" -lohkossa, jossa nykyinen muokkaus
- "Lisää oma paikka" -painike säilyy
- Infolaatikko: "K aktiivista rajoitetta" + lista nimistä
- **Varoitukset** (computed, ei tallenneta):
  - Jos `included=false` ja jokin event käyttää `plan_events.venue_id = v.id` → punainen banneri "Lajit X, Y käyttävät tätä paikkaa"
  - Jos rajoiteryhmän venueista osa on `included=false` → harmaa info "Rajoite ei aktiivinen: N/M paikkaa pois käytöstä"

**Jos `plan.stadium_id` null:** nykyinen toteutus muuttumattomana.

### Vaihe 4 — Solver + konfliktien tunnistus

`planner-solver.ts`:
- Hae `plan_conflict_groups` parametrina (`conflictGroups: ConflictGroup[]`)
- Suodata käytetyt venuet: vain `included=true`
- Aikataulutuksessa lisärajoite: jokaiselle aikahetkelle, jokaista konfliktiryhmää kohti, samaan aikaan aktiivisten eventtien lukumäärä joiden venue_id ∈ group.venue_ids ≤ `max_concurrent`. Toteutus: greedy-sijoittelussa tarkistus ennen aikaslotin valintaa.
- `detectConflicts`: lisää uusi tyyppi `"venue_group"` joka palauttaa loukatut event-id:t kun ryhmäkapasiteetti ylittyy.

UI gantissa: konfliktit värjätään kuten nykyiset.

### Tiedostot

**Uudet/migraatiot**
- 3 supabase-migraatiota

**Muokattavat**
- `src/integrations/supabase/types.ts` (auto-gen migraation jälkeen)
- `src/routes/planner.$planId.tsx` — BasicsTab, VenuesTab, prop-välitys
- `src/lib/planner-types.ts` — `VenueRow` saa `stadium_venue_id`, `included`; uusi `ConflictGroup`
- `src/lib/planner-solver.ts` — konfliktiryhmien rajoite + detectConflicts
- Uusi `src/lib/planner-stadium.ts` — `applyStadiumToPlan`, `removeStadiumFromPlan`

### Avoimet kysymykset
1. Kun stadion vaihdetaan toiseen, säilytetäänkö käyttäjän käsin lisäämät plan_venues? **Ehdotus: kyllä.**
2. Pitääkö plan_venues.included näkyä myös aikataulu-välilehdellä (vain included-paikat aikatauluun)? **Ehdotus: kyllä, oletuksena solver käyttää vain included=true.**
3. Saako saman conflict groupin sisällön muokata vapaasti vai vain `max_concurrent` & nimi? **Ehdotus: kaikki muokattavissa, source-viite jätetään diagnostiikaksi.**

Aloitan Vaihe 1 -migraatioilla heti kun hyväksyt suunnitelman.
