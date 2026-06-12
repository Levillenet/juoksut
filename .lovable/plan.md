## Muutokset

### 1. `WelcomeDialog` — uusi sisältö ja näytä kaikille
`src/components/WelcomeDialog.tsx`

- **Vaihda `STORAGE_PREFIX`** uuteen avaimeen (esim. `"welcome.dialog.seen.v3-yag"`), jotta dialogi avautuu uudelleen myös niille käyttäjille, jotka ovat jo sulkeneet vanhan v2-version. Logiikka (näytä kerran per käyttäjä, muista localStorageen) säilyy.
- **Otsikko**: "Tärkeää tietoa palvelusta" → "Uutta: YAG Calling-aikataulu"
- **Sisältö** (korvaa `<AboutServiceContent />`): lyhyt inline-teksti, joka kertoo:
  - YAG Espoo 2026 -kisalle on nyt oma calling-aikataulu.
  - Sen löytää **Kilpailun aikataulu** -valikon yläreunan **YAG**-välilehdeltä.
  - Voi valita näkymäksi joko **omat seurattavat urheilijat** tai **oman seuran**.
  - Aikataulun saa myös ladattua PDF:nä.
- **Footer**: linkki "Avaa erillisellä sivulla" → osoittaa `/print/yag-calling`-sivulle (tekstinä esim. "Avaa YAG calling-aikataulu"). "Selvä, kiitos!" -painike säilyy.

### 2. Säilytä vanha "Tietoa palvelusta" -sisältö
- `AboutServiceContent` ja `/tietoa-palvelusta`-sivu säilyvät ennallaan, joten vanha teksti on luettavissa.
- Lisätään pieni linkki etusivun alalaitaan (kaikille) tai admin-osioon: "Tietoa palvelusta", joka vie `/tietoa-palvelusta`-sivulle. *(Voidaan jättää myös pois, jos linkki on jo olemassa — tarkistetaan toteutusvaiheessa, näkyykö linkki etusivulla.)*

## Vaikutukset
- Kaikki käyttäjät (myös aiemmin dialogin sulkeneet) saavat YAG-ohjeen näkyviin seuraavalla kirjautumisella.
- Suljettuaan dialogin uudelleen, sitä ei näytetä enää (uusi v3-avain merkitään nähdyksi).
- Vanha "Tietoa palvelusta" -teksti pysyy saatavilla erillisellä sivulla.