# Analytiikka-välilehti ja tulosvideot

## Osa 1 — Lajikohtainen tuloskehitys urheilijasivulla

Lisätään `athlete.$key.tsx` -sivulle uusi "Analytiikka"-välilehti nykyisten rinnalle.

### Toiminnot
- Lajivalitsin (Select) listaa urheilijan kaikki lajit (event_pb_key mukaan ryhmiteltynä) uusimman esiintymän mukaan järjestettynä. Oletuksena valittuna eniten tuloksia sisältävä laji.
- Recharts-viivakaavio (`LineChart` + `Line` + `ReferenceLine` PB:lle):
  - x-akseli = kilpailupäivä (aikajana)
  - y-akseli = tulos oikein skaalattuna (juoksut sekunteina — pienempi ylös, kentät metreinä — suurempi ylös)
  - piste per tulos, PB-piste korostettu
  - hover-tooltip: kilpailun nimi, päivä, sija, tuuli, tulos
- Klikatessa pistettä avautuu paneeli / drawer, jossa:
  - Kilpailun nimi + päivä + sija
  - Linkki kilpailun kierrosnäkymään (`/round/...`) jos event_id on
  - Kaikki kolme muistiinpanotasoa tälle tulokselle (tulos-, kilpailu-, lajitason nykyisen `athlete-notes.ts`-logiikan mukaisesti)
  - Mahdollisen tulosvideon upotus (ks. Osa 2)

### Tekniset yksityiskohdat
- Uusi komponentti `src/components/AthleteAnalytics.tsx`
- Data haetaan olemassa olevasta `athlete_results`-datasta, joka on jo sivulla ladattuna → ei uutta serverfn:ää
- Lajilistan ryhmittely `event_pb_key`-vastineella clientillä (`getEventPbKey` `src/lib/event-name.ts`-apurin kautta)
- Recharts on jo asennettu (käytössä toisaalla). Jos ei ole, `bun add recharts`
- Välilehti lisätään olemassa olevaan Tabs-rakenteeseen athlete-sivulla

## Osa 2 — YouTube-tulosvideot

### Tietokanta (uusi migraatio)
Uusi taulu `public.result_videos`:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null` (lisääjä)
- `athlete_key text not null`
- `competition_id integer` (nullable)
- `event_name text`
- `sub_category text`
- `result_id uuid` (viittaus `athlete_results.id`, nullable — tulos voi vaihtua uudelleenharvestissa)
- `youtube_url text not null`
- `youtube_video_id text not null` (parseerattu clientillä ennen insertointia)
- `is_public boolean not null default false`
- `created_at timestamptz default now()`, `updated_at timestamptz default now()`
- Unique: `(user_id, athlete_key, competition_id, event_name, sub_category)`

GRANTit: `SELECT/INSERT/UPDATE/DELETE authenticated`, `ALL service_role`, `SELECT anon` (julkisten videoiden jakolinkkejä varten).

RLS-policies:
- SELECT: `is_public = true OR user_id = auth.uid()`
- INSERT/UPDATE/DELETE: `user_id = auth.uid()`

### UI
- Tulosrivillä (nykyisissä listoissa athlete-sivulla ja watch-näkymässä) uusi pieni palkintopalli-ikonipainike (Trophy/Youtube ikonimix, Lucide `Trophy`).
- Painike näkyy:
  - aina kirjautuneelle käyttäjälle (voi lisätä)
  - kaikille, jos videolle löytyy `is_public = true` (voi katsoa)
- Klikkaus avaa Dialogin:
  - Jos video on tallennettu: näytetään upotettu YouTube-iframe + Muokkaa/Poista + julkisuustoggle (jos oma)
  - Jos ei: lomake YouTube-URLin liittämiseen + Switch "Näytä julkisesti"
- URL-parseri hyväksyy `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`. Invalidi → virheilmoitus.
- Analytiikka-drawerissa sama upotus jos videolle löytyy match.

### Tekniset yksityiskohdat
- Uusi `src/lib/result-videos.functions.ts` (createServerFn + requireSupabaseAuth): `getResultVideo`, `upsertResultVideo`, `deleteResultVideo`, `listResultVideosForAthlete`
- Julkisten videoiden luku analytics-graafiin: lataa lista athlete_keyn kaikista match-videoista (isolla urheilijalla enintään kymmeniä rivejä)
- Komponentti `src/components/ResultVideoButton.tsx` — nappi + Dialog + upotus
- Integrointi olemassa oleville tuloslistoille athlete-sivulla ja watch-näkymässä (ei kaikkiin listauksiin — vain seuratuille/omissa profiilinäkymissä)

## Osa 3 — Rajaukset
- Ei kosketa nykyisiin PB-korjauksiin, muistiinpanojen jakoihin tai auth-flowhun
- Analytiikka on read-only olemassa olevasta datasta
- Video ei näy jakolinkeissä (`/seuraa/`, `/urheilija/`) vielä — voidaan lisätä myöhemmin `get_shared_*`-RPC:iden kautta

Vahvista niin toteutan.
