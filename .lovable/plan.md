Korjataan livenäytön lataus niin, että linkki avautuu myös silloin kun selaimen aktiivinen kilpailu ei ole Jymy Games tai tulospalvelun yksittäinen vastaus antaa hetkellisen virheen.

Toteutussuunnitelma:
1. Lisään scoreboard-linkkiin tuen `competitionId`-hakuehdolle, jotta URL on täysin yksiselitteinen eikä nojaa selaimen tallennettuun kisavalintaan.
2. Muutan scoreboardin validoinnin ja live-kyselyn käyttämään URL:n `competitionId`:tä ensisijaisesti, ja vasta sen puuttuessa tallennettua valintaa.
3. Lisään livenäyttöön virhetilan, jossa ei jäädä loputtomasti `Ladataan…`-tekstiin, vaan näytetään selkeä viesti ja Päivitä-painike, jos `/results/...` palauttaa 503 tai muu virhe.
4. Päivitän sisäiset scoreboard-navigoinnit säilyttämään `competitionId`:n, jotta takaisin, top, erä ja järjestys eivät pudota oikeaa kisaa pois URL:stä.
5. Tarkistan nopeasti selaimella, että kyseinen osoite avautuu, tai jos tulospalvelu palauttaa yhä 503:n, käyttäjä näkee virheilmoituksen lataussilmukan sijaan.

Tekninen huomio: testikutsu nykyisellä oletuslogiikalla palautti `503 Upstream unavailable`, ja nykyinen URL ei sisällä kilpailu-ID:tä. Tämä voi johtaa siihen, että eventId haetaan väärän aktiivisen kilpailun alta tai hetkellinen upstream-virhe näyttää käyttäjälle vain ikuiselta lataukselta.