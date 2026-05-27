## Tavoite

Kun seurattu urheilija saa eräjaon kilpailussa, urheilijan rata- ja erätieto näkyy aikataulussa lähes heti, ja muutoksesta ilmoitetaan käyttäjälle.

## Muutokset

### 1. Nopeampi tausta-päivitys aikataululle

`src/lib/tuloslista-queries.ts` — `competitionIndexQueryOptions`:
- `refetchInterval`: **60 s → 20 s** (aiemmin liian harva, koska tällä haetaan kaikkien lajien event-detaljit)
- `staleTime`: 30 s → 10 s, jotta `router.invalidate()` ja palaaminen sivulle ei käytä vanhaa cachea
- `refetchIntervalInBackground`: jätetään pois (vältetään turhaa kuormitusta, jos välilehti taustalla)

Vaikutus: heti kun erät jaetaan, /watch, /seuraa ja /print/watched näyttävät "Eräjako tekemättä" → "Erä N · Rata M" enintään 20 s viiveellä.

### 2. Ilmoitus eräjaosta seuratulle urheilijalle

Uusi hook `src/hooks/useWatchedAllocationChanges.ts`:
- Pitää `useRef`-mapissa per (urheilija, round.Id) edellisen tilan: `enrollment` tai `allocated`.
- Initialisoi ensimmäisellä havainnolla hiljaa (ettei vanha enrollment laukaise heti viestiä).
- Kun tila muuttuu `enrollment → allocated` (= `fromEnrollment: true` → `false`), kutsuu `pushTickerMessage`:
  ```
  "{Etunimi Sukunimi} sai eräjaon lajissa {EventName}: Erä N · Rata M"
  ```
- Jos round on Field-laji, muoto: "… Järj. M" (jos Position annettu) tai pelkkä "… eräjako tehty".
- `source: "watched"`, `eventId`/`eventName` ticker-kontekstiin (klikkaus avaa erän).

Hookin käyttö:
- `src/routes/watch.tsx`: lisätään `useWatchedAllocationChanges(index, watched)` samaan kohtaan kuin nykyinen `useWatchedFieldChanges`.
- Pääsivulla (`src/routes/index.tsx`) ei ole tällä hetkellä `index`-dataa käytössä; ei lisätä erikseen, koska viesti tulee `LiveTicker`-virtaan joka on globaali ja näkyy joka tapauksessa kun käyttäjä on /watch-sivulla.

### 3. (Pieni siivous) — varmistetaan että ticker-viesti näkyy myös toastissa

Tarkistetaan että `pushTickerMessage` source: "watched" -viestit näytetään `sonner`-toastilla (`toast.success` tms.), kuten muutkin watched-tapahtumat. Jos jo tehty, ei muutoksia; jos ei, lisätään `ticker-store.ts`:ään sonner-kutsu watched-lähteelle.

## Mitä ei muuteta

- `competitionScheduleQueryOptions` (announcer-näkymä) — sillä on jo 15 s refetch.
- Enrollment-synteettisten rivien generointi: pidetään ennallaan, vaihtuu automaattisesti oikeisiin alloceihin kun event-detail palauttaa heat-allocationsit.
- Field-lajien sija/tulos-ilmoitukset (`useWatchedFieldChanges`) — pysyvät erillisinä.

## Tekninen yhteenveto

| Tiedosto | Muutos |
|---|---|
| `src/lib/tuloslista-queries.ts` | `refetchInterval: 20_000`, `staleTime: 10_000` |
| `src/hooks/useWatchedAllocationChanges.ts` | **uusi** — havaitsee enrollment→allocation -siirtymän, lähettää ticker-viestin |
| `src/routes/watch.tsx` | kutsutaan uutta hookia |
| `src/lib/ticker-store.ts` *(tarpeen mukaan)* | varmistetaan sonner-toast watched-viesteille |
