## Ongelma

Etusivun "Urheilua tänään" -mittaristossa "Lajeja" ja "Urheilijoita" näyttävät 0 ennen kuin yksikään tulos on saatu. Syy: `src/lib/today-stats.ts` laskee molemmat `athlete_results`-taulusta (vain harvestoidut tulokset). "Kisoja"-luku toimii koska se ottaa datan elävältä kisalistalta.

## Korjaus

`src/lib/today-stats.ts` (`fetchTodayStats`):

1. Hae tämän päivän kisojen kierrosdata `fetchRounds(competitionId)`-kutsulla rinnakkain (yksi pyyntö per kisa, palvelu cachettaa reunalla). Suodata kierrokset, jotka eivät ole tänään (Helsinki-aika) tai jotka ovat maantie/maasto (`isRoadOrCrossCountry`).

2. **Lajit** = `events`-joukko, johon yhdistetään:
   - nykyiset `competition_id|event_id` tuloksista
   - kaikkien tänään pidettävien kierrosten `competition_id|EventId`

3. **Urheilijat** = max kahdesta arvosta:
   - nykyinen tuloksista laskettu uniikkien `athlete_key`-arvojen määrä
   - kierrosten `CountEnrolled` summa (= ilmoittautumiskertojen määrä; voi sisältää saman urheilijan useassa lajissa)

   Tämä antaa ennen kisaa realistisen luvun (ilmoittautuneet) ja päivän edetessä siirtyy varsinaisiin tuloksiin perustuvaan uniikkiin lukuun, kun se kasvaa suuremmaksi.

4. PBs ja Kauden kärki säilyvät ennallaan (lasketaan vain tuloksista).

5. Jos `fetchRounds` epäonnistuu yhden kisan kohdalla, ohitetaan se hiljaisesti (`.catch(() => null)`) jotta pääluvut eivät katoa.

## Ei muutoksia

- UI-komponentti `TodayStatsSection.tsx` säilyy ennallaan; vain datan lähde laajenee.
- Ei tietokantamuutoksia.
- Muu tilastologiikka ennallaan.
