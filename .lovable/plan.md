# Suorituspaikan livenäytön aikajärjestys

## Varmistettu syy

`src/routes/scoreboard.tsx` järjestää kenttälajit edelleen vertaamalla `BeginDateTimeWithTZ` arvoja merkkijonoina. Tämä ei huomioi lähdedatan vaihtelevia aikavyöhykemerkintöjä, joten esimerkiksi klo 17.00 voi päätyä klo 19.40 jälkeen.

## Toteutus

- Otetaan livenäytön lajivalitsimessa käyttöön jo olemassa oleva `compareByBeginTime` vertailufunktio.
- Säilytetään päivien ryhmittely, näkyvät kellonajat, tilat ja muu käyttöliittymä ennallaan.
- Tarkistetaan selaimessa, että saman päivän kenttälajit näkyvät nousevassa todellisessa aikajärjestyksessä myös kuvan kaltaisessa tilanteessa.

## Tekninen muutos

Muutos rajataan tiedostoon `src/routes/scoreboard.tsx`: vertailufunktio tuodaan `src/lib/tuloslista.ts` tiedostosta ja nykyinen `localeCompare` korvataan sillä.