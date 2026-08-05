# Kilpailun aikataulun järjestys korjataan

## Ongelma

Aikataulunäkymissä lajit järjestetään vertaamalla alkuaikaa merkkijonona (`BeginDateTimeWithTZ.localeCompare`). Jos rajapinta palauttaa aikoja eri muodoissa tai eri aikavyöhykemerkinnöillä (esim. `...T19:55:00+03:00` ja `...T17:00:00Z`), merkkijonovertailu ei vastaa todellista kellonaikaa. Tällöin listan väliin ilmestyy klo 17 alkavia lajeja klo 19-20 lajien jälkeen, kuten molemmissa kuvissa (/print ja /running-ops).

## Korjaus

- Järjestetään lajit todellisen aikaleiman mukaan: `new Date(...).getTime()` merkkijonovertailun sijaan.
- Jos aikaleima on kelvoton, laji sijoitetaan päivän loppuun sen sijaan, että se rikkoisi järjestyksen.
- Toissijainen järjestys samalle kellonajalle: sarja/lajinimi, jotta järjestys on vakaa.
- Sama korjaus tehdään kaikkiin näkymiin, joissa on sama merkkijonovertailu.
- Otetaan käyttöön yksi jaettu apufunktio (esim. `compareByBeginTime`), jotta logiikka pysyy yhtenäisenä.

## Muutettavat tiedostot

- `src/routes/print.index.tsx` (rivi 45): kilpailun aikataulu
- `src/routes/running-ops.tsx` (rivi 110): juoksulajien operointi, sekä `isPast`-vertailun tarkistus
- `src/routes/print.club.tsx` (rivi 119): seuran urheilijat
- `src/routes/print.watched.tsx` (rivi 103): omat urheilijat

Päivien välinen järjestys ja muu ulkoasu säilyvät ennallaan.
