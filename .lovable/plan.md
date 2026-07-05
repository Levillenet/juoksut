## Tavoite

1. **Kilpailijaseurannassa** (`/watch`) jokaisen seurattavan urheilijan lajirivin viereen "Lisää suoritusvideo" ‑painike (YouTube-linkki + julkinen/yksityinen ‑valinta).
2. **Useita videoita per laji per käyttäjä** (esim. pituushypyn eri kokeet). Nykyinen taulun UNIQUE-rajoite estää tämän.
3. **Julkiset videot näkyvät kaikille** myös lajin/erän sivulla `/round/:eventId/:roundId` — pieni Video-nappi urheilijan rivillä avaa ne (ja kirjautunut voi lisätä oman videon sieltäkin).

## Muutokset

### A) DB-migraatio (`result_videos`)
- Pudota UNIQUE-rajoite `(user_id, athlete_key, competition_id, event_name, sub_category)` → yhdellä käyttäjällä voi olla useita videoita samalle (athlete, kilpailu, laji, alalaji) ‑yhdistelmälle.
- Ei muita skeemamuutoksia. RLS-käytännöt (julkinen SELECT + omat INSERT/UPDATE/DELETE) säilyvät.

### B) `src/lib/result-videos.ts`
- Muuta `upsertResultVideo` kahdeksi funktioksi:
  - `insertResultVideo({...})` — luo aina uuden rivin (ei onConflictia).
  - `updateResultVideo(id, {youtubeUrl, isPublic})` — päivittää olemassa olevan rivin id:llä.
- `deleteResultVideo(id)` säilyy.

### C) `src/components/ResultVideoButton.tsx`
- Poista "yksi oma video per slot" ‑oletus:
  - Näytä listassa **kaikki** omat videot (ei vain ensimmäinen) `VideoSection`-korteissa (muokattavat).
  - Alla kaikki muiden julkiset videot (ei-muokattavat, kuten nyt).
  - Alaosassa aina "Lisää uusi video" ‑lomake (`VideoForm`) — ei enää piiloteta kun oma video on olemassa.
- `VideoForm` käyttää `insertResultVideo`, `VideoSection`n editointi käyttää `updateResultVideo(video.id, …)`.
- Ulkoinen API (props) säilyy — kutsupaikkoihin ei tule breaking changea.

### D) `src/routes/watch.tsx`
- Lisää `videosQuery` (React Query) joka hakee `fetchVideosForAthlete` kaikille seurattaville urheilijoille (yksi kutsu per urheilija tai batch-in). Käytä avainta `["athlete-videos", key]` yhteensopivuudeksi nykyisen invalidoinnin kanssa.
- Jokaisen lajirivin lopussa (viimeisen `<div className="shrink-0 text-right">` ‑lohkon alle tai erillisenä action-rivinä) renderöi `<ResultVideoButton ... size="xs" />` — ilman ohjautumista `/round/...`-linkkiin klikattaessa (stopPropagation on jo napissa).
- `subCategory`-arvo: käytetään tyhjää merkkijonoa `""` (watch-sivulla tuloslista.fi ei anna vielä sub_category-arvoa). Tätä käytetään konsistenttina "watch-slot" ‑avaimena; athlete-tilastojen tarkat sub_categoryt tallentuvat omina riveinään ja näytetään erikseen omassa kontekstissaan.

### E) `src/routes/round.$eventId.$roundId.tsx`
- Hae kaikkien erän urheilijoiden julkiset (+ omat) videot yhdellä kyselyllä `result_videos`-taulusta suodattaen `competition_id` + `athlete_key IN (...)` + `event_name = round.EventName`.
- Kunkin allocation-rivin (urheilija) kohdalle lisää `<ResultVideoButton ... size="xs" />`. Nappi näkyy vain jos on julkisia videoita katsottavaksi TAI käyttäjä on kirjautunut ja voi lisätä oman.
- `subCategory=""` (sama kuin watch-sivulla), jotta watch-sivulla lisätty video näkyy täällä.

### F) Ei muutoksia
- `src/routes/athlete.$key.tsx` ja `src/components/AthleteAnalytics.tsx` toimivat jatkossakin — ResultVideoButton tukee edelleen useita omia videoita nyt kun sen sisällä on `insert` + `update` per rivi.
- RLS ja jakolinkit (`athlete_shares`, `watch_shares`) säilyvät ennallaan.

## Tekniset huomiot

- Migraatio: `ALTER TABLE public.result_videos DROP CONSTRAINT result_videos_user_id_athlete_key_competition_id_event_name_sub_category_key;` (todellinen nimi tarkistetaan; PostgreSQL nimeää UNIQUEn automaattisesti — käytetään DO-blockia joka löytää oikean nimen).
- Query invalidointi: `["athlete-videos", athleteKey]` on jo käytössä; watch- ja round-sivujen queryt käyttävät samaa avainta jotta lisäys/muokkaus päivittää kaikki näkymät.
- Painikkeen sijoitus watch-sivulla: uusi rivi `<Link>`-elementin ULKOPUOLELLA (nykyinen `<li>` sisältää yhden `<Link>`n koko rivin klikattavaksi). Rakenne muutetaan: `<li>`n sisällä `<Link>` + erillinen action-rivi napeille.

## Muutetut/uudet tiedostot
- **Migraatio**: `supabase/migrations/<uusi>.sql` — DROP UNIQUE.
- **Muokattu**: `src/lib/result-videos.ts`, `src/components/ResultVideoButton.tsx`, `src/routes/watch.tsx`, `src/routes/round.$eventId.$roundId.tsx`.
