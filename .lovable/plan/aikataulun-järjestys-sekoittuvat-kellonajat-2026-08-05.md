# Aikataulun järjestys: sekoittuvat kellonajat

## Mitä data kertoo

Tarkistin kilpailun 20242 (LaSY, pm-huipentuma) aikataulun rajapinnasta. Aikaleimat eivät ole yhtenäisiä:

```text
2026-08-05T16:55:00.0000000+00:00   T12 60m        -> 19.55 (Helsinki)
2026-08-05T17:00:00.0000000+03:00   T12 200m aidat -> 17.00 (Helsinki)
2026-08-06T17:00:00.0000000+03:00   T8 60m aidat   -> 17.00 (Helsinki)
```

Valtaosa riveistä tulee merkinnällä `+00:00`, mutta yksittäisiin riveihin on tallentunut `+03:00`. Kyse on lähdejärjestelmän datasta, ei meidän muunnoksestamme: näyttöaika on oikein, koska muunnamme sen Helsingin aikaan.

Meidän vikamme on järjestäminen: lajit lajitellaan vertaamalla aikaleimaa merkkijonona (`localeCompare`). Merkkijonona "17:00...+03:00" on suurempi kuin "16:55...+00:00", vaikka se on todellisuudessa aiemmin. Siksi klo 17 laji hyppää klo 19-20 lajien väliin.

## Korjaus

- Järjestetään todellisen aikaleiman mukaan (`new Date(...).getTime()`), jolloin poikkeava aikavyöhykemerkintä ei enää riko järjestystä.
- Kelvoton aikaleima siirretään listan loppuun sen sijaan, että se sotkisi järjestyksen.
- Toissijainen järjestys samalle ajalle: sarja ja lajinimi, jotta järjestys on vakaa.
- Yksi jaettu apufunktio (esim. `compareByBeginTime`), jota kaikki näkymät käyttävät.

## Muutettavat tiedostot

- `src/routes/running-ops.tsx` (rivi 110, sekä `isPast`-vertailun tarkistus): juoksulajien operointi
- `src/routes/print.index.tsx` (rivi 45): kilpailun aikataulu
- `src/routes/print.club.tsx` (rivi 119): seuran urheilijat
- `src/routes/print.watched.tsx` (rivi 103): omat urheilijat

Näyttöajat, päiväryhmittely ja ulkoasu säilyvät ennallaan.
