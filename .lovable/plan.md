## Mitä tehdään

Kolme erillistä korjausta käyttäjän esimerkki-Excelin (YAG22 lauantai) ja havaitun bugin pohjalta.

### 1) Korjaa "Lisää laji" -valikon tyhjä ikäryhmälista

**Juurisyy:** `get_event_catalog_full()` RPC palauttaa nyt aina virheen `canceling statement due to statement timeout` (testattu suoraan REST-päätepisteeseen). Se aggregoi koko `athlete_results`-taulun ilman aikarajaa, joten kysely kestää yli serverin timeoutin. Frontti saa virheen, `catalog`-state jää tyhjäksi → Ikäryhmä-pudotusvalikossa ei näy yhtään vaihtoehtoa.

**Korjaus:**
- Uusi migraatio joka korvaa `get_event_catalog_full()`:n versiolla, joka rajaa lähteen viimeisten ~3 vuoden kilpailuihin (`WHERE ar.competition_date >= now() - interval '3 years'`) ja käyttää `HAVING COUNT(*) >= 1`. Sama tulosrakenne, paljon nopeampi.
- Lisätään tukeva indeksi vain jos puuttuu: `CREATE INDEX IF NOT EXISTS idx_ar_age_event ON public.athlete_results(age_class, event_name)`.

### 2) Aikataulu-näkymä Excelin mallin mukaiseksi

**Tavoite (YAG22 Lauantai -välilehti):** kaksi peräkkäistä ruudukkoa, joissa molemmissa:
- yläreuna: kellonajat 5 min sarakkeissa (kokotuntilabelit + 5 min jaotus)
- rivit: yläosassa **suorituspaikkakohtainen** aikataulu (yksi rivi/suorituspaikka), alaosassa **ikäryhmäkohtainen** aikataulu (yksi rivi/ikäluokka)
- tapahtumat näkyvät värillisinä palkkeina, joiden pituus = kesto, sisältönä esim. `T15 (5) 5min/erä`

**Toteutus:**
Nykyinen koko näytön Gantt (`src/components/planner/PlannerFullGantt.tsx`) on jo arkkitehtuurisesti tämä — sitä laajennetaan, ei aloiteta tyhjästä:
- Käytetään sitä myös sisäänupotettuna `/planner/:id` aikataulu-välilehdellä `PlannerGantt`-komponentin tilalla, jotta sama Excel-tyylinen näkymä on käytössä molemmissa paikoissa.
- Lisätään palkin labeliin sama muotoilu kuin Excelissä: juoksuissa `<ikäluokka> (<erien määrä>) <min>/erä`, kentälajeissa `<ikäluokka> <laji>` ja oikealla puolella vihjeenä kokonaiskesto (esim. `40min`).
- Värikoodaus pysyy ikäryhmän mukaan (Excel-mukainen pastelli).
- Ikäryhmäosion rivijärjestys: T-sarjat ennen P-sarjoja, sitten N/M (sama `ageClassSort` kuin nyt).
- Kellonaika-akseli alkaa lähimmästä tasatunnista ennen päivän aikaikkunan alkua ja loppuu seuraavaan tasatuntiin lopun jälkeen (jo tehty Full-Ganttissa).

Vanha sarakkeittainen pysty-Gantt-toteutus (`PlannerGantt` funktio `planner.$planId.tsx` rivit ~1263–1509) poistetaan kun se on korvattu — yksi totuus, yksi näkymä.

### 3) "Vie Excel" → visuaalinen Excel YAG22-mallin mukaan

**Nykyinen ongelma:** Excel-vienti on pelkkä taulukkomuotoinen luettelo riveinä. Käyttäjä haluaa saman visuaalisen ruudukon kuin näytöllä.

**Toteutus uudella tiedostolla `src/lib/planner-schedule-xlsx.ts`:**
Käyttää `xlsx`-kirjastoa (jo asennettu). Per päivä uusi välilehti, nimi `<weekday>` (esim. `Lauantai`).

Layout per välilehti (vastaa YAG22-mallia):
- Rivi 1: `<plan name>`
- Rivi 2: päivän nimi
- Rivi 4 sarake A: `Suorituspaikkakohtainen aikataulu`
- Rivit 4–5: kellonajat (sarakkeet B+, yksi sarake = 5 min). Rivi 4 = tasatuntilabel kohdistettuna oikean sarakkeen yli, rivi 5 = `5/10/15/…/55`.
- Rivit 7 → n: yksi rivi per suorituspaikka. Sarakkeessa A suorituspaikan nimi.
- Tapahtumapalkki = soluyhdistys lähtöhetkestä loppuhetkeen (5 min raster), tausta = ikäluokan väri, soluteksti `<ikäluokka> <laji>` tai juoksuille `<ikäluokka> (<erät>) <min>/erä`. Reuna ohut musta.
- Tyhjä rivi väliin, sitten `Ikäryhmäkohtainen aikataulu` -otsikko samoilla aikasarakkeilla, rivit per ikäluokka.
- Sarakkeen A leveys ~22, sarakkeet B+ leveys ~3 (kapea ruutu = palkin tarkkuus).
- Rivikorkeus ~22.
- Konfliktipalkki: punainen reuna.

`downloadPlannerScheduleVisualXlsx({plan, venues, events, schedule, conflictIds})` korvaa nykyisen `exportExcel`-funktion `ScheduleTab`:ssa.

## Tekniset huomiot

- `xlsx`-kirjasto: värit ja soluyhdistykset toimivat `XLSX.utils.book_new()` + `ws['!merges']` + `cell.s = { fill, border, alignment }` kautta. Jos perusversion `xlsx` ei tue tyylejä, lisätään riippuvuus `xlsx-js-style` (saman APIn yhteensopiva fork) ennen toteutusta — tämä päätetään buildvaiheessa.
- Migraatio tehdään `supabase--migration`-työkalulla, ei suoraan SQL-tiedostoeditoinnilla.
- Edge case: jos päivän aikaikkuna puuttuu, näytetään sama opaste kuin nyt eikä luoda välilehteä siltä päivältä.

## Mitä EI tehdä

- Ei kosketa PDF-vientiä — se jo toimii tekstiluettelona pyydetysti.
- Ei muuteta solverin logiikkaa.
- Ei lisätä uusia kenttiä `plan_events`-tauluun.
