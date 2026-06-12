## Miksi erä puuttui?

`src/data/yag-calling.ts` on rakennettu järjestäjän alkuperäisestä calling-PDF:stä. Live-tuloslistaan on PDF:n teon jälkeen lisätty eriä, kun ilmoittautumiset/allokoinnit ovat valmistuneet. Tämän vuoksi joillain lajeilla erien lukumäärä jää datassa vanhentuneeksi (kuten aiemmin T13 200m: PDF 4 erää, live 11). UI:n logiikka itse on kunnossa — datassa on aukko.

## Tarkistuksen tulos

Vertailin koko kilpailun (id 19616) jokaisen radan tapahtuman live-erien määrää calling-datan rivimäärään. Suodatin pois ne lajit, joissa erät eivät vielä ole allokoituneet (live = 0), koska siellä ei voi tietää lopullista määrää.

Allokoiduista, vielä korjaamattomista löytyi **kolme epäsuhtaa**:

| Sarja + laji | Calling-rivejä nyt | Live-eriä | Puuttuu |
|---|---|---|---|
| T11 150m | 8 | 9 | erä 9 |
| P11 150m | 5 | 6 | erä 6 |
| P12 200m | 4 | 5 | erä 5 |

Olemassa olevat erät noudattavat tarkasti +3 min askelta erien välillä, joten puuttuvat erät voidaan ekstrapoloida samalla kaavalla.

## Lisättävät rivit

Lisätään `src/data/yag-calling.ts`-tiedostoon viimeisen olemassa olevan erän perään seuraavat rivit (kaikki `date: "2026-06-12"`, `paikka: "–"`):

```
T11 150m (erä 9):  calling 14:14–14:24, kentälle 14:26, alkaa 14:34
P11 150m (erä 6):  calling 14:45–14:55, kentälle 14:57, alkaa 15:05
P12 200m (erä 5):  calling 11:55–12:05, kentälle 12:07, alkaa 12:15
```

Aikataulut on jatkettu kunkin lajin omasta +3 min -kuviosta:

- T11 150m: erä 1 alkaa 13:58 → erä 8 alkaa 14:31 → erä 9 alkaa 14:34
- P11 150m: erä 1 alkaa 14:50 → erä 5 alkaa 15:02 → erä 6 alkaa 15:05
- P12 200m: erä 1 alkaa 12:00 → erä 4 alkaa 12:09. (Tämä on aika tiukka: live näyttää 5 erää, joten lisätään erä 5 alkaa 12:15. **Huom:** P12 200m -erien aikaleimat eivät ole täydellisen säännölliset olemassa olevassa datassa — calling-PDF:n alkuperäiset ajat ovat erilaisia. Käyttäisin tässä saatavilla olevaa best-effort -ekstrapolaatiota; jos sinulla on viralliset ajat erälle 5, kerro ne niin käytetään niitä.)

## Lajit jotka eivät vielä ole allokoituneet

Edellä mainitut 3 ovat ainoat varmistettavissa olevat puutteet. Lopuilla allokointi on vielä kesken (live `Heats` -lista tyhjä), joten kentälle voi vielä ilmestyä lisää eriä myöhemmin. Niitä ei voi nyt korjata datassa; tarvittaessa katsotaan uudestaan kun allokointi on tehty.

## Avoin kysymys

Onko sinulla viralliset calling-ajat näille kolmelle puuttuvalle erälle, vai käytetäänkö ekstrapoloituja arvoja? Erityisesti P12 200m erä 5:n aika kannattaa varmistaa.
