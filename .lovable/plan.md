## Ongelma

`src/routes/scoreboard.tsx` käyttää `aspect-square`/`aspect-[4/3]` -laatikoita sijoitukselle ja kuudelle yritykselle, ja niiden korkeus on `h-full`. Kun rivejä on vähän (esim. 4 osallistujaa), rivit ovat hyvin korkeita, jolloin neliö-/4:3-laatikot levenevät valtavasti ja syövät nimisarakkeen tilan. Loppu-tulos-laatikko vie lisäksi `w-[18%]`. Nimikenttään jää niin vähän leveyttä, että vain etunimi mahtuu ja sukunimi katkeaa `truncate`lla pois.

## Korjaus

Muokkaa vain `src/routes/scoreboard.tsx` `ScoreRow`-komponenttia (ei muuta logiikkaa):

1. **Rajoita sijoitus- ja yrityslaatikoiden leveys.** Korvaa `aspect-square` / `aspect-[4/3]` `max-width`-rajalla, joka skaalautuu osallistujamäärän mukaan (esim. sijoitus ≤ 6rem ja yrityslaatikko ≤ 7rem kun count ≤ 5). Säilytä `min-width` luettavuuden vuoksi. Näin korkeat rivit eivät enää venytä laatikoita vaakasuunnassa, ja vapautunut tila menee nimisarakkeelle.

2. **Pienennä tulos-laatikon prosenttileveyttä** pienillä count-arvoilla (esim. ≤ 5 → kiinteä `w-32`/`max-w-[10rem]`).

3. **Kaksirivinen nimi.** Jaa `row.Name` etunimeen ja sukunimeen ja renderöi ne kahdelle riville (heading-tyyliin: etunimi pienemmällä `font-semibold`, sukunimi isolla `font-black`) kun `count <= 5`. Suuremmilla count-arvoilla säilytä yksirivinen nimi. Jakologiikka: ensimmäinen sana = etunimi, loput = sukunimi; jos sanoja on vain yksi, näytä se isolla yksirivisenä. Poista `truncate` nimirivien tilalta `break-words` + `leading-tight`, jotta pitkät sukunimet katkeavat sanasta eivätkä häviä.

4. **Säädä `nameFontSize` pienille count-arvoille** niin että kaksirivinen versio mahtuu (etunimirivi ~60–70 % sukunimen koosta).

Tämä pitää erottelevuus (sijoitus + 6 yritystä + lopputulos) entisellään mutta varmistaa, että nimi on aina luettavissa kokonaan.

## Mitä ei muuteta

- Picker-näkymä, päivitys, top-valitsin, värit ja korostus säilyvät.
- Ranking-/parsinta-/datalogiikka (`rows`, `bestIdx`, sorttaus) ei muutu.
- Muita reittejä tai komponentteja ei kosketa.
