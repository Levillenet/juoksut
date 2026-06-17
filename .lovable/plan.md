## Tavoite

Kun asetus **"Pakota saman lajin sarjat peräkkäin"** on päällä, solver järjestää juoksulajit
1) matkan mukaan nousevasti (40m → 60m → 100m → 200m → …),
2) saman matkan sisällä ikäluokkajärjestyksessä (tytöt ennen poikia, nuorimmasta vanhimpaan: T9, T11, … P9, P11, … N, M).

Aitajuoksut ryhmitellään omaksi blokikseen samalla matkalla (esim. kaikki 60m sileät → kaikki 60m aidat, tai päinvastoin — pidetään nykyinen "aidat ennen sileitä saman matkan sisällä" -logiikka, koska aitojen pystytys/purku halutaan tehdä blokkina).

## Nykyinen ongelma

Tiedostossa `src/lib/planner-solver.ts` lajittelussa (rivit 237–251) kun `groupSameEventConsecutively` on päällä, vertaillaan `a.groupKey.localeCompare(b.groupKey)`. `groupKey` on muotoa `BBB_run_F-60`, joten merkkijonovertailu tuottaa väärän järjestyksen:
- `F-100` < `F-60` (merkkivertailussa "1" < "6")
- ikäluokkajärjestystä ei oteta lainkaan huomioon

## Korjaus (vain `src/lib/planner-solver.ts`)

1. Lisää tiedoston yläosaan apufunktio `ageClassRank(s: string): number` (sama logiikka kuin `planner-schedule-xlsx.ts:26`: T=0, P=1, N=2, M=3, ja sitten numero).

2. Muutetaan `sort`-vertailu (rivit 237–251) niin, että `groupSameEventConsecutively`-haaran sisällä järjestys on:
   1. `segBucket` (lyhyet sprintit → muut juoksut → kentät) — säilytetään
   2. `segDistance` nousevasti (40 < 60 < 100 < 200 …)
   3. aidat ennen sileitä samalla matkalla (säilytetään nykyinen `groupKey`-prefix `AAA_hurdles` / `BBB_run` — vertaillaan vain prefix-osaa)
   4. `ageClassRank(a.ageClass)` nousevasti
   5. `phaseOrder` (heats → final_a → final_b) — säilyy jo ylempänä eventId-vertailussa

   Kun asetus on **pois**, vanha logiikka säilyy täysin ennallaan.

## Mitä EI muuteta

- Solverin sijoitussäännöt (venue-lukot, conflict-groupit, candidateStart) pysyvät ennallaan.
- UI:n teksti ja muut tiedostot eivät muutu.
- Kenttälajien järjestys ei muutu (asetus koskee vain juoksuja, jotka kuuluvat groupKey-blokkeihin).

## Vaikutus

Esim. matkat {40m P9, 40m T9, 60m T11 aidat, 60m P11, 100m T13} → uusi järjestys:
40m T9 → 40m P9 → 60m T11 aidat → 60m P11 → 100m T13.
