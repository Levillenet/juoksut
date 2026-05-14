## Ongelma

Sekä **Kilpailijaseurannassa** (`/watch`) että **Kuuluttajan dashboardissa** (`/announcer`) koko kilpailijaluettelo / aikataulu ladataan uudelleen joka kerta kun sivulle palataan. `watch.tsx` käy läpi kaikki lajit yksitellen API:sta (näkyy "Ladataan osallistujatietoja… X/Y"), mikä on suurissa kisoissa hidasta.

Syy: tila (`index`, `data`, `details`) on komponentin omassa `useState`:ssa. Kun käyttäjä klikkaa lajitulokseen ja painaa takaisin, komponentti unmountataan ja uudelleenmountataan tyhjällä tilalla → `buildIndex()` ajetaan alusta.

## Ratkaisu

Siirretään lataus **TanStack Queryn** hallintaan, joka on jo projektissa käytössä. Kysely-cache elää reittien yli, joten paluu listalle näyttää datan välittömästi, ja taustapäivitys hoidetaan `staleTime`/`refetchInterval`-asetuksilla — sama 60 s / 15 s rytmi kuin nyt.

### Muutokset

**1. `src/lib/tuloslista-queries.ts` (uusi)**
- `competitionIndexQueryOptions(competitionId)` — palauttaa kaikki `IndexedEntry`-rivit + kisan nimen. Sama logiikka kuin nykyisessä `buildIndex`issä (rounds → events rinnakkain, baselineiden capture+load).
- `staleTime: 30_000` (data tuoretta 30 s), `gcTime: 10 * 60_000` (säilyy cachessa 10 min taustalla), `refetchInterval: 60_000` (sama auto-refresh kuin nyt).
- `competitionScheduleQueryOptions(competitionId)` — kuuluttajan kevyempi `fetchRounds` + properties, `refetchInterval: 30_000`.
- `eventDetailsQueryOptions(competitionId, eventId)` — `fetchEvent`-kutsu yhdelle lajille, `refetchInterval: 15_000` käytössä vain kun komponentti on mountattu.

**2. `src/routes/watch.tsx`**
- Korvataan `useState<IndexedEntry[]>` + `buildIndex` + `setInterval(60s)` → `useQuery(competitionIndexQueryOptions(competitionId))`.
- Latausindikaattori (`progress.done/total`) säilytetään ensimmäisen latauksen ajaksi käyttämällä Queryn `meta`-callbackia tai erillistä `useState`-progressia, joka päivitetään queryFn:n sisällä.
- Refresh-nappi → `queryClient.invalidateQueries({ queryKey: [...] })`.
- Tulos: paluu `/round/...`-näkymästä piirtää listan välittömästi cachetetulla datalla; taustahaku tapahtuu hiljaa.

**3. `src/routes/announcer.tsx`**
- Sama kuvio: `data` (rounds) → `useQuery(competitionScheduleQueryOptions)`, `details`-cache → per-lajin `useQueries` tai säilytetään nykyinen `details`-Map mutta täytetään queryFn:n kautta ja säilötään `queryClient`iin.
- Säilytetään olemassa olevat record-alertit ja `seenResultsRef`-logiikka koskemattomana — vain datan lähde vaihtuu.

**4. `src/routes/round.$eventId.$roundId.tsx`**
- Käyttää jo `fetchEvent`iä; siirretään saman `eventDetailsQueryOptions`in taakse, jolloin announcer/watch ja round-sivu jakavat saman cachen. Klikkaus rounditulokseen → cache-osuma, ei uutta verkkokutsua.

### Mitä ei muuteta

- API-kutsujen rakenne (`fetchRounds`, `fetchEvent`, baselinet) pysyy ennallaan.
- UI-rakenne, kortit, alert-banner — ei muutoksia.
- Päivitysrytmit pidetään nykyisellään (60 s watch, 15 s announcer, 30 s round).

### Lopputulos

- Paluu lajitulokselta listalle: välitön (cache).
- Ensilataus: sama nopeus kuin nyt, mutta indikaattori näytetään vain ensimmäisellä kerralla per istunto.
- Taustapäivitys jatkuu automaattisesti, joten tiedot pysyvät tuoreina.
- Useat sivut (watch + round + announcer) jakavat saman lajidata-cachen → vähemmän verkkokutsuja kokonaisuutena.
