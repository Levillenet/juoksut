Ongelma on nyt laajempi kuin pelkkä YAG calling: YAG-kisa on iso, ja `Seuran ohjelma` sekä `Seurattujen aikataulu` käyttävät edelleen raskasta koko kilpailun indeksihakua baseline-/ennätysvertailuineen. Muut kisat toimivat, koska niissä eventtejä on vähemmän.

Suunnitelma:

1. Kevennä tulostettavat ohjelmasivut
- Muuta `Seuran ohjelma` (`/print/club`) käyttämään `skipBaselines: true`.
- Muuta `Seurattujen ohjelma` (`/print/watched`) käyttämään `skipBaselines: true`.
- Näillä sivuilla ei näytetä PB/SB-baselinevertailua, joten ne eivät tarvitse hitaita lisäkyselyitä.

2. Estä ikuinen lataus YAG:n isoissa hauissa
- Lisää `competitionIndexQueryOptions`-funktioon valinnainen timeout / aikabudjetti isoille tulostusnäkymille.
- Jos yksittäinen Tuloslista-event jää roikkumaan, se ohitetaan eikä koko sivu jää odottamaan.
- Jos koko YAG-indeksin lataus ylittää kohtuullisen ajan, palautetaan siihen mennessä saatu data eikä jäädä “Ladataan…”-tilaan.

3. Lisää latauksen eteneminen tulostussivuille
- Näytä `Haetaan kilpailun lajeja X / Y` seuran ohjelmassa, seurattujen ohjelmassa ja YAG callingissa.
- Lisää hallittu virheilmoitus ja “Yritä uudelleen” -painike, jos haku epäonnistuu kokonaan.

4. Pidä YAG calling erillisenä kevyenä näkymänä
- Säilytä nykyinen `skipBaselines: true` YAG callingissa.
- Lisää samat timeout-/etenemisasetukset myös calling-sivulle, jotta yksittäinen hidas event ei estä PDF-aikataulun muodostumista.

5. Vähennä turhaa latausta avattaessa sivua
- Siirrä PDF-kirjaston lataus YAG callingissa vasta “Lataa PDF” -painikkeen painallukseen, jotta alkuperäinen sivun avaus ei lataa raskasta PDF-koodia heti.

Odotettu vaikutus:
- YAG:n `Seuran ohjelma`, `Seurattujen aikataulu` ja `Calling` eivät enää jää minuutiksi hakemaan.
- Iso YAG-kisa voi näyttää osittaisen datan, jos Tuloslista hidastelee, mutta sivu ei jää tyhjäksi.
- Muut kisat säilyvät ennallaan, mutta tulostusnäkymät kevenevät myös niissä.