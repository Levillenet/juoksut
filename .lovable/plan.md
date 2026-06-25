## Tavoite

Juoksulajien operointi -näkymään (`/running-ops`) toggle "Niputa ikäluokat", joka yhdistää samaan aikaan alkavat saman matkan/lajin eri ikäsarjat yhdeksi korttiksi. Avattaessa niputettu kortti näyttää kaikki sarjat yhdellä erä-/kilpailijalistalla, jotta lähdön järjestely on helpompaa (esim. SM-kävelyt: naiset W30/W35/W45… 3000 m kello 11).

## Käyttäjäkokemus

1. `/running-ops` listalla uusi toggle "Niputa ikäsarjat" (oletus pois, tila tallennetaan `localStorage`iin).
2. Kun päällä, samana ajankohtana alkavat saman sukupuolen/matkan/lajin rivit yhdistetään yhdeksi korttiksi:
   - Otsikko: lajin perusnimi ilman ikäluokkaa (esim. "Naiset 3000 m kävely").
   - Alaotsikko listaa niputetut sarjat (esim. "W30, W35, W45, W50, W55, W60, W65, W70 · 8 sarjaa").
   - Status-badge: yhdistetty status (jos kaikki sama → se; muuten "Useita").
3. Klikkaus avaa olemassa olevan `/round/$eventId/$roundId` -näkymän ensimmäisellä roundilla, mutta search-parametri `group=<id1>,<id2>,…` kertoo, että näkymän pitää yhdistää kilpailijat ja eräjaot kaikista roundeista.
4. Round-näkymässä:
   - Otsikkoon merkintä "Niputettu N sarjaa" + lista sarjoista.
   - Ilmoittautuneet ja eräjaot kerätään kaikilta niputetuilta roundeilta, ja jokaisessa rivissä näkyy mistä sarjasta urheilija tulee (pieni badge esim. "W45").
   - Järjestys: samat säännöt kuin nyt (eräjako/aika/sukunimi). Eräjakojen "Heat #" yhtenäistetään, jos sama numerointi; muuten näytetään sarja-prefix.

## Niputuksen sääntö

Group key = `BeginDateTimeWithTZ` + sukupuoli-token + lajin matka/laji ilman ikäluokkaa.

Toteutus `src/lib/round-grouping.ts`:
- `parseEventName(name)`: erottaa `genderToken` (N/M/Naiset/Miehet/T/P + valinnainen ikäluku), `ageClass` (esim. `W45`, `N50`, `M16`), `baseName` (loput ilman ikäluokkaa, trimmattu).
- `groupKey(round)` = `${beginISO}|${genderToken}|${normalizedBase}` — vain `isRunningEvent` rounds.
- `groupRunningRounds(rounds[])`: palauttaa `RunGroup[] = { key, beginISO, baseName, ageClasses[], rounds[] }`. Yhden roundin "ryhmät" renderöidään kuten nykyiset rivit (ei muutosta UI:hin).

## Tekniset muutokset

**Uudet tiedostot**
- `src/lib/round-grouping.ts` — yllä kuvatut parserit + grouper + pieni unit-mainen testattava puhdas funktio.

**Muutetut tiedostot**
- `src/routes/running-ops.tsx`
  - Toggle-tila `groupAgeClasses` (persistoitu `settings-store` tyyliin tai suoraan `localStorage`).
  - Lasketaan `runGroups = groupRunningRounds(runs)` ja renderöidään ryhmäkortit (yksi-jäseninen ryhmä = nykyinen kortti).
  - Linkki ryhmälle: `to="/round/$eventId/$roundId"`, `params` = ensimmäinen round, `search: { group: ids.join(",") }` (vain kun ryhmässä >1).
- `src/routes/round.$eventId.$roundId.tsx`
  - `validateSearch` ottaa `group?: string`.
  - Jos `group` annettu, hakee aikataulusta kaikki ko. roundit ja
    - mergeää ilmoittautumiset / heatit useammasta roundista (lisää `seriesLabel` jokaiseen riviin, esim. `W45`).
    - näyttää otsikossa "Niputettu: W30, W35, …" -listan.
  - Olemassa oleva yksittäisen roundin polku säilyy ennallaan kun `group` puuttuu.
- `ConfirmedDot`-legend ja muu nykyinen UI säilyy.

**Ei muutoksia**
- Backendiin/Supabaseen ei kosketa. Tuloslistadatan haut käyttävät jo olemassa olevia kyselyitä (`competitionScheduleQueryOptions`, roundin ilmoittautuneet/heatit).

## Reuna-ehdot ja epävarmuudet

- Lajien nimeämiskäytäntö vaihtelee (esim. "Naiset W45 3000 m kävely" vs "N45 3000m kävely"). Parseri tukee yleisimmät muodot (W/M/N/T/P + numero). Jos parsinta ei tunnista ikäluokkaa, round jää omaksi ryhmäkseen — turvallinen oletus.
- Jos saman ajan + matkan ryhmässä on sekä karsinta että finaali, ne pysyvät erillään (parseri ottaa myös `Round.Name` faasitiedon mukaan ryhmäavaimeen).
- Eräjakojen yhdistäminen tehdään näkymätasolla; lähdettäessä toimitsija näkee yhdistetyn listan, mutta tallennukset (jos näkymässä on muokkausta) eivät kosketa toista roundia — vain luku/operointi.

## Avoimet kysymykset

Toteutan kuten yllä ellet halua muuta. Jos haluat esim. että toggle on oletuksena päällä tai että ryhmän status -badge näyttää aina ensimmäisen roundin tilan, kerro.
