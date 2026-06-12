## Korkeushypyn yritysnäkymä suorituspaikan livenäyttöön

### Ongelma
`/scoreboard`-näkymä renderöi kentälajien yritykset yleisellä logiikalla: kuusi numeroitua yrityspaikkaa (1./2./3./4./5./6.), joihin sijoitetaan `Attempts[i].Line1` arvona. Tämä toimii vaakahypyissä ja heitoissa, mutta korkeushypyssä (ja seiväshypyssä) data on rakennettu täysin toisin:

- Tuloslistan API palauttaa `Attempts`-taulukon **yksi alkio per korkeus**, johon hyppääjä on osallistunut.
- `Line1` = korkeus (esim. `"85"`, `"95"`, `"100"`)
- `Line2` = yrityskuvio kyseiselle korkeudelle: `"o"` (puhdas), `"xo"` (epäonnistui kerran, ylitti), `"xxo"` (kaksi epäonnistui, kolmas onnistui), `"xxx"` (hylätty kyseiseltä korkeudelta), `"-"` (väliin)

Nykyinen scoreboard näyttää korkeushypyssä siis vain ylittyneitä korkeuksia (numeroita) ilman yritystietoa, ja parhaaksi-logiikka valitsee suurimman luvun — toimii oikein lopullisena tuloksena, mutta menettää kokonaan O/X-yritystiedot, jotka kuuluttaja ja yleisö tarvitsevat livenä.

### Tavoite
Korkeushyppykilpailussa scoreboardin yritysrivi näyttää **korkeuskohtaiset yritykset O/X-merkein** samaan tapaan kuin tuloslista.com:n livenäkymä:

```
| 85    | 95    | 100   | 105   | 110   |
|  o    |  xo   |  o    |  xxo  |  xxx  |
```

### Muutokset

**1. `src/lib/tuloslista.ts` — tyyppi**
- Lisätään `Line2?: string | null` `Allocation.Attempts`-tyyppiin (säilytetään valinnaisena, jotta vanhat call-sitet eivät rikkoonnu).
- Lisätään apuri `isVerticalJump(ev: { EventSubCategory?: string } | { SubCategory?: string }): boolean`, joka palauttaa `true` kun arvo on `"VerticalJump"`, `"HighJump"` tai `"PoleVault"`.

**2. `src/routes/scoreboard.tsx` — pystyhypyn erikoisrendaus**
- `RankedRow` saa uudet kentät: `heights: { height: string; pattern: string }[]` ja `cleared: string | null` (paras puhtaasti ylitetty korkeus).
- `rows`-memo täytetään kahdella haaralla:
  - **Vaakahypyt / heitot** — nykyinen 6-paikkainen logiikka säilyy ennallaan.
  - **Pystyhypyt** (`isVerticalJump(ev)` = true):
    - `heights` = `Attempts.map(a => ({ height: a.Line1 ?? "", pattern: (a.Line2 ?? "").toLowerCase() }))`
    - `best` = `Result` jos asetettu; muuten suurin numeerinen `Line1`, jonka `pattern` päättyy `"o"`.
    - `bestIdx` osoittaa parhaan korkeuden indeksiin (visuaalista korostusta varten).
- `ScoreRow`:n yritysrivi (`attemptsList`) saa pystyhypyille uuden version:
  - Jokainen sarake näyttää kaksi riviä: ylhäällä korkeus (Line1), alhaalla yrityskuvio (Line2) suuremmilla `O/X` -kirjaimilla.
  - Värikoodaus: `o` (ja jäljellä `o` lopussa) = vihreä/primary, `xxx` = destructive, muut = neutraali.
  - Korkeuksien määrä vaihtelee 0…N; renderöidään `flex`-pohjalla ja jos sarakkeita on >6, hyödynnetään horisontaalista skrollausta (`overflow-x-auto`) jotta livenäyttö ei riko layouttia.
  - Sarakkeen sijaan käytetään `bestIdx` korostamaan korkeinta ylitettyä korkeutta (samoin kuin nykyinen `isBest`).
- Top 3/5 -kokojen kaksirivinen rakenne säilyy; vain solujen sisältö muuttuu pystyhypyille.

**3. `src/lib/result-visualization.ts` — signature**
- `getResultVisualState` lukee tällä hetkellä vain `Line1`. Sisällytetään `Line2` mukaan allekirjoitukseen pystyhypyissä, jotta uuden yrityksen tultua (esim. "x" → "xo") `NewResultOverlay` laukeaa myös korkeushypyssä.
- Käytännössä: `attemptParts.push(\`${index}:${value}:${line2 ?? ""}\`)` — toimii kaikille lajeille, ei rikko nykyistä logiikkaa.

### Ei muuteta tässä vaiheessa
- `/round/...`-näkymä, kuuluttajanäkymä ja tulostussivut eivät kuulu pyynnön piiriin — pidetään ne ennallaan.
- API-tyypistä `Line2` jää valinnaiseksi, joten muiden käyttäjien ei tarvitse päivittää mitään.

### Tiedostot
- `src/lib/tuloslista.ts` (tyyppi + apuri)
- `src/lib/result-visualization.ts` (signature)
- `src/routes/scoreboard.tsx` (rendering)
