# Origin-kutsujen ja välimuistilaskennan korjaus

## Tavoite

Varmistetaan, että yksi Tuloslistalta tehty päivityshaku palvelee kaikkia käyttäjiä omasta välimuistista ja että hallintanäkymän Origin- ja Cache-luvut vastaavat todellisia kutsuja.

## Vahvistetut havainnot

- Välimuisti toimii edelleen: tietokannassa on 5 194 välimuistiriviä, joista 593 on päivitetty tänään. Tuorein päivitys oli 6.8.2026 klo 19.55 Helsingin aikaa.
- Kutsutilaston viimeinen onnistunut päivitys on 5.8.2026 klo 14.13 Helsingin aikaa. Siksi 6.8. riviltä puuttuvat sekä Origin- että Cache-luvut.
- Tuotantoloki näyttää jokaiselle laskurikirjaukselle virheen `Cannot read properties of undefined (reading 'rest')`. Nykyinen laskuri käynnistää tietokantakirjauksen ilman odotusta, jolloin palvelinpyyntö ehtii päättyä ennen kirjauksen valmistumista.
- Harvesteri valitsee jo käsitellyn kilpailun uudelleen jokaisella ajolla, jos kilpailun viimeinen tapahtumapäivä on tänään tai tulevaisuudessa. Tämä ohittaa tiedostossa jo olevan 45 minuutin uudelleenhakuvälin.
- Harvesteri käy tällöin kilpailun kaikki lajit läpi. Kun tulosvälimuistin virallistuneiden lajien viiden minuutin voimassaolo päättyy samaan tahtiin kuin harvesterin ajo, seuraava ajo tekee jälleen aidot Origin-haut. Tämä selittää erityisesti tuhansien `harvester`-kutsujen päivät.

## Toteutus

1. **Korjataan kutsulaskurin luotettavuus**
   - Muutetaan laskurin kirjoitus odotettavaksi palvelintyöksi, jotta se ei jää päättyneen pyynnön ulkopuolelle.
   - Säilytetään erillään pyynnön alkuperäinen lähde, toteutunut välimuistiosuma ja toteutunut Origin-haku.
   - Varmistetaan, että sama pyyntö kirjataan vain kerran joko Cacheksi tai Originiksi.

2. **Estetään tarpeettomat täydet harvesterikierrokset**
   - Sovelletaan jo käsiteltyihin kuluvan päivän ja monipäiväisiin kilpailuihin olemassa olevaa uudelleenhakuväliä sen sijaan, että ne valitaan jokaiseen viiden minuutin ajoon.
   - Jätetään tiheä päivitys käyttäjien seuraamien aktiivisten kilpailujen hot cycle -reitille.
   - Säilytetään harvempi täydellinen kierros, jotta myös kilpailut, joita kukaan ei juuri sillä hetkellä katso, päätyvät päivän tuloksiin.

3. **Selkeytetään hallintanäkymän luvut**
   - Näytetään Origin-haut, välimuistista palvellut pyynnöt ja kokonaismäärä samoilla toteutuneeseen hakupolkuun perustuvilla säännöillä.
   - Näytetään varoitus, jos laskurin viimeinen päivitys on vanhentunut, jotta puuttuva päivä ei näytä virheellisesti nollalta.
   - Säilytetään polku- ja lähdekohtainen erittely, jotta mahdollinen uusi piikki voidaan kohdistaa kilpailuun ja lajiin.

4. **Varmistetaan toiminta tuotantokäyttäytymistä vastaavasti**
   - Kutsutaan samaa kilpailu- ja tulospolkua peräkkäin ja tarkistetaan, että ensimmäinen vanhentuneen datan haku voi mennä Originiin, mutta seuraavat pyynnöt tulevat välimuistista.
   - Tarkistetaan, että tämän päivän laskuririvi syntyy ja kasvaa molemmissa luokissa oikein.
   - Tarkistetaan, ettei peräkkäinen harvesteriajo valitse juuri käsiteltyä monipäiväistä kilpailua uudelleen ennen määritettyä aikaväliä.
   - Tarkistetaan tuotantolokeista, että laskurivirhe poistuu.

## Tekninen rajaus

- Muutokset kohdistuvat proxyyn, laskuriin, harvesterin kilpailuvalintaan ja admin-tilaston esitykseen.
- Välimuistitaulun rakennetta tai nykyistä jaettua lukitusta ei tarvitse vaihtaa.
- Live-tulos voidaan hakea Originista uudelleen datan vanhennuttua, mutta vain yksi jaettu päivityshaku tehdään polkua kohden. Muut samanaikaiset käyttäjät palvellaan välimuistista.