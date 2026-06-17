## Tavoite

Lisätään suunnittelijaan uusi asetus **"Pakota saman lajin sarjat peräkkäin"**, jolla esim. kaikki 60 m -juoksut sijoittuvat yhteen blokkiin ennen kuin solveri etenee seuraavaan matkaan. Aloitetaan kevyimmästä toteutuksesta (sort-järjestyksen muutos), ja jätetään vahva lukko-mekanismi seuraavaan vaiheeseen jos sort yksinään ei riitä.

## Muutokset

### 1. Tietokanta (migraatio)
`competition_plans`-tauluun uusi kenttä:
```sql
ALTER TABLE public.competition_plans
ADD COLUMN group_same_event_consecutively boolean NOT NULL DEFAULT false;
```

### 2. Tyypit
- `src/integrations/supabase/types.ts` päivittyy automaattisesti migraation myötä.
- `src/lib/planner-types.ts`:
  - `PlanRow`: `group_same_event_consecutively: boolean`
  - `SolverInput`: `groupSameEventConsecutively?: boolean`

### 3. UI — `src/routes/planner.$planId.tsx`
- Lisätään `form.groupSameEvent` lukuun/tallennukseen (rivit 320, 344).
- Lisätään checkbox heti "Salli matkanvaihto"-asetuksen viereen (rivi ~576):
  - Otsikko: **"Pakota saman lajin sarjat peräkkäin"**
  - Aputeksti: "Esim. kaikki 60 m -juoksut ajetaan blokkina ennen kuin siirrytään seuraavaan matkaan. Vähentää aitojen ja telineiden siirtelyä."
- Välitetään arvo solverille (rivi ~1599): `groupSameEventConsecutively: plan.group_same_event_consecutively`.

### 4. Solver — `src/lib/planner-solver.ts`
Yksinkertainen muutos: kun `groupSameEventConsecutively` on `true`, käytetään `groupKey`-vertailua **ennen** matkavertailua (`segDistance`) sort-järjestyksessä (rivit 233–247):

```ts
segments.sort((a, b) => {
  if (a.eventId === b.eventId) return phaseOrder(a.phase) - phaseOrder(b.phase);
  const ba = segBucket(a);
  const bb = segBucket(b);
  if (ba !== bb) return ba - bb;

  if (groupSameEventConsecutively && a.groupKey !== b.groupKey) {
    return a.groupKey.localeCompare(b.groupKey);
  }

  const da = segDistance(a);
  const db = segDistance(b);
  if (da !== db) return da - db;
  if (a.groupKey !== b.groupKey) return a.groupKey.localeCompare(b.groupKey);
  return b.durationMin * b.needsStations - a.durationMin * a.needsStations;
});
```

Olemassa olevaa `candidateStart`-mekanismia ei muuteta — se hakee jo varhaisimman vapautumisajan. Solverin muihin sääntöihin ei kosketa.

### 5. Jatkovaiheet (ei tehdä nyt)
Jos pelkkä sort-muutos ei tuota tarpeeksi tiukkaa blokkaamista (eri matkoja lipsahtaa väliin eri suorituspaikoilta), lisätään seuraavassa kierroksessa:
- groupKey-blokkien aikajaksojen varaaminen ennakkoon
- saman venue-tyypin (track_oval / track_straight) lukitus blokin ajaksi

Tämä todennetaan ajamalla planner-generointi kopiolla ja katsomalla aikajana.

## Mitä EI tehdä
- Ei per-laji-asetusta (`plan_events.consecutive_with_group`) — vain kisatason kytkin.
- Ei muutoksia muihin solverin sääntöihin (toimitsijat, konfliktit jne.).
- Ei luoda `suunnittelijan_ohje.md`-tiedostoa (sitä ei ole projektissa); voidaan lisätä erikseen jos pyydetään.
