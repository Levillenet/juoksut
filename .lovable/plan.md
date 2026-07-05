## Tavoite
1. **Julkinen video sallitaan vain juoksulajeille** (event_category = 'Track' tai 'Relay'). Yksilölajeille (Field ym.) videolinkin voi tallentaa vain yksityisenä (esim. valmentaja itselleen).
2. **Juoksulajien video on eräkohtainen**, ei urheilijakohtainen. Yhdellä erällä yksi (tai useita) videoita, jotka näkyvät kaikille erän urheilijoille.
3. **Yksilölajeissa video on urheilijakohtainen** ja pakotetusti yksityinen.
4. **Etusivulla indikoidaan** selvästi (esim. punainen 🎥-merkki), millä juoksulajilla on julkinen video järjestelmässä.

## Tietokantamuutokset
Uusi migraatio `result_videos`-tauluun:
- Lisätään sarake `event_category text` (nullable aluksi, backfilloidaan `athlete_results`:n perusteella).
- Lisätään sarake `heat_key text` (nullable) — juoksulajien erätunniste (`<roundId>` tai `<roundId>|<heatIndex>`).
- Lisätään trigger `enforce_public_only_for_track`: `IF NEW.is_public AND coalesce(NEW.event_category,'') NOT IN ('Track','Relay') THEN RAISE EXCEPTION ...` — pakottaa yksilölajien videot yksityisiksi.
- RLS pysyy: julkinen luku sallii `is_public=true`; DB estää julkiseksi merkitsemisen kentän/hyppylajeille.
- Ei uusia GRANTeja — sarakemuutos vain.

## Lib-muutokset

### `src/lib/result-videos.ts`
- Lisää `event_category` ja `heat_key` `ResultVideo`-tyyppiin ja `insertResultVideo` / `updateResultVideo`-payloadeihin.
- `insertResultVideo` saa uudet parametrit `eventCategory: string`, `heatKey?: string | null`; jos `isPublic && !isTrackCategory(eventCategory)` → heitä virhe ennen tietokantaa (UX-tason ehkäisy).
- Uusi helper `isTrackCategory(c) = c === 'Track' || c === 'Relay'`.
- Uusi funktio `fetchHeatVideos(competitionId, heatKeys[])` → julkiset + omat videot annetuille erille (`.in('heat_key', keys)`).

### `src/lib/public-videos.ts`
- Ei muutoksia kyselyyn (julkiset videot ovat jo vain juoksulajien takia enforce-triggerillä).
- Filter: näytä vain `event_category IN ('Track','Relay')` varmuuden vuoksi.

## Komponenttimuutokset

### `src/components/ResultVideoButton.tsx`
- Uusi prop `eventCategory: string`.
- Jos `!isTrackCategory(eventCategory)`: piilota "Julkinen"-toggle sekä lisäys- että muokkauslomakkeista, pakota `isPublic = false`. Näytä pieni infoteksti "Yksilölajin video on aina yksityinen".
- Julkisten muiden käyttäjien videot näytetään vain track-lajeille (kentällä list on käytännössä aina tyhjä).
- Kun `heatKey` annetaan, tallenna se videoon ja käytä sitä pääasiallisena avaimena (`athlete_key` voi jäädä nykyiseksi jotta athlete-sivun listaus säilyy).

### `src/routes/watch.tsx`
- Erotellaan renderöinti event-categoryn mukaan:
  - **Track/Relay**: yksi videopainike per erä (ei per urheilija). Käytetään heat_keytä `${round.Id}|${heatIndex}`. Painike sijoitetaan erätiedon perään (esim. rivin oikean laidan alle) ja käyttää heat-videokyselyä.
  - **Field ym.**: nykyinen per-urheilija videopainike, mutta `eventCategory` propina niin että toggle piilotettu.
- Ei duplikoi useaa painiketta samaan erään: track-erien painike renderöidään vain silloin kun kyseinen erä ei ole vielä rendattu tässä urheilijalistassa (Set `renderedHeats`), tai — yksinkertaisemmin — painike jokaisen track-rivin kohdalla mutta jaettu (sama heat_key) → sama listaus.
- Käytännön kompromissi: pidetään painike per rivi, mutta se on **jaettu** (kaikilla saman erän urheilijoilla samat videot). Se toteuttaa "eräkohtaisuuden" datatasolla ja käyttäjä huomaa selkeästi että sama linkki jaettu.

### `src/routes/round.$eventId.$roundId.tsx`
- Sama logiikka: track → heat_key-pohjainen painike per erä, field → per urheilija (private only).

### `src/components/PublicVideosSection.tsx`
- Ei toiminnallista muutosta — dedup jo tehdään. Voi näyttää lisäksi "Erän tulokset" -linkin.

## Etusivun indikointi
- Uusi kevyt kysely `fetchPublicVideoIndex()` → palauttaa Set-muodossa avaimet `${competition_id}|${event_name}|${age_class}` niille, joilla on julkinen video (viimeisen 14 päivän ajalta, rajoitus 500).
- React Query: `["public-video-index"]`, `staleTime: 60_000`.
- `TodayStatsSection`, `DailyBestSection`, `ClubTodaySection`: jokaisen tulosrivin viereen renderöidään `<YoutubeBadge />` (pieni punainen Youtube-ikoni) kun avain löytyy indeksistä. Klikkaus vie ao. urheilijan sivulle (nykyinen linkki riittää).
- Toteutetaan uutena pikkukomponenttina `src/components/VideoAvailableBadge.tsx`.

## Ei muuteta
- Julkisten videoiden RLS-politiikkaa (jo OK).
- Athlete-sivun videot (näkyvät edelleen).
- Muita etusivun lohkoja.

## Vahvistus
1. Migraation jälkeen yritetään INSERT `is_public=true, event_category='Field'` → virhe.
2. INSERT `is_public=true, event_category='Track'` → onnistuu.
3. Playwright: `/watch` mobiilissa — juoksulajilla nappi näkyy, kentällä toggle piilotettu.
4. Etusivun `TodayStats`- ja `DailyBest`-riveille tulee punainen youtube-merkki niille juoksulajeille joilla on julkinen video.
