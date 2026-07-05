## Ongelma

Kuuluttajanäkymässä juoksulaji siirtyy "Lopputuloksiin" heti kun aikataulun `Status = "Official"`, vaikka osa eristä olisi vielä juoksematta. Lisäksi "Näytä myös juoksut" -kytkin ei nosta noita ei-vielä-valmiita juoksuja meneillään oleviin.

## Korjaus

Muutetaan **vain** `src/hooks/useAnnouncerData.ts`. Käytetään lajin details-dataa (`ev.Rounds[].Heats[].Allocations[].Result`) todelliseksi valmistumissignaaliksi juoksulajeille.

### Uusi apukäsite
`isRoundFullyComplete(ev, roundId)` = kierroksella on vähintään yksi erä JA jokaisessa erässä jokaisella allokaatiolla on `Result` (ei-null). Jos details puuttuu, tuloksena `undefined` → käytetään aikataulun statusta fallbackina (nykyinen käytös).

### Meneillään olevat (`inProgress`)
Nykyinen: `todayRounds.filter(r => r.Status === "Progress")`, ja jos `showRunning=false`, poistetaan Track.

Uusi lisäys — Track-kierrokset, joilla aikataulun Status = "Official" mutta details osoittaa että kaikki erät eivät ole vielä valmiit (`isRoundFullyComplete === false`), käsitellään "virtuaalisesti Progressina":
- Yhdistetään `inProgressAll`-listaan.
- Jos `showRunning=false`, ne suodattuvat pois kuten muutkin Track-kierrokset → nykykäytös säilyy kun kuuntelija katsoo vain kenttiä.
- Jos `showRunning=true`, ne näkyvät meneillään olevissa erä­kohtaisin tuloksin.

Käytännössä muutetaan `inProgressAll`-määritelmä:
- säilytetään kaikki Progress-kierrokset
- lisätään Track-kierrokset joilla `Status === "Official"` mutta `isRoundFullyComplete(details, r) === false`
- jotta details ehditään hakea, huolehditaan että näiden `EventId` on `wantedIds`-joukossa (nykyinen `completed.forEach` hakee ne jo, koska ne ovat completed-listassa alkuun asti — säilytetään).

### Lopputulokset (`completed` / `completedAllMerged`)
Nykyinen: `todayRounds.filter(r => r.Status === "Official")` + Track-Progress joissa round.Status kääntyi Officialiksi.

Uusi:
- Jätetään Track-kierrokset pois `completedAll`-listasta jos details on saatavilla ja `isRoundFullyComplete === false` (eli vielä eriä juoksematta). Ne näkyvät nyt meneillään olevissa yllä olevan sääntöön.
- `finishedProgressRoundIds` käyttää samaa `isRoundFullyComplete`-tarkistusta pelkän `round.Status === "Official"` sijaan → Track-Progress siirtyy lopputuloksiin vasta kun oikeasti kaikki erät valmiit.
- Field- ja muut ei-Track-kierrokset toimivat kuten ennen (aikataulun Status ratkaisee).

### Tekniset yksityiskohdat
- `isRoundFullyComplete` elää samassa hookissa (pieni sisäinen apufunktio) tai lisätään `src/lib/tuloslista.ts`:ään; pidetään hookin sisällä yksinkertaisuuden vuoksi.
- `wantedIds`-muistetun listan sisältö säilyy oikeana: mukaan päätyvät sekä (a) uudet virtuaali-Progress-track-EventIdt (jotka tulevat completedAll-lähteestä), että (b) alkuperäiset Progress-kierrokset. Ei uusia queryjä tarvita.
- Ei muutoksia UI-komponentteihin (`InProgressSection`, `CompletedSection`, `AnnouncerLayoutControls`); ne saavat vain oikeat listat hookilta.

## Odotettu käytös
- Track-laji jonka aikataulu-status on "Official" mutta erä 3/4 vailla tuloksia: näkyy meneillään olevissa (kun "Näytä juoksut" päällä) erä­kohtaisin tuloksin, EI lopputuloksissa.
- Kun viimeisenkin erän tulokset saapuvat: siirtyy lopputuloksiin automaattisesti.
- Kenttälajien käyttäytyminen ennallaan.
