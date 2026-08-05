# Kilpailun aikataulun järjestys korjataan

## Ongelma

Tulostettavassa aikataulussa (/print) päivän lajit järjestetään vertaamalla alkuaikaa merkkijonona (`BeginDateTimeWithTZ.localeCompare`). Jos rajapinta palauttaa aikoja eri muodoissa tai eri aikavyöhykemerkinnöillä (esim. `...T19:55:00+03:00` ja `...T17:00:00Z`), merkkijonovertailu ei vastaa todellista kellonaikaa. Tällöin listan väliin voi ilmestyä klo 17 alkavia lajeja klo 19 lajien jälkeen, kuten kuvassa.

## Korjaus

- Järjestetään lajit todellisen aikaleiman mukaan: `new Date(...).getTime()` merkkijonovertailun sijaan.
- Jos aikaleima on kelvoton, laji sijoitetaan päivän loppuun sen sijaan, että se rikkoisi järjestyksen.
- Toissijainen järjestys samalle kellonajalle: sarja/lajinimi, jotta järjestys on vakaa.
- Sama korjaus tarkistetaan muille tulostusnäkymille, jotka järjestävät aikataulua samalla tavalla (esim. seuran kisaraportti), jos niissä on sama merkkijonovertailu.

## Tekniset yksityiskohdat

Muokattava tiedosto: `src/routes/print.index.tsx`, `grouped`-memo (rivit 38-53). Rivin 45 `localeCompare` korvataan aikaleimavertailulla. Päivien välinen järjestys säilyy ennallaan.
