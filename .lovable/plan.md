
## Sähköpostiluonnos tuloslista.com:lle

Ei teknisiä linkkejä eikä sisäisiä nimiä, vain konkreettiset muutokset ja arvio vaikutuksesta.

---

**Aihe:** Päivitys: pyyntömäärien vähentämiseksi tehdyt muutokset

Hei,

Kiitos aiemmasta palautteestanne. Olemme tehneet palveluumme useita muutoksia, joilla olemme merkittävästi vähentäneet teidän rajapintaanne kohdistuvaa kuormaa. Kaikki muutokset on toteutettu eilisen aikana, joten kuorma on todennäköisesti pudonnut dramaattisesti. Alla yhteenveto tehdyistä muutoksista ja alustavista tuloksista.

**Mitä olemme muuttaneet**

1. **Kilpailu-ID:t haetaan vain virallisesta kilpailulistasta.** Olemme poistaneet kokonaan aiemmat "puimuripyynnöt", joissa kilpailun ID:tä yritettiin arvata numerojärjestyksessä. Uusia kilpailuja etsitään ainoastaan kilpailulistarajapinnan kautta.

2. **Taustahaku rajattu kolmen päivän ikkunaan.** Taustatyö hakee tuloksia vain viimeisen kolmen päivän kilpailuille, ei koko historialle. Monipäiväiset kilpailut tunnistetaan ja niitä seurataan koko keston ajan.

3. **Aktiivinen tulosseuranta (15 sekunnin sykli) käynnistyy vain, kun jollain käyttäjällä on kilpailu aktiivisesti seurannassa.** Jos yksikään käyttäjä ei seuraa kisaa, sitä ei pollata tiheästi. Samanaikaisesti aktiivisia kilpailuja on korkeintaan kahdeksan.

4. **Tiheä seuranta on aikaikkunoitu.** Yksittäistä lajia seurataan tiheästi vain 5 minuuttia ennen alkua ja korkeintaan 2 tuntia sen jälkeen. Monipäiväisissä kilpailuissa ikkuna kattaa kilpailupäivän.

5. **Haku on rajattu kello 09–21 (Helsinki).** Yöllä ei tehdä lainkaan taustapyyntöjä.

6. **Reunavälimuisti kaikkien pyyntöjen edessä.** Sekä käyttäjien selainpyynnöt että omat taustatyömme kulkevat välipalvelimen kautta, joka välimuistittaa vastaukset. TTL on porrastettu vastauksen sisällön mukaan: käynnissä olevat kierrokset lyhyellä TTL:llä, virallistuneet tulokset pitkällä, kilpailulista ja kilpailun ominaisuudet keskipitkällä TTL:llä. Rinnakkaiset samaan URL:iin osuvat pyynnöt yhdistetään yhdeksi lähtevään pyyntöön.

7. **Circuit breaker.** Jos rajapinta vastaa 429 tai 503, keskeytämme uudet pyynnöt kyseiselle polulle 60 sekunniksi ja tarjoamme käyttäjille välimuistin viimeisimmän kopion.

8. **User-Agent tunnistettavissa.** Kaikki lähtevät pyynnöt käyttävät tunnistettavaa User-Agent-otsaketta.

**Havaittu vaikutus**

Muutosten jälkeen 404-virheitä ei ole enää tullut, koska olemme lakanneet arvaamatta olemattomia kilpailu-ID:tä.

Mittaamme itse päivittäin, kuinka moni käyttäjän tai taustatyön käynnistämä pyyntö palvellaan omalta reunavälimuistiltamme ja kuinka moni menee teidän rajapintaanne asti.

Nykyinen jakauma osoittaa, että noin **70 % kaikista pyynnöistä palvellaan reunavälimuistista** eikä osu teidän palvelimillenne. Aiempaan tilanteeseen (arvaava puimuri + tiheä pollaus + ei välimuistia) verrattuna arvioimme kokonaispyyntömäärän laskeneen **noin 90 %**. Suurin osa jäljelle jäävistä pyynnöistä on välimuistin virkistyksiä käynnissä olevien kilpailujen aikana.

Jos näette omista lokeistanne yhä poikkeavan korkeita määriä joltakin poluilta, kertokaa: voimme säätää TTL:iä tai supistaa ikkunoita edelleen.

Ystävällisin terveisin,
[Nimi]

---

## Muutokset koodiin

Ei muutoksia. Kyseessä on ainoastaan viestin luonnos.
