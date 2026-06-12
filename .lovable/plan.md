## Havainto

`src/data/yag-calling.ts` sisältää T13 200m -lajille vain **4 erää** (rivit 203–238), kaikki perjantaille 12.6.2026 alkaen klo 12:55. Tuloslistan mukaan eriä on kuitenkin **11**.

Olemassa olevien erien aikaleimat etenevät tasaisesti +3 min per erä:

| Erä | Calling | Kentälle | Alkaa |
|---|---|---|---|
| 1 | 12:29–12:39 | 12:41 | 12:55 |
| 2 | 12:32–12:42 | 12:44 | 12:58 |
| 3 | 12:35–12:45 | 12:47 | 13:01 |
| 4 | 12:38–12:48 | 12:50 | 13:04 |

## Muutos

Lisätään `src/data/yag-calling.ts`-tiedostoon erät 5–11 samaa 3 minuutin askellusta jatkaen, samalla `sarja: "T13"`, `date: "2026-06-12"`, `paikka: "–"`:

| Erä | Calling | Kentälle | Alkaa |
|---|---|---|---|
| 5 | 12:41–12:51 | 12:53 | 13:07 |
| 6 | 12:44–12:54 | 12:56 | 13:10 |
| 7 | 12:47–12:57 | 12:59 | 13:13 |
| 8 | 12:50–13:00 | 13:02 | 13:16 |
| 9 | 12:53–13:03 | 13:05 | 13:19 |
| 10 | 12:56–13:06 | 13:08 | 13:22 |
| 11 | 12:59–13:09 | 13:11 | 13:25 |

Uudet rivit lisätään erän 4 perään (rivin 238 jälkeen).

## Vaikutus

- `matchYagCalling` osaa nyt sijoittaa julkaistut T13 200m -urheilijat oikealle erälleen (1–11). Julkaisemattomille `allHeats` näyttää kaikki 11 erää calling-tietoineen.
- Ei muutoksia logiikkaan, UI:hin eikä muihin lajeihin.

## Avoin kysymys

Aikaleimat on ekstrapoloitu olemassa olevasta +3 min -kuviosta. Jos sinulla on viralliset calling-ajat erille 5–11 (esim. PDF:stä), kerro ne niin käytetään niitä — muuten lisätään ylläolevat ekstrapoloidut arvot.