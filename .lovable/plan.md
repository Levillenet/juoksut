## Ongelma

Suorituspaikan livenäytössä (`/scoreboard`) on edelleen Top-valitsimissa "Kaikki"-vaihtoehto. Pitää jäädä vain Top 3, Top 5 ja Top 10.

## Korjaus — `src/routes/scoreboard.tsx`

1. `TopSize`-tyyppi muutetaan: `type TopSize = 3 | 5 | 10` (poistetaan `"all"`).
2. `parseTop` palauttaa vain 3/5/10, oletus 10 (poistetaan `"all"`-haara).
3. Molemmat valintaridut (rivi 146 ja rivi 388) muutetaan listaksi `[3, 5, 10]`, ja painikkeen teksti yksinkertaistuu muotoon `Top {n}` (poistuu `n === "all" ? "Kaikki" : ...`).
4. Tarkistetaan tiedostosta, käytetäänkö `top === "all"` -ehtoa renderöinnissä (esim. listan rajaus). Jos käytetään, korvataan suoraan numerorajaukseksi, jolloin "näytä kaikki" -käyttäytymistä ei enää ole.

Ei muutoksia muihin tiedostoihin, ei tietokantamuutoksia.