## Ongelma

Tickeriin tulee viestejä myös kentälajeista jotka ovat jo päättyneet (lopputulokset olemassa). Esim. "Ella Silvennoinen johtaa T8 3-ottelu Kuula -kilpailua: 4.45" vaikka kisa on jo Official.

Syy: `useFieldLeaderChanges` käsittelee kaikki `details`-välimuistin kentälajit. Baseline-viesti tarkistaa `hasLiveRound`, mutta:
1. Ensimmäisellä havainnolla tapahtuma voi olla jo päättynyt — baseline ei pitäisi pushata, ja nykyisin ei pushaakaan ellei ole Progress-erää. Mutta jos detail latautuu juuri kun viimeinen erä on vielä Progress, ja seuraavalla pollauksella status muuttuu Official, edellinen viesti jää tickeriin näkyviin pitkäksi aikaa.
2. Käyttäjän esimerkissä viesti ilmestyy päättyneestä kisasta — tarkoittaa että `hasLiveRound`-tarkistus joko ei toimi (esim. Round.Status ei ole "Progress" vaan jokin muu välitila) tai välimuistissa oleva data on vanhentunut.

## Korjaus

1. **Tiukenna ehtoa `useFieldLeaderChanges.ts:ssä`**: ennen kuin pushataan mitään viestiä (baseline, kärjen vaihto, parannus), tarkista että tapahtumassa on aktiivinen erä — eli ainakin yksi `Round` jonka `Status === "Progress"`. Jos kaikki erät ovat `Official` / `Unofficial` / `Final` tms., ohitetaan koko tapahtuma ja päivitetään silti `snapshotsRef`, jotta seuraavalla mahdollisella uudella kierroksella vertailu pelaa.

2. **Suodata tickerin näyttölogiikassa myös vanhat viestit**: `LiveTicker` näyttää viimeisimmän viestin riippumatta siitä onko tapahtuma vielä käynnissä. Lisätään `ticker-store`en mahdollisuus merkitä viesti "stale", ja `useAnnouncerData`-tason efekti poistaa/piilottaa viestit niiden tapahtumien osalta jotka ovat siirtyneet completed-listalle. Vaihtoehtoisesti yksinkertaisempi: kun tapahtuma siirtyy `completedEvents`-listalle, poistetaan kaikki sen `eventId`:hen liittyvät tickerit storesta.

Toteutus: lisätään `removeTickerMessagesForEvent(eventId)` `ticker-store.ts`:ään ja kutsutaan sitä `useFieldLeaderChanges` (tai uudessa pienessä hookissa) kun havaitaan että aiemmin seurattu kenttälaji ei enää sisällä yhtään Progress-erää.

## Tiedostot

- `src/hooks/useFieldLeaderChanges.ts` — tiukenna push-ehtoa, kutsu remove-funktiota kun tapahtuma päättyy
- `src/lib/ticker-store.ts` — lisää `removeTickerMessagesForEvent(eventId, source?)`

Ei muutoksia UI-komponentteihin, asetuksiin tai tulostenhakuun.
