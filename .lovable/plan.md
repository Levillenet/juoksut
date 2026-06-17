Käyttäjä valittaa, että asetuksen "Salli matkanvaihto samalla suorituspaikalla" ohjeteksti on edelleen epäselvä ja harhaanjohtava.

**Tunnistettu ongelma:**
Nykyinen teksti "Jos pois päältä, solveri ei sijoita eri matkoja samalle juoksuradalle/-suoralle. Esim. kaikki 40 m omalle suoralle, 60 m omalleen." ei ota huomioon suorien määrää:

- Jos kilpailussa on **2 pikajuoksusuoraa**: asetus kontrolloi, voiko eri matkat (esim. 40 m ja 60 m) olla SAMALLA suoralla vai pakotetaanko ne eri suorille.
- Jos on **vain 1 suora**: asetus ei käytännössä vaikuta — kaikki juostaan siinä yhdessä.

**Ehdotettu uusi teksti:**

```
Salli eri matkat samalla suoralla
Kun päällä, solver voi sijoittaa eri matkat (esim. 40 m ja 60 m) samalle 
suoralle peräkkäin. Kun pois päältä, jokainen matka saa oman suoransa — 
esim. kaikki 40 m juostaan suoralla 1 ja kaikki 60 m suoralla 2. 
Jos suorituspaikkoja on vain yksi, tämä asetus ei vaikuta järjestykseen.
```

**Tiedosto muutettavaksi:**
- `src/routes/planner.$planId.tsx`, rivit 584-588

**Muutos:** Pelkkä UI-tekstin parannus — ei vaikutusta solver-logiikkaan, tietokantaan tai muihin osiin.