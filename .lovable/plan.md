
# Lajien keston ennustusmalli

Rakennetaan datapohjainen kestoennuste plannerille `athlete_results.captured_at` -aikaleimoista. Eteneminen vaiheittain — vahvistus pyydetään ennen jokaista vaihetta.

## Huomiot ennen aloitusta

- **`age_class` on jo erillisenä sarakkeena** `athlete_results`-taulussa, joten ei tarvitse parsia event_namesta. Käytetään sitä suoraan `group_name`-arvona.
- **Olemassa on jo `event_duration_overrides`-taulu** (manuaaliset overridet) ja `get_competition_structure` / `list_planner_template_competitions` -funktiot, jotka tekevät vastaavaa per-kisa-tilastointia. Uusi `event_duration_stats` on globaali aggregaatti — täydentää, ei korvaa, näitä.
- **Edge Function vs server function**: Pyydetty Edge Function — käytetään sitä, koska laskenta on raskas ja halutaan ajaa erillään käyttäjän pyynnöstä. (Tämän projektin oletus olisi TanStack `createServerFn`, mutta Edge Function toimii tähän hyvin ja eristää workerin kuormituksen.)
- **Track-laji "erien määrä"**: `athlete_results`-datassa ei ole eräkohtaista tietoa. Skaalataan osallistujamäärällä ja oletetaan 8/erä (säädettävissä). Tämä on rajoitus jonka mainitsen koodissa kommentilla.

## VAIHE 1 — Tietokantataulu `event_duration_stats`

Migraatio luo taulun:

| sarake | tyyppi |
|---|---|
| id | uuid PK |
| event_name | text |
| group_name | text (= age_class) |
| category | text ('Track' / 'Field') |
| sub_category | text |
| n_samples | integer |
| median_duration_min | real |
| p90_duration_min | real |
| median_participants | real |
| max_participants | integer |
| last_updated | timestamptz default now() |

- UNIQUE(event_name, group_name)
- Indeksi (event_name, group_name) hakua varten
- RLS: SELECT authenticated, kaikki muutokset vain service_role (Edge Function käyttää service rolea)
- GRANT SELECT authenticated, GRANT ALL service_role

**Vahvistus pyydetään ennen migraation ajamista.**

## VAIHE 2 — Edge Function `compute-duration-stats`

`supabase/functions/compute-duration-stats/index.ts`:

1. Auth-check: vain admin (`is_admin_user()` tai email-tarkistus tokenista).
2. Iteroi `athlete_results` paginointina (esim. 10k riviä kerrallaan) lukien vain tarvittavat sarakkeet: `competition_id, event_id, event_name, age_class, sub_category, event_category, captured_at, athlete_key`.
3. Muistissa aggregointi (Map):
   - **Per (competition_id, event_id)**: min/max `captured_at`, distinct athlete_keys → kesto + osallistujamäärä.
   - Suodatus: kesto 1–600 min, vähintään 2 osallistujaa (yksin = ei keston mittausta).
4. Aggregointi uudelleen **per (event_name, age_class)** → kerää kestot ja osallistujamäärät arrayhin → laske n, mediaani, p90, mediaani-osallistujat, max-osallistujat. category johdetaan `event_category`-sarakkeesta.
5. Upsert `event_duration_stats`-tauluun (UNIQUE event_name+group_name).
6. Palauta JSON: `{ rows_processed, runs_aggregated, stats_upserted, duration_ms }`.

`supabase/config.toml`: `verify_jwt = true` jotta admin-tarkistus toimii kutsujan tokenilla.

## VAIHE 3 — Admin-näkymä `/admin/duration-stats`

Uusi route `src/routes/_authenticated/admin.duration-stats.tsx` (tai vastaava nykyisten admin-routejen sijaintien mukaan):

- Pääsy: `is_admin_user()` (sama kuin muissa admin-näkymissä).
- "Päivitä kestolaskelmat" -nappi → kutsuu Edge Functionia (mutation + toast tuloksesta + spinner).
- Taulukko (React Query, `event_duration_stats` -taulusta):
  - Sarakkeet: Laji, Sarja, n, Mediaani (min), P90 (min), Mediaani-osallistujat, Päivitetty.
  - Oletussorttaus n_samples desc.
  - Hakukenttä joka suodattaa client-sidena event_name TAI group_name.
- Linkki nykyiseen `/admin`-hubiin.

## VAIHE 4 — `src/lib/planner-estimate.ts` -päivitys

- Uusi hook / fetch: `useEventDurationStats()` React Querylla, `staleTime: 60 * 60 * 1000`.
- `estimateEventDuration(event_name, group_name, participantsOrHeats)`:
  - Haku `(event_name, group_name)` → jos löytyy: palauta `{ minutes, confidence, source: 'data' }`.
  - **Track**: `minutes = median_duration_min * (heats / median_heats)`. Erien määrä = `ceil(participants / 8)`, mediaani-erät = `ceil(median_participants / 8)`.
  - **Field**: `minutes = median_duration_min * (participants / median_participants)`.
  - Jos ei löydy: nykyinen fallback (override → sääntö) ja `source: 'fallback'`, `confidence: 0`.
  - `confidence` = `min(1, n_samples / 10)` (0…1).
- Tyypit päivitetään `EventEstimate`-rajapintaan.
- Olemassa olevat kutsupaikat (`planner-solver.ts`, planner-näkymät) saavat uuden kentät, mutta vanhat numeeriset kutsupaikat toimivat ilman muutoksia (lisätään apufunktio).

## VAIHE 5 — Plannerin "Lajit"-välilehti

Tiedosto: `src/routes/planner.$planId.tsx` (Lajit-välilehden komponentti) tai eriytetty `PlannerEventsTab`.

- Jokaiselle lajiriville:
  - Näytä kestoarvio minuutteina kolumnissa.
  - Badge:
    - `n_samples >= 5` → `<Badge variant="default">datapohjainen · {n} näytettä</Badge>`
    - `n_samples 1–4` → `<Badge variant="secondary">vähän dataa · {n}</Badge>`
    - ei löydy → `<Badge variant="outline">oletus</Badge>`
  - Tooltip (shadcn `Tooltip`) hover/focus: mediaani, P90, n_samples, mediaani-osallistujat. Fallback-tilassa tooltip selittää että käytetään sääntöä.

## Teknistä

- Migraatio: `event_duration_stats` taulu + indeksit + RLS + GRANTit yhtenä SQL-migraationa.
- Edge Function käyttää `supabaseAdmin`-clientiä (service role), kutsujan JWT validoidaan admin-roolin tarkistukseen.
- Frontti käyttää `supabase`-browser-clientiä `event_duration_stats`-hakuihin (SELECT-policy sallii authenticated).
- Ei muutoksia `athlete_results`-tauluun.
- Ei muutoksia nykyiseen `planner-solver.ts`-logiikkaan paitsi että se saa parempia kestoarvioita `planner-estimate.ts`-rajapinnan kautta.

## Rajaukset (mitä EI tehdä tässä)

- Ei opi konfliktisääntöjä (heittolajit, toimitsijaresurssit) — se on eri vaihe.
- Ei taustaajoa cron-jobina — vain manuaalinen admin-nappi tässä vaiheessa.
- Ei korvaa `event_duration_overrides`-taulun manuaalisia arvoja; overridet jäävät prioriteetiltaan ylimmäksi.
- Ei muuta Excel-vientiä eikä Gantt-näkymää.

---

**Aloitan VAIHEESTA 1** kun annat luvan: luon `event_duration_stats`-taulun migraationa.
