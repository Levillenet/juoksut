## Ongelma

Maasto- ja pitkien matkojen juoksuajat tallentuvat `athlete_results.result_numeric`-kenttään väärin, koska `parseResultNumeric` (`src/lib/athlete-history.ts`) ei tunnista suomalaista aikaformaattia.

Esimerkkejä tuotannosta:

| Kisa | Laji | result_text | result_numeric nyt | Pitäisi olla |
|---|---|---|---|---|
| Lasyn pm-maastot | T9 1km | `4,18` | 4.18 | 258.00 |
| Lasyn pm-maastot | T9 1km | `5,02` | 5.02 | 302.00 |
| Pohjois-Savon pm-maastot | T9 1000m | `4.42,40` | 4.42 | 282.40 |
| Pohjois-Savon pm-maastot | T14 Maantiejuoksu | `20.48,80` | 20.48 | 1248.80 |

Suomalainen sopimus (jota tuloslista käyttää):
- `M.SS,xx` — piste erottaa minuutit ja sekunnit, pilkku on desimaalierotin (esim. `4.42,40` = 4 min 42,40 s)
- `M,SS` — pelkkä pilkku tarkoittaa min,sek ilman sadasosia, kun laji on juoksu (esim. `4,18` maastojuoksussa = 4 min 18 s)
- `S,xx` tai `S.xx` — pelkkiä sekunteja sadasosilla lyhyissä juoksuissa (esim. `12,34` 100 m:llä)
- `M,xx` — metrejä kenttälajeissa (esim. `4,18` pituushypyssä = 4,18 m)

Nykyinen `parseResultNumeric` käsittelee vain `:`-erotetut ajat ja muuten tekee `parseFloat(",")→"."`.

## Vaikutus

- Päivän parhaat -valinta maastoissa valitsee väärän voittajan kilpailujen välillä (numeerinen vertailu menee pieleen).
- PB/SB-tunnistus (`mark_pbs_for_competitions` käyttää `result_numeric`:a) ei tunnista oikeita ennätyksiä maasto- ja pitkien matkojen juoksuissa.
- Kausitilastot ja kärkitulokset näyttävät vääriä järjestyksiä.
- Urheilijakortin trendikäyrissä maaston ajat näyttävät olevan sekunteja, vaikka ovat minuutteja.

`result_text` on oikein → visuaalisesti monessa paikassa näkyy oikea aika, mutta vertailut ja valinnat menevät pieleen.

## Korjaus

### 1. Parser tunnistaa suomalaiset aikaformaatit

`parseResultNumeric` `src/lib/athlete-history.ts`:ssä laajennetaan tunnistamaan:

1. **`M.SS,xx`** ja **`H.MM.SS,xx`** — split `.`:llä kun pilkku on mukana; kokonaisluku-osat ovat minuutteja/sekunteja, pilkun jälkeen sadasosat. Tämä on jo `records.tsx`:n `parsePerf`-funktion logiikka — käytetään samaa.
2. **`M:SS.xx`** — nykyinen `:`-haara säilyy.
3. **`M,SS`** ilman erillistä desimaaliosaa: tämä on epäselvä (`4,18` voi olla 4 min 18 s tai 4,18 m). Ratkaistaan **lajin perusteella**: jos `sub_category` on aika-laji (Run, Sprint, MiddleDistance, LongDistance, Hurdles, Steeple, Relay, Walk, RoadRun, CrossCountry) ja arvo on kokonaislukuparina M,SS jossa toinen osa on 00–59 ja matka on ≥ 600 m → tulkitse minuutit,sekunnit. Muuten pidetään desimaalitulkinta (esim. `12,34` 100 m → 12,34 s).
4. **Pelkkä luku ilman erottimia** kenttälajeissa — säilyy nykyisellään.

Funktion signaturen muutos: lisätään valinnainen `eventName?: string` parametri (matkan päättelyyn). Päivittämään tarvittaessa kaikki kutsupaikat — vain `harvest-results.ts` ja `athlete-history.ts` itse käyttävät.

### 2. Yhdistetään `parsePerf` ja `parseResultNumeric`

`records.tsx`:n `parsePerf` ja `athlete-history.ts`:n `parseResultNumeric` tekevät päällekkäistä työtä mutta antavat eri vastauksia samalle syötteelle. Yhdistetään ne yhdeksi funktioksi `src/lib/result-parse.ts`:ssä ja kummatkin ottavat sen käyttöön. Tämä estää saman bugin uusiutumisen toisessa polussa.

### 3. Olemassa olevien rivien uudelleenlasku

Pelkkä parserin korjaus ei korjaa jo tallennettuja rivejä. Tehdään SQL-migraatio joka:

1. Päivittää `result_numeric`-arvot kaikille riveille joissa `result_text` mätsää uuden parserin ehtoihin (juoksulajit + `M.SS,xx` tai `M,SS`-formaatti).
2. Ajaa `mark_pbs_for_competitions(...)` niille kisoille joiden rivejä päivitettiin, jotta PB-merkinnät korjautuvat.

Migraatio voidaan toteuttaa Postgres-funktiona (`fix_running_times_numeric()`), joka päivittää rivit batch-mahdollisesti `event_category IN ('Track','Street')`-rajauksella ja `sub_category`:n perusteella.

### 4. Harvest-polun varmistus

`src/routes/api/public/hooks/harvest-results.ts` käyttää samaa `parseResultNumeric`:ä → korjaantuu automaattisesti, kun parser korjataan. Tarkistetaan että `event_name`/`sub_category` on käytettävissä siellä missä parser kutsutaan.

## Tiedostot

- **Uusi:** `src/lib/result-parse.ts` — yhteinen parsija.
- **Muokattava:** `src/lib/athlete-history.ts` — `parseResultNumeric` käyttää uutta parsijaa, ottaa `eventName`/`subCategory` mukaan.
- **Muokattava:** `src/lib/records.tsx` — `parsePerf` käyttää samaa parsijaa.
- **Muokattava:** `src/routes/api/public/hooks/harvest-results.ts` — kutsuu parsijaa lajin/kategorian kanssa.
- **Migraatio:** Postgres-funktio + sen ajo niihin riveihin joissa formaatti mätsää; lopuksi `mark_pbs_for_competitions`.

## Avoin kysymys

`4,18` maastossa T9 1 km → onko **aina** 4 min 18 s? Tutkin näytteen, kaikki "M,SS" ja "M.SS,xx" -rivit ovat aikajuoksuissa (Run-alakategoria). Kentässä `4,18` tulee aina muotoa `4,18` (pituushyppy) tai `1,85` (korkeus) eikä sekoittumisriskiä ole — sub_category eroaa (Jump vs Run). Heuristiikka "matka ≥ 600 m + sub Run + M,SS missä SS ≤ 59" on turvallinen.

Hyväksyttekö suunnitelman, niin toteutan?
