## Ongelma

- Etusivun `PublicVideosSection` on sivun alalaidassa alle muiden lohkojen; käyttäjät eivät löydä sitä.
- 48 h ikkuna on liian tiukka — pitäisi olla yleinen videoarkisto, jota voi selata päivämäärän ja kilpailun mukaan.
- Seuran urheilijat -listalla näkyy pieni punainen YouTube-merkki, mutta se ei ole klikattava — käyttäjä ei pääse videoon urheilijan riviltä.

## Ratkaisu

Kolme kohtaa: uusi videosivu, nostaminen päävalikkoon, klikattava videolinkki seura-riviin.

### 1. Uusi `/videot`-reitti (videoarkisto)

`src/routes/videot.tsx`:
- Hakee julkiset videot viimeisiltä 30 päivältä.
- Filtterit yläpalkissa:
  - **Päivämäärävalitsin** (default: tänään; vaihdettaessa suodattaa `competition_date`- tai `created_at`-mukaan).
  - **Kilpailu-dropdown** — täytetään dynaamisesti tuoduista videoista.
  - **Vapaa haku** lajille tai nimelle.
- Grid `sm:grid-cols-2 lg:grid-cols-3` — jokainen kortti näyttää lajin, ikäluokan, urheilijan/erän, kilpailun, päivämäärän, YouTube-thumbnailin.
- Klikkaus avaa dialogin, jossa videon iframe-upotus.
- `head()`: title "Päivän juoksuvideot", meta-kuvaus.

### 2. Kortti "Päivän videot" päävalikkoon (NavCards)

`src/routes/index.tsx`:
- Lisää `NavCards`-komponenttiin punaisen sävyinen kortti "🎬 Päivän videot" → `/videot`, näkyy kaikille rooleille (`!isOfficial` && role !== "official-only") — sijoita `Hae nimellä` -kortin viereen (ensimmäisiin).
- **Poista** `<PublicVideosSection />` alalaidan rungosta (koko komponentti jää tiedostona olemassa; refactor: käytännössä uusi `/videot`-sivu korvaa sen). Vaihtoehtoisesti poistetaan komponenttitiedosto — tehdään poisto jotta ei jää kuollutta koodia.

### 3. Klikattava YouTube-merkki `ClubTodaySection`iin

- Uusi kevyt komponentti `src/components/PublicVideoLinkButton.tsx`:
  - Prop: `competitionId`, `eventName`, `contextLabel`.
  - Näyttää saman punaisen YouTube-badgen (nappina).
  - Klikkaus → dialogi, joka:
    - Kutsuu uutta helperia `fetchPublicVideosForEvent(competitionId, eventName)` (haetaan kaikki julkiset videot ko. lajille, järjestys uusin ensin).
    - Yksi video → suora iframe-upotus otsikolla.
    - Useampi video → lista jossa jokainen avautuu upotukseksi (accordion tai peräkkäin).
- Korvaa `<VideoAvailableBadge />` `<PublicVideoLinkButton />`-kutsulla `ClubTodaySection`in urheilijarivillä.
- Sama komponentti voidaan käyttää myöhemmin muilla listoilla (`TodayStatsSection`, `DailyBestSection`) — ei tehdä muutosta niihin tässä muutoksessa (pysytään pyynnön skoopissa).

### 4. Uusi helper

`src/lib/public-videos.ts`:
- `fetchPublicVideosForEvent(competitionId, eventName)` → hakee `result_videos` missä `is_public = true`, `competition_id = ?`, `event_name = ?`. Liitä athlete_results-tiedot (erä-labelia / nimeä varten).
- `fetchPublicVideosRange(sinceIso)` yleinen listaus (30 pv default) käytettäväksi /videot-sivulla.

## Verifiointi

- Playwright: `/videot` renderöityy, filtterit toimivat, tyhjä tila näytetään kun päivälle ei ole videoita.
- Etusivun päävalikossa uusi "Päivän videot" -kortti ja `PublicVideosSection` on poistettu alalaidasta.
- ClubTodaySection: julkisen videon urheilijarivillä nappi klikattava → dialogi avautuu ja video pyörii.
