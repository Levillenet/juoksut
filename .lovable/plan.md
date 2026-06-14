## Ongelma

PB-laskenta ei huomioi lajin spesifikaatiota:
- **Aidat**: aidan korkeus ja lukumäärä vaihtelevat sarjasta toiseen (esim. T11 vs T13 60 m aidat)
- **Heitot (kuula, kiekko, keihäs, moukari)**: välineen paino vaihtelee sarjoittain (esim. P15 kuula 4 kg vs M kuula 7,26 kg)

Nuoremmassa sarjassa kevyemmällä välineellä tehty heitto ei saa olla PB vanhemmassa sarjassa, eikä toisinpäin. Sama koskee aitoja.

Nyt PB lasketaan pelkän normalisoidun lajinimen perusteella sekä `athlete-history.ts:groupByEvent`, `history-baseline.ts`, `today-stats.ts`, `club-today.ts`, `season-leaders.ts` ja Supabase-funktion `mark_pbs_for_competitions` osalta.

## Ratkaisu

### 1) Spesifikaatiotaulukot

Uusi `src/lib/event-specs.ts` joka kattaa:

**Aidat** (SUL nuorten kilpailusäännöt) — per sarja (sukupuoli + ikä) + matka:
- T/P 9–17: 60 m / 80 m / 100 m / 110 m / 300 m aidat → korkeus (cm) + aitojen lukumäärä
- T19/T22/N: 100 m aidat 84 cm, 400 m aidat 76,2 cm
- P19/P22/M: 110 m aidat 99,1/106,7 cm, 400 m aidat 91,4 cm
- Veteraanisarjat M/N 35+ matalammat

**Heitot** (kuula, kiekko, keihäs, moukari) — per sarja:
- Kuula: T9–T11 2 kg, T12–T13 3 kg, T14–T15 3 kg, T16–T17 3 kg, N19+ 4 kg; P9–P11 2 kg, P12–P13 3 kg, P14–P15 4 kg, P16–P17 5 kg, P19 6 kg, M22 7,26 kg
- Kiekko: T9–T13 600 g, T14–T17 1 kg, N+ 1 kg; P-sarjat porrastettu 600 g → 2 kg → M 2 kg
- Keihäs: T13–T15 400 g, T16–T17 500 g, N+ 600 g; P13–P15 500 g, P16–P17 600 g, P19+ 700 g, M 800 g
- Moukari: vastaava porrastus 3–7,26 kg

Funktiot:
- `getEventSpec(ageClass, gender, eventName) → { kind: "hurdles"|"throw", ...details } | null`
- `eventSpecKey(ageClass, gender, eventName) → string | null` (esim. `"H-60-50-8"`, `"T-shot-3000"`)
- Fallback: jos sarja puuttuu taulukosta, käytä `age_class`-merkkijonoa, jotta ennätykset eivät vuoda sarjojen yli.

### 2) Yleinen PB-avain

Uusi `src/lib/pb-key.ts`:
```ts
export function pbEventKey(row): string
```
- Aidat/heitot: `${normalizeEventName}|${eventSpecKey ?? age_class}`
- Muut: `normalizeEventName(event_name)`

### 3) Käyttö lukukerroksessa

Päivitä PB-avain näissä:
- `src/lib/athlete-history.ts` `groupByEvent` — ryhmittelyavain + näyttönimi sisältää speksin (esim. "Kuula (4 kg)", "60 m aidat (60 cm)")
- `src/lib/history-baseline.ts` — `lookupKey`/`buildBaselineMap` ottaa `age_class` mukaan; lisää `age_class` `fetchHistoryForKeys`/`get_shared_watch_history` -sarakkeisiin
- `src/lib/today-stats.ts`, `src/lib/club-today.ts`, `src/lib/season-leaders.ts` — pb-mapien avaimet
- `src/components/ClubTodaySection.tsx` ym. paikat jotka rakentavat avaimen käsin

### 4) Supabase RPC

Uusi SQL-immutable-funktio `public.event_pb_key(event_name, sub_category, age_class)` joka sisältää saman aitojen + heittojen logiikan. Muuta `mark_pbs_for_competitions` käyttämään sitä `normalize_event_name`:n sijaan, jotta `athlete_results.was_pb` lasketaan oikein.

### 5) `get_shared_watch_history`

Lisää `age_class` palautettaviin sarakkeisiin (tarvitaan baselinessa jaetuilla seurantalinkeillä).

## Vaikutus käyttäjälle

- Aidoissa ja heitoissa PB/SB-tähti vain kun tulos voittaa saman speksin (korkeus & aitojen määrä / välineen paino) aiemman tuloksen
- Urheilijasivulla heitot/aidat näkyvät erikseen jokaiselle speksille (esim. "Kuula 3 kg" ja "Kuula 4 kg" omina riveinään)
- Muut lajit ennallaan

## Vahvistuspyyntö

Kelpaako: rakennetaan yksi yhteinen spec-taulukko aidoille ja kaikille heitoille (kuula, kiekko, keihäs, moukari), näytetään speksi näyttönimessä, ja päivitetään myös SQL-RPC `was_pb`-leimaan?
