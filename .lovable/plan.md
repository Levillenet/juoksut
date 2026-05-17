## Ongelma

Live-näkymässä (kuuluttaja, scoreboard, NewResultOverlay) tulos merkitään PB:ksi aina kun lähdedata (tuloslista) ei sisällä urheilijalle PB- eikä SB-arvoa. Tämä on yleistä nuorilla. `detectRecord` `src/lib/records.tsx`:ssä palauttaa silloin aina `"PB"`, vaikka urheilijalla on jo aiemmista kilpailuista parempia tuloksia samassa lajissa (mahdollisesti eri ikäluokassa, esim. T10 → T11 pituus).

Tavoitetila: PB-vertailun pohjana käytetään urheilijan **koko historian paras tulos samassa normalisoidussa lajissa**, ikäluokasta riippumatta. Jos historiasta ei löydy mitään, tulosta ei merkitä PB:ksi ennen kuin samassa kilpailussa tulee parempi tulos (eli aidosti ensimmäinen tulos lajissa ei saa tähteä).

## Toteutus

### 1. Poistetaan virheellinen "tyhjä = PB" -fallback

`src/lib/records.tsx` → `detectRecord`: poistetaan `if (p == null && s == null) return "PB"`. PB/SB merkitään vain kun on jokin pohja, jota vastaan verrata.

### 2. Historiapohjainen PB-baseline samaan kilpailuun

Lisätään uusi moduuli `src/lib/history-baseline.ts`, joka tarjoaa cache-pohjaisen lookupin (`athlete_key + normalizedEvent → best historical result_text`):

- `loadHistoryBaselineForCompetition(competitionId)`: hakee `athlete_results`-taulusta yhdellä kyselyllä kaikki rivit, joilla on `competition_id` = nykyinen kilpailu, ja niiden pohjalta listan kilpailun urheilijoista (`athlete_key`-joukko). Toisella kyselyllä haetaan kaikki samojen `athlete_key`ien aiemmat tulokset (`competition_id <> nykyinen`, `result_numeric IS NOT NULL`). Rivit ryhmitellään `athleteKey | normalizeEventName(event_name)` -avaimella ja jokaisesta valitaan paras `lowerBetter`-säännön mukaisesti (`isLowerBetter` löytyy `athlete-history.ts`:stä). Tulos: `Map<string, { resultText: string; resultNumeric: number }>` muistissa.
- `getHistoricalBest(athleteKey, eventName, category, subCategory) → string | null` palauttaa cachatun parhaan tuloksen tekstinä (jota detectRecord parsii).
- Cache invalidoituu kilpailun vaihtuessa.

### 3. Liitetään baseline `effectiveRecord`-polkuun

`src/lib/record-baseline.ts` → `effectiveRecord`:
- Lisätään parametriksi `athleteKey?: string` ja `eventName?: string`, `category?: string`, `subCategory?: string`.
- Päättelyjärjestys PB:lle: `record_baseline.pb` (jo otettu kilpailun alussa) → `alloc.PB` (lähdedatan PB) → `getHistoricalBest(...)` (oma historia). Sama logiikka SB:lle (vain `record_baseline.sb` → `alloc.SB`; historiaa ei käytetä SB:lle koska se on kausikohtainen ja vaatisi erillisen rajauksen — voidaan jättää myöhempään).

### 4. Kutsupaikkojen päivitys

Kaikki `effectiveRecord`-kutsut saavat lisäparametrit. Allokaatiossa nimi/seura ovat valmiina, joten `athleteKey = \`${a.Surname}|${a.Firstname}|${a.Organization?.Id ?? ""}\`` lasketaan paikallisesti (vastaa harvest-puolen `athleteKey`-funktiota — pieni utility `src/lib/athlete-key.ts` jota molemmat käyttävät).

Päivitettävät tiedostot:
- `src/hooks/useAnnouncerData.ts` (rivi 191)
- `src/routes/scoreboard.tsx` (rivi 512)
- `src/components/announcer/shared.tsx` (rivit 245, 389)
- `src/components/announcer/NewResultOverlay.tsx` (rivi 86)

### 5. Baseline-lataus kilpailun yhteydessä

`useAnnouncerData`:ssa (ja `scoreboard.tsx`:ssä) lisätään `useEffect`, joka kutsuu `loadHistoryBaselineForCompetition(competitionId)` kun kilpailu vaihtuu. Kun lataus on valmis, `effectiveRecord`-kutsut hyödyntävät cachea automaattisesti.

## Tekniset tiedostot

- `src/lib/records.tsx` — poistetaan tyhjä-PB-fallback.
- `src/lib/history-baseline.ts` — uusi: cache + Supabase-haku + lookup.
- `src/lib/record-baseline.ts` — `effectiveRecord` huomioi historiapohjaisen PB:n.
- `src/lib/athlete-key.ts` — uusi pieni jaettu utility (sama formaatti kuin harvesterissa).
- `src/hooks/useAnnouncerData.ts`, `src/routes/scoreboard.tsx`, `src/components/announcer/{shared,NewResultOverlay}.tsx` — kutsupaikkojen päivitys + baseline-lataus.

## Mitä EI muuteta

- Urheilijakortin PB-listaa (`groupByEvent`) ei kosketa — se käyttää jo `ageClassRank`-suodatusta korkeimpaan ikäluokkaan.
- `was_pb`-kenttää tai SQL-puolen `mark_pbs_for_competitions`-funktiota ei muuteta.
- SB-laskentaan ei lisätä historia-fallbackia tässä vaiheessa (vaatisi kauden rajauksen).
