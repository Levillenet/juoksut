## Tavoite
Etusivulle uusi lohko **"Päivän videot"**, joka listaa järjestelmään lisätyt **julkiset** YouTube-suoritusvideot (is_public = true). Kokoaa suoritukset, joissa on julkinen video, ja näyttää ne kompaktisti.

## Kysely
Uusi tiedosto `src/lib/public-videos.ts`:
- Hakee `result_videos`-taulusta rivit `is_public = true`, järjestettynä `created_at desc`, rajoitus 20.
- Rikastaa jokaisen videon vastaavalla urheilijalla + tuloksella hakemalla `athlete_results`:sta `athlete_key + competition_id + event_name` (+ `sub_category` jos annettu). Otetaan uusin (`captured_at desc`) match.
- Palauttaa: `{ id, youtube_video_id, youtube_url, created_at, athlete_key, surname, firstname, organization, event_name, age_class, result_text, result_rank, competition_name, competition_date, competition_id }`.
- Käyttää selainpuolen `supabase`-clientia (julkinen anon-luku sallittu politiikalla).

## Uusi komponentti
`src/components/PublicVideosSection.tsx`:
- React Query key `["public-videos"]`, `staleTime: 60_000`.
- Otsikko "Päivän videot" + pieni kuvake (Youtube).
- Jos ei videoita: näytä lyhyt ohje ("Ei vielä julkisia suoritusvideoita — lisää omat urheilijaseurannassa ja aseta julkiseksi.").
- Muutoin: vaakasuunnassa vieritettävä lista korteista (mobiili) / grid `sm:grid-cols-2 lg:grid-cols-3` (desktop).
  - Kortti: YouTube-thumbnail (`https://i.ytimg.com/vi/{id}/mqdefault.jpg`) 16:9, päällä Play-ikoni.
  - Alle: `Sukunimi Etunimi` · `Seura`, sitten `event_name age_class` ja tulos + sija.
  - Kortin klikkaus avaa `Dialog`in jossa iframe-embed (samat asetukset kuin `ResultVideoButton`).
- Filtteröi pois duplikaatit samasta (athlete_key, competition_id, event_name, sub_category) — näyttää uusimman videon per suoritus.
- Näytetään vain videot, joiden `created_at` on **viimeisen 48 h sisällä** (matchaa "päivän" luonteen ja pysyy tuoreena myös illan puolella eri aikavyöhykkeissä).

## Sijoitus etusivulla
`src/routes/index.tsx`, rivi ~419: uusi `<PublicVideosSection />` `LiveCompetitionsSection`in ja `SeasonStatsSection`in väliin. Näytetään vain kun `!isOfficial` (kuten muut päivän lohkot).

## Ei tehdä
- Ei tietokantamuutoksia (RLS sallii jo julkisen luvun).
- Ei muuteta olemassa olevaa `ResultVideoButton`- tai `watch`/`round`-logiikkaa.
- Ei kirjautumisvaatimusta — kaikki näkevät julkiset videot.

## Vahvistus
Playwright-ajolla `/`-sivulle, otetaan kuvakaappaus ja todetaan että "Päivän videot" -lohko näkyy ja renderöi vähintään yhden thumbnailin (kun tietokannassa on julkinen video viimeisen 48 h ajalta).
