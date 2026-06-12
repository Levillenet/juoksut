## Ongelma

Tietokannassa tämän päivän tuloksilla `was_pb`-lippu on usein vielä `false` (esim. Siiri Aavikon 150m 21,49, vaikka vanha ennätys oli 22,67). Koska PB-merkki näytetään vain `was_pb`-lipun perusteella, parannus jää kokonaan näkymättä.

## Korjaus — `src/components/ClubTodaySection.tsx`

1. **PB tunnistetaan myös itse vertaamalla**: rivi merkitään ennätykseksi, jos
   - `was_pb` on tosi tietokannassa, **tai**
   - tämän päivän tulos (`result_numeric`) on parempi kuin aiempi paras (`pb.numeric`) — juoksulajeissa (Track) pienempi on parempi, kenttälajeissa suurempi.

2. **PB-merkin sisältö**: badge näyttää `PB` + parannuksen, esim. `PB −1,18 s` tai `PB +5 cm` (`formatImprovement` on jo käytössä).

3. **Alarivin teksti** ennätysriveillä muutetaan muotoon `ed. PB 22,67` (aiempi ennätys), jolloin lukija näkee: iso luku oikealla = uusi ennätys 21,49, badge = parannus, alarivi = vanha ennätys. Ei-PB-riveillä alarivi näyttää edelleen `PB {aiempi paras}` kuten nyt.

## Tekninen huomio

- Aiempi paras tulee jo `fetchClubPreviousPbs`-kyselystä (tulokset ennen valittua päivää), joten vertailu onnistuu ilman uusia tietokantakyselyitä.
- Vertailussa käytetään `result_numeric`-arvoja; jos jompikumpi puuttuu, nojataan pelkkään `was_pb`-lippuun kuten ennen.

Vain yksi tiedosto muuttuu, ei tietokantamuutoksia.