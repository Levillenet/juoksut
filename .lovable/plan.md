## Toimitsijan etusivun siivous + uusi "Juoksulajien operointi" -sivu

### Mitä muuttuu

**Toimitsijan (`role === "official"`) etusivu `/`** sisältää jatkossa vain nämä kortit:
- Tulostettava aikataulu
- Kuuluttaja
- Asetukset
- **Juoksulajien operointi** (uusi)

Etusivulta poistetaan toimitsijalta:
- "Hae sukunimellä" -kortti → siirtyy uudelle sivulle
- "Kauden kärki" -kortti → poistetaan kokonaan toimitsijan näkymästä
- Päivän lajit -lista (juoksu + kenttä), päivämäärävälilehdet ja "Näytä menneet" -painike → siirtyy uudelle sivulle (vain juoksulajit)

Tavalliselle käyttäjälle (`role === "user"`) etusivu pysyy ennallaan (kaikki kortit ja koko päivän lajien lista näkyvät kuten nyt).

### Uusi sivu `/running-ops` ("Juoksulajien operointi")

Uusi route `src/routes/running-ops.tsx`, suojattu `RequireRole allow={["official"]}`. Sivulla:

- Otsikkopalkki samaan tyyliin kuin etusivulla (logo, kisan nimi, päivitysnappi, takaisin-nappi `/`).
- Kompakti **Hae sukunimellä** -hakupalkki sivun ylälaidassa (sama UX kuin `/search`-sivulla — input + osumalista, jossa linkit erään). Toteutetaan poimimalla nykyisen `src/routes/search.tsx`:n hakulogiikka jaettavaksi komponentiksi `src/components/AthleteSearch.tsx`, jota molemmat sivut käyttävät. Näin `/search` säilyy tavallisille käyttäjille ennallaan.
- Päivämäärävälilehdet (jos useita kisapäiviä).
- Päivän lajien lista, **suodatettuna vain juoksulajeihin** käyttäen olemassa olevaa `isRunningEvent`-funktiota.
- Sama "5 min alkamisajan jälkeen automaattisesti piilossa" -logiikka ja "Näytä menneet / Piilota menneet" -painike kuin nykyisellä etusivulla.
- Rivit linkittävät edelleen `/round/$eventId/$roundId` -sivulle.

### Tekniset muutokset

1. `src/routes/index.tsx`: jaetaan render kahtia roolin mukaan. Toimitsijalle näytetään vain neljä korttia (mukaan lukien uusi "Juoksulajien operointi") eikä lainkaan päivän lajien listaa, päivämäärävälilehtiä tai siihen liittyvää data-fetchaystä. Tavallisen käyttäjän reitti säilyy nykyisellään (mukaan lukien `DailyBestSection`, `ClubTodaySection`, `SeasonStatsSection` ja koko lajilista).
2. Uusi `src/components/AthleteSearch.tsx` kapseloi sukunimihaun (indeksin rakennus, input, tuloslista). Käyttää nykyisiä `fetchRounds` / `fetchEvent` -funktioita.
3. `src/routes/search.tsx`: refaktoroidaan käyttämään uutta `AthleteSearch`-komponenttia (toiminnallisuus pysyy samana).
4. Uusi `src/routes/running-ops.tsx`: yhdistää `AthleteSearch` + juoksulajeihin suodatetun päivän listan, päivämäärävälilehdet ja "Näytä menneet" -painikkeen.
5. `head()`-metat uudelle reitille (title "Juoksulajien operointi – Lahden Ahkera" + suomenkielinen description).

### Mitä ei muutu

- `/search`, `/season-leaders`, `/print`, `/announcer`, `/settings`, `/watch` ja `/round/...` toimivat ennallaan.
- Tavallisen käyttäjän etusivu, mukaan lukien kenttälajien näkyminen päivän listassa, ei muutu.
- Backend tai tietomalli ei muutu.