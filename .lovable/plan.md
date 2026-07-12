# Seurattavien päivän suoritukset näkyviin kaikista kisoista

## Ongelma

`/watch`-sivun "Seurattavat kilpailijat" -listassa näytetään urheilijan lajit vain valitusta kilpailusta (`competitionId`-indeksistä). Jos seurattava (esim. Stella Väliklemelä) kilpailee toisessa kisassa, hänen tuloksensa eivät näy, vaikka data on jo `athlete_results`-taulussa.

## Ratkaisu

Lisää jokaisen seurattavan urheilijan kortille oma alaosio "Päivän omat tulokset", joka listaa urheilijan tämän päivän tulokset kaikista kisoista, valitun kisan ulkopuolelta (valitun kisan lajit näkyvät jo olemassa olevassa "entries"-listassa).

## Toteutus

**1. `src/lib/daily-best.ts`**: uusi funktio `fetchTodayOwnResultsForAthletes(athleteKeys)`
- Hakee `athlete_results` tänään (Helsinki-vuorokausi) `athlete_key in (...)`
- Suodattaa pois road/cross-country (samoin kuin `fetchDailyBestForAthletes`)
- Palauttaa `Record<athleteKey, TodayOwnRow[]>` kentillä: `event_name`, `age_class`, `result_text`, `result_rank`, `result_numeric`, `event_category`, `sub_category`, `was_pb`, `was_district_record`, `competition_id`, `competition_name`, `event_id`, `round_id`, `captured_at`
- Järjestys `captured_at` mukaan.

**2. `src/routes/watch.tsx`**
- Uusi `useQuery` `today-own-for-athletes` avaimella `watchedKeysList`.
- `watchedSections`-kortissa, ennen "Ei lajeja tässä kisassa" / entries-listaa, renderöidään uusi lohko "Päivän omat tulokset (muut kisat)":
  - Suodata pois rivit joilla `competition_id === competitionId` (näkyvät jo entries-listassa Result-kenttänä).
  - Jokainen rivi: aika (HH:MM `captured_at` Helsinki-ajassa), laji + sarja, tulos + sijoitus, kilpailun nimi, PE/PB-merkit (`RecordBadge` `pb`/`sb`/`district_record`).
  - Jos `event_id` ja `round_id` löytyvät, rivi on `<Link to="/round/$eventId/$roundId">`; muutoin pelkkä rivi (klikkaus urheilijasivulle ei ole tarpeen, sillä "Urheilijatilastot"-nappi on jo kortissa).
- Jos lohko on tyhjä ja entries-lista on tyhjä, näytetään nykyinen "Ei lajeja tässä kisassa" -teksti; muuten piilotetaan se koska tuloksia löytyi muualta.

## Rajaukset

- Ei koske muita näkymiä, ei urheilijatilastoja, ei etusivua.
- Ei muutoksia dataputkeen, RLS:ään tai harvesteriin: `athlete_results` on jo luettavissa.
- Ei muuta valitun kilpailun logiikkaa eikä "Seurattavien kisat tänään" -osiota.
